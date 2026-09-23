import type {
  AnalyzeDraftResponse,
  CatalogParams,
  CreateProposalInput,
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
} from '../types';
import type { TaskApi } from './client';

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const timeoutMs = 10_000;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';
type JsonRecord = Record<string, unknown>;

interface RequestOptions {
  method?: Method;
  body?: unknown;
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
        : `Ошибка сервера (${status}).`;
  const code = typeof detail.code === 'string' ? detail.code : null;
  return new ApiError(message, status, code);
}

export async function requestJson<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(baseUrl + path, {
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
      if (!response.ok) throw new ApiError(`Ошибка сервера (${response.status}).`, response.status);
      throw new ApiError('Сервер вернул пустой ответ.', response.status);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      if (!response.ok) throw new ApiError(`Ошибка сервера (${response.status}).`, response.status);
      throw new ApiError('Сервер вернул некорректный JSON.', response.status);
    }
    if (!response.ok) throw errorFromResponse(payload, response.status);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('Сервер не ответил за 10 секунд.');
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

function toPublishedTask(task: BackendTask): PublishedTask {
  taskId(task);
  if (task.status !== 'published' || !task.card ||
      typeof task.score !== 'number' || !Number.isFinite(task.score) ||
      !task.readiness_level || !readinessLabels[task.readiness_level] ||
      !Array.isArray(task.score_breakdown) ||
      !Array.isArray(task.missing_fields) ||
      typeof task.published_at !== 'string') {
    throw new ApiError('Сервер вернул неполную опубликованную задачу.');
  }
  return {
    id: taskId(task),
    title: task.title || task.card.title || 'Без названия',
    topic: task.topic || task.card.topic || 'Без темы',
    card: task.card,
    score: task.score,
    readiness_level: task.readiness_level,
    readiness_label: readinessLabels[task.readiness_level],
    score_breakdown: task.score_breakdown,
    missing_fields: task.missing_fields,
    status: 'published',
    published_at: task.published_at,
  };
}

let currentTaskId: string | null = null;
let currentDraftKey: string | null = null;

export const httpApi: TaskApi = {
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
    });
  },

  buildTaskCard({ draft, topic, questions, answers }) {
    return requestJson<{ card: TaskCard }>('/api/ai/build-card', {
      method: 'POST',
      body: {
        draft,
        topic,
        questions,
        answers: answers.map(({ question_id, answer }) => ({ question_id, answer })),
      },
    });
  },

  async confirmTaskCard({ card }): Promise<ScoreResult> {
    if (!currentTaskId) throw new ApiError('Сначала создайте черновик задачи.');
    const result = await requestJson<ScoreResult>(
      '/api/tasks/' + encodeURIComponent(currentTaskId) + '/confirm',
      { method: 'PUT', body: { card } },
    );
    if (!result || typeof result.score !== 'number' || !Number.isFinite(result.score) ||
        !result.readiness_level || !readinessLabels[result.readiness_level] ||
        typeof result.readiness_label !== 'string' ||
        !Array.isArray(result.breakdown) || !Array.isArray(result.missing_fields)) {
      throw new ApiError('Сервер вернул неполный рейтинг задачи.');
    }
    return result;
  },

  async publishTask(): Promise<PublishResult> {
    if (!currentTaskId) throw new ApiError('Сначала подтвердите задачу.');
    const result = await requestJson<PublishResult>(
      '/api/tasks/' + encodeURIComponent(currentTaskId) + '/publish',
      { method: 'POST' },
    );
    if (!result || typeof result.task_id !== 'string' || result.status !== 'published') {
      throw new ApiError('Сервер не подтвердил публикацию.');
    }
    currentTaskId = null;
    currentDraftKey = null;
    return result;
  },

  async getCatalog(params: CatalogParams = {}): Promise<PublishedTask[]> {
    const query = new URLSearchParams({ status: 'published', sort: params.sort ?? 'score_desc' });
    if (params.topic) query.set('topic', params.topic);
    if (params.readiness_level) query.set('readiness_level', params.readiness_level);
    const tasks = await requestJson<BackendTask[]>('/api/tasks?' + query.toString());
    if (!Array.isArray(tasks)) throw new ApiError('Сервер вернул некорректный каталог.');
    return tasks.map(toPublishedTask);
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

  createProposal(id: string, input: CreateProposalInput): Promise<Proposal> {
    return requestJson<Proposal>(
      '/api/tasks/' + encodeURIComponent(id) + '/proposals',
      { method: 'POST', body: input },
    );
  },

  updateProposalStatus(id: string, status: Exclude<ProposalStatus, 'pending'>): Promise<Proposal> {
    return requestJson<Proposal>(
      '/api/proposals/' + encodeURIComponent(id),
      { method: 'PATCH', body: { status } },
    );
  },
};
