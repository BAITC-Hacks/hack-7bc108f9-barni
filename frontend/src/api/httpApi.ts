import type {
  AnalyzeDraftResponse,
  BuildTaskCardResponse,
  CatalogParams,
  CatalogTask,
  CreateProposalInput,
  MetaResponse,
  MissingField,
  Proposal,
  ProposalStatus,
  PublishedTask,
  PublishResult,
  ReadinessLevel,
  ScoreBreakdownItem,
  ScoreResult,
  TaskCard,
  Team,
  TeamProposal,
} from '../types';
import type { TaskApi } from './client';

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const defaultTimeoutMs = 10_000;
const aiTimeoutMs = 50_000;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';
type JsonRecord = Record<string, unknown>;

interface RequestOptions {
  method?: Method;
  body?: unknown;
  timeoutMs?: number;
}

interface BackendTask {
  id: string;
  status: 'draft' | 'published';
  title: string | null;
  topic: string | null;
  card: TaskCard;
  score: number | null;
  readiness_level: ReadinessLevel | null;
  score_breakdown: ScoreBreakdownItem[] | null;
  missing_fields: MissingField[] | null;
  published_at: string | null;
  proposals_count: number;
}

const readinessLabels: Record<ReadinessLevel, string> = {
  draft: 'Черновик',
  working: 'Рабочая',
  ready: 'Готовая',
  priority: 'Приоритетная',
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorFromResponse(payload: unknown, status: number): ApiError {
  const root = isRecord(payload) ? payload : {};
  const detail = isRecord(root.error) ? root.error
    : isRecord(root.detail) ? root.detail : root;
  const validation = Array.isArray(root.detail) ? root.detail.find(isRecord) : null;
  const message = typeof detail.message === 'string' && detail.message.trim()
    ? detail.message
    : typeof root.detail === 'string' && root.detail.trim()
      ? root.detail
      : validation && typeof validation.msg === 'string' && validation.msg.trim()
        ? validation.msg
        : 'Ошибка сервера (' + status + ').';
  const code = typeof detail.code === 'string' ? detail.code : null;
  return new ApiError(message, status, code);
}

export async function requestJson<T>(
  path: string,
  { method = 'GET', body, timeoutMs = defaultTimeoutMs }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(baseUrl + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!raw.trim()) {
      if (!response.ok) throw new ApiError('Ошибка сервера (' + response.status + ').', response.status);
      throw new ApiError('Сервер вернул пустой ответ.', response.status);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      if (!response.ok) throw new ApiError('Ошибка сервера (' + response.status + ').', response.status);
      throw new ApiError('Сервер вернул некорректный JSON.', response.status);
    }
    if (!response.ok) throw errorFromResponse(payload, response.status);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError('Сервер не ответил за ' + Math.round(timeoutMs / 1000) + ' секунд.');
    }
    throw new ApiError('Нет связи с сервером. Проверьте подключение и повторите.');
  } finally {
    clearTimeout(timer);
  }
}

function taskId(task: unknown): string {
  if (!isRecord(task) || typeof task.id !== 'string' || !task.id) {
    throw new ApiError('Сервер не вернул ID задачи.');
  }
  return task.id;
}

function toScoreResult(task: BackendTask): ScoreResult {
  taskId(task);
  if (typeof task.score !== 'number' || !Number.isFinite(task.score) ||
      !task.readiness_level || !readinessLabels[task.readiness_level] ||
      !Array.isArray(task.score_breakdown) || !Array.isArray(task.missing_fields)) {
    throw new ApiError('Сервер вернул неполный рейтинг задачи.');
  }
  return {
    score: task.score,
    readiness_level: task.readiness_level,
    readiness_label: readinessLabels[task.readiness_level],
    breakdown: task.score_breakdown,
    missing_fields: task.missing_fields,
  };
}

function toPublishedTask(task: BackendTask): PublishedTask {
  taskId(task);
  if (task.status !== 'published' || !isRecord(task.card) ||
      typeof task.published_at !== 'string') {
    throw new ApiError('Сервер вернул неполную опубликованную задачу.');
  }
  const score = toScoreResult(task);
  return {
    id: task.id,
    title: task.title || task.card.title || 'Без названия',
    topic: task.topic || task.card.topic || 'Без темы',
    card: task.card,
    score: score.score,
    readiness_level: score.readiness_level,
    readiness_label: score.readiness_label,
    score_breakdown: score.breakdown,
    missing_fields: score.missing_fields,
    status: 'published',
    published_at: task.published_at,
    proposals_count: task.proposals_count ?? 0,
  };
}

function toCatalogTask(value: unknown): CatalogTask {
  if (!isRecord(value) || typeof value.id !== 'string' ||
      typeof value.score !== 'number' || !Number.isFinite(value.score) ||
      typeof value.readiness_level !== 'string' ||
      !readinessLabels[value.readiness_level as ReadinessLevel] ||
      !Array.isArray(value.missing_fields) ||
      typeof value.published_at !== 'string') {
    throw new ApiError('Сервер вернул неполную запись каталога.');
  }
  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title : null,
    topic: typeof value.topic === 'string' ? value.topic : null,
    context: typeof value.context === 'string' ? value.context : null,
    score: value.score,
    readiness_level: value.readiness_level as ReadinessLevel,
    missing_fields: value.missing_fields as MissingField[],
    published_at: value.published_at,
  };
}

let currentTaskId: string | null = null;
let currentDraftKey: string | null = null;

export const httpApi: TaskApi = {
  async getMeta(): Promise<MetaResponse> {
    const meta = await requestJson<MetaResponse>('/api/meta');
    if (!meta || !Array.isArray(meta.topics) || !Array.isArray(meta.readiness_levels)) {
      throw new ApiError('Сервер вернул некорректный справочник тем.');
    }
    return meta;
  },

  async analyzeDraft({ draft, topic }): Promise<AnalyzeDraftResponse> {
    const key = JSON.stringify([draft, topic]);
    if (!currentTaskId || currentDraftKey !== key) {
      const created = await requestJson<BackendTask>('/api/tasks', {
        method: 'POST',
        body: { draft_text: draft, topic },
      });
      currentTaskId = taskId(created);
      currentDraftKey = key;
    }
    return requestJson<AnalyzeDraftResponse>('/api/ai/analyze-draft', {
      method: 'POST',
      body: { draft, topic },
      timeoutMs: aiTimeoutMs,
    });
  },

  buildTaskCard({ draft, topic, questions, answers }): Promise<BuildTaskCardResponse> {
    return requestJson<BuildTaskCardResponse>('/api/ai/build-card', {
      method: 'POST',
      body: {
        draft,
        topic,
        questions,
        answers: answers.map(({ question_id, answer }) => ({ question_id, answer })),
      },
      timeoutMs: aiTimeoutMs,
    });
  },

  async previewRating({ card }): Promise<ScoreResult> {
    const result = await requestJson<Omit<ScoreResult, 'readiness_label'>>(
      '/api/rating/preview',
      { method: 'POST', body: { card } },
    );
    if (!result || typeof result.score !== 'number' || !Number.isFinite(result.score) ||
        !result.readiness_level || !readinessLabels[result.readiness_level] ||
        !Array.isArray(result.breakdown) || !Array.isArray(result.missing_fields)) {
      throw new ApiError('Сервер вернул неполный предварительный рейтинг.');
    }
    return { ...result, readiness_label: readinessLabels[result.readiness_level] };
  },

  async confirmTaskCard({ card }): Promise<ScoreResult> {
    if (!currentTaskId) throw new ApiError('Сначала создайте черновик задачи.');
    const task = await requestJson<BackendTask>(
      '/api/tasks/' + encodeURIComponent(currentTaskId) + '/confirm',
      { method: 'PUT', body: { card } },
    );
    if (taskId(task) !== currentTaskId) throw new ApiError('Сервер подтвердил другую задачу.');
    return toScoreResult(task);
  },

  async publishTask(): Promise<PublishResult> {
    if (!currentTaskId) throw new ApiError('Сначала подтвердите задачу.');
    const task = await requestJson<BackendTask>(
      '/api/tasks/' + encodeURIComponent(currentTaskId) + '/publish',
      { method: 'POST' },
    );
    if (taskId(task) !== currentTaskId || task.status !== 'published') {
      throw new ApiError('Сервер не подтвердил публикацию.');
    }
    currentTaskId = null;
    currentDraftKey = null;
    return { task_id: task.id, status: 'published' };
  },

  async getCatalog(params: CatalogParams = {}): Promise<CatalogTask[]> {
    const query = new URLSearchParams({ status: 'published', sort: 'score_desc' });
    if (params.topic) query.set('topic', params.topic);
    if (params.readiness_level) query.set('readiness', params.readiness_level);
    const raw = await requestJson<unknown>('/api/tasks?' + query.toString());
    if (!Array.isArray(raw)) throw new ApiError('Сервер вернул некорректный каталог.');
    const tasks = raw.map(toCatalogTask);
    if (params.sort === 'score_asc') {
      return tasks.sort((a, b) => a.score - b.score || b.published_at.localeCompare(a.published_at));
    }
    if (params.sort === 'newest') {
      return tasks.sort((a, b) => b.published_at.localeCompare(a.published_at));
    }
    return tasks;
  },

  async getTask(id: string): Promise<PublishedTask | null> {
    try {
      const task = await requestJson<BackendTask>('/api/tasks/' + encodeURIComponent(id));
      return toPublishedTask(task);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async getTeams(): Promise<Team[]> {
    const teams = await requestJson<Team[]>('/api/teams');
    if (!Array.isArray(teams)) throw new ApiError('Сервер вернул некорректный список команд.');
    return teams;
  },

  async getProposals(id: string): Promise<Proposal[]> {
    const proposals = await requestJson<Proposal[]>(
      '/api/tasks/' + encodeURIComponent(id) + '/proposals',
    );
    if (!Array.isArray(proposals)) throw new ApiError('Сервер вернул некорректные предложения.');
    return proposals;
  },

  async getTeamProposals(teamId: string): Promise<TeamProposal[]> {
    const query = new URLSearchParams({ team_id: teamId });
    const proposals = await requestJson<TeamProposal[]>('/api/proposals?' + query.toString());
    if (!Array.isArray(proposals)) {
      throw new ApiError('Сервер вернул некорректный список предложений команды.');
    }
    return proposals;
  },

  createProposal(id: string, input: CreateProposalInput): Promise<Proposal> {
    return requestJson<Proposal>(
      '/api/tasks/' + encodeURIComponent(id) + '/proposals',
      { method: 'POST', body: { ...input, prototype_url: input.prototype_url.trim() || null } },
    );
  },

  updateProposalStatus(id: string, status: Exclude<ProposalStatus, 'pending'>): Promise<Proposal> {
    return requestJson<Proposal>(
      '/api/proposals/' + encodeURIComponent(id),
      { method: 'PATCH', body: { status } },
    );
  },
};
