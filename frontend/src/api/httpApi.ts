import { fieldDefinitions } from '../types';
import type {
  AnalyzeDraftResponse, BuildTaskCardResponse, CardField, CatalogParams, CatalogTask,
  ClarifyingQuestion, CreateTaskResult, MetaResponse, MissingField, Proposal,
  PublishedTask, PublishResult, ReadinessLevel, ScoreBreakdownItem, ScoreResult,
  TaskCard, Team, TeamProposal,
} from '../types';
import type { TaskApi } from './client';

// The existing development default is documented in frontend/.env.example.
const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const defaultTimeoutMs = 10_000;
// Backend AI can make two validated attempts of up to 20 seconds each.
const aiTimeoutMs = 60_000;
type JsonRecord = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';
interface RequestOptions { method?: Method; body?: unknown; timeoutMs?: number }

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
  draft: 'Черновик', working: 'Рабочая', ready: 'Готовая', priority: 'Приоритетная',
};
const cardFields = fieldDefinitions.map(({ key }) => key);
const topicSlugs = ['automation', 'analytics', 'marketing', 'education', 'finance', 'other'];
const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());
const isNullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isCardField = (value: unknown): value is CardField => typeof value === 'string' && cardFields.includes(value as CardField);
const isReadiness = (value: unknown): value is ReadinessLevel =>
  typeof value === 'string' && Object.hasOwn(readinessLabels, value);
const isSource = (value: unknown): value is 'model' | 'fallback' => value === 'model' || value === 'fallback';

function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@');
}

function safeDetail(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(safeDetail);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /secret|password|token|api.?key|authorization|^input$/i.test(key) ? '[redacted]' : safeDetail(item)]));
  return value;
}

export class ApiError extends Error {
  readonly detail: unknown;
  readonly serverMessage: string | null;
  readonly validationErrors: unknown[];
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
    readonly endpoint = '',
    detail: unknown = null,
    serverMessage: string | null = null,
    validationErrors: unknown[] = [],
  ) {
    super(redactText(message));
    this.name = 'ApiError';
    this.detail = safeDetail(detail);
    this.serverMessage = serverMessage === null ? null : redactText(serverMessage);
    this.validationErrors = validationErrors.map(safeDetail);
  }
}

function invalidResponse(endpoint: string, message = 'Сервер вернул некорректные данные. Попробуйте ещё раз.'): never {
  throw new ApiError(message, null, 'INVALID_RESPONSE', endpoint);
}

function errorFromResponse(payload: unknown, status: number, endpoint: string): ApiError {
  const root = isRecord(payload) ? payload : {};
  const detail = root.error ?? root.detail ?? payload;
  const info = isRecord(detail) ? detail : {};
  const validationErrors = Array.isArray(detail) ? detail : Array.isArray(info.errors) ? info.errors : [];
  const first = validationErrors.find(isRecord);
  const serverMessage = isText(info.message) ? info.message : isText(detail) ? detail
    : first && isText(first.msg) ? first.msg : null;
  const message = status === 422 && validationErrors.length > 0
    ? 'Проверьте заполненные поля: сервер отклонил данные.'
    : serverMessage?.slice(0, 350) || 'Ошибка сервера (' + status + '). Попробуйте ещё раз.';
  return new ApiError(message, status, isText(info.code) ? info.code : null, endpoint, detail, serverMessage, validationErrors);
}

export async function requestJson<T>(path: string, { method = 'GET', body, timeoutMs = defaultTimeoutMs }: RequestOptions = {}): Promise<T> {
  let url: URL;
  try {
    url = new URL(baseUrl + path);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    throw new ApiError('Некорректный адрес API. Проверьте VITE_API_URL.', null, 'CONFIGURATION_ERROR', path);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!raw.trim()) {
      if (!response.ok) throw errorFromResponse(null, response.status, path);
      // A successful empty body is valid for the helper; operations that require
      // a JSON object validate it before it reaches a page.
      return undefined as T;
    }
    let payload: unknown;
    try { payload = JSON.parse(raw) as unknown; }
    catch {
      throw new ApiError('Сервер вернул некорректный JSON.', response.status, 'INVALID_JSON', path);
    }
    if (!response.ok) throw errorFromResponse(payload, response.status, path);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError('Сервер не ответил за ' + Math.round(timeoutMs / 1000) + ' секунд. Повторите попытку.', null, 'TIMEOUT', path);
    }
    throw new ApiError('Нет связи с сервером. Проверьте подключение и повторите.', null, 'NETWORK_ERROR', path);
  } finally { clearTimeout(timer); }
}

function readCard(value: unknown, endpoint: string): TaskCard {
  if (!isRecord(value) || cardFields.some((field) => !isNullableText(value[field])) ||
      (value.topic !== null && !topicSlugs.includes(value.topic as string))) {
    invalidResponse(endpoint, 'Сервер вернул неполную карточку. Попробуйте ещё раз.');
  }
  // Copy only the contract's 11 fields. Unknown information remains null.
  return Object.fromEntries(cardFields.map((field) => [field, value[field]])) as TaskCard;
}

function readAnalysis(value: unknown, endpoint: string): AnalyzeDraftResponse {
  if (!isRecord(value) || !isRecord(value.known_fields) || !Array.isArray(value.missing_fields) ||
      !Array.isArray(value.questions) || value.questions.length < 3 || value.questions.length > 5 || !isSource(value.source)) {
    invalidResponse(endpoint, 'AI вернул неполные вопросы. Попробуйте ещё раз.');
  }
  const known = value.known_fields;
  const missing = value.missing_fields;
  if (Object.entries(known).some(([field, text]) => !isCardField(field) || !isText(text)) ||
      missing.some((field) => !isCardField(field)) || new Set(missing).size !== missing.length ||
      cardFields.some((field) => Number(Object.hasOwn(known, field)) + Number(missing.includes(field)) !== 1) ||
      (known.topic !== undefined && !topicSlugs.includes(known.topic as string))) invalidResponse(endpoint);
  const questions = value.questions.map((question): ClarifyingQuestion => {
    if (!isRecord(question) || !isText(question.id) || !isText(question.text) ||
        !isCardField(question.target_field) || !missing.includes(question.target_field)) invalidResponse(endpoint);
    return { id: question.id, text: question.text, target_field: question.target_field };
  });
  for (const key of ['id', 'text', 'target_field'] as const) {
    if (new Set(questions.map((question) => question[key].toLocaleLowerCase())).size !== questions.length) invalidResponse(endpoint);
  }
  return { known_fields: known as Partial<TaskCard>, missing_fields: missing as CardField[], questions, source: value.source };
}

function readScore(value: unknown, endpoint: string): ScoreResult {
  if (!isRecord(value) || !isNumber(value.score) || value.score < 0 || value.score > 100 ||
      !isReadiness(value.readiness_level) || !Array.isArray(value.breakdown) || !Array.isArray(value.missing_fields)) invalidResponse(endpoint);
  const breakdown = value.breakdown.map((item): ScoreBreakdownItem => {
    if (!isRecord(item) || !isCardField(item.field) || !isText(item.label) || !isNumber(item.earned) ||
        !isNumber(item.maximum) || item.earned < 0 || item.earned > item.maximum || !isText(item.reason)) invalidResponse(endpoint);
    return { field: item.field, label: item.label, earned: item.earned, maximum: item.maximum, reason: item.reason };
  });
  const missing = readMissingFields(value.missing_fields, endpoint);
  return { score: value.score, readiness_level: value.readiness_level, readiness_label: readinessLabels[value.readiness_level], breakdown, missing_fields: missing };
}

function readMissingFields(value: unknown, endpoint: string): MissingField[] {
  if (!Array.isArray(value)) invalidResponse(endpoint);
  return value.map((item): MissingField => {
    if (!isRecord(item) || !isCardField(item.field) || !isText(item.label) ||
        !isNumber(item.potential_points) || !isText(item.recommendation)) invalidResponse(endpoint);
    return { field: item.field, label: item.label, potential_points: item.potential_points, recommendation: item.recommendation };
  });
}

function readTask(value: unknown, endpoint: string): BackendTask {
  if (!isRecord(value) || !isText(value.id) || !['draft', 'published'].includes(String(value.status)) ||
      !isNullableText(value.title) || !isNullableText(value.topic) || !isNullableText(value.published_at) ||
      !Number.isInteger(value.proposals_count) || Number(value.proposals_count) < 0) invalidResponse(endpoint);
  const card = readCard(value.card, endpoint);
  return { ...value, card } as unknown as BackendTask;
}

function toScoreResult(task: BackendTask, endpoint: string): ScoreResult {
  return readScore({ score: task.score, readiness_level: task.readiness_level,
    breakdown: task.score_breakdown, missing_fields: task.missing_fields }, endpoint);
}

function toPublishedTask(task: BackendTask, endpoint: string): PublishedTask {
  if (task.status !== 'published' || !isText(task.published_at)) {
    throw new ApiError('Задача ещё не опубликована.', null, 'TASK_NOT_PUBLISHED', endpoint);
  }
  const score = toScoreResult(task, endpoint);
  return { id: task.id, title: task.title || 'Без названия', topic: task.topic || 'Без темы', card: task.card,
    score: score.score, readiness_level: score.readiness_level, readiness_label: score.readiness_label,
    score_breakdown: score.breakdown, missing_fields: score.missing_fields, status: 'published',
    published_at: task.published_at, proposals_count: task.proposals_count };
}

function readCatalogTask(value: unknown, endpoint: string): CatalogTask {
  if (!isRecord(value) || !isText(value.id) || !isNullableText(value.title) || !isNullableText(value.topic) ||
      !isNullableText(value.context_preview) || !isNumber(value.score) || !isReadiness(value.readiness_level) ||
      value.status !== 'published' || !isText(value.published_at) || !Number.isInteger(value.proposals_count) ||
      Number(value.proposals_count) < 0) invalidResponse(endpoint);
  return { id: value.id, title: value.title, topic: value.topic, context: value.context_preview,
    score: value.score, readiness_level: value.readiness_level, missing_fields: readMissingFields(value.missing_fields, endpoint),
    status: 'published', published_at: value.published_at, proposals_count: Number(value.proposals_count) };
}

function readProposal(value: unknown, endpoint: string): Proposal {
  if (!isRecord(value) || !isText(value.id) || !isText(value.task_id) || !isText(value.team_id) ||
      !isNullableText(value.task_title) || !isText(value.team_name) || !isText(value.idea) ||
      !isText(value.plan) || !isText(value.estimated_duration) || !isNullableText(value.prototype_url) ||
      !['pending', 'accepted', 'rejected'].includes(String(value.status)) ||
      !isText(value.created_at) || !isText(value.updated_at)) invalidResponse(endpoint);
  return value as unknown as Proposal;
}

function readProposals(value: unknown, endpoint: string): Proposal[] {
  if (!Array.isArray(value)) invalidResponse(endpoint);
  return value.map((proposal) => readProposal(proposal, endpoint));
}

export const httpApi: TaskApi = {
  async getMeta(): Promise<MetaResponse> {
    const endpoint = '/api/meta';
    const meta = await requestJson<MetaResponse>(endpoint);
    if (!isRecord(meta) || !Array.isArray(meta.topics) || !Array.isArray(meta.readiness_levels) ||
        meta.topics.some((item) => !isRecord(item) || !isText(item.slug) || !isText(item.label)) ||
        meta.readiness_levels.some((item) => !isRecord(item) || !isReadiness(item.slug) ||
          !isText(item.label) || !isNumber(item.min) || !isNumber(item.max))) invalidResponse(endpoint);
    return meta;
  },

  async createTask({ draft, topic }): Promise<CreateTaskResult> {
    const endpoint = '/api/tasks';
    const task = readTask(await requestJson<unknown>(endpoint, { method: 'POST', body: { draft_text: draft, topic } }), endpoint);
    return { id: task.id };
  },

  async analyzeDraft({ draft, topic }): Promise<AnalyzeDraftResponse> {
    const endpoint = '/api/ai/analyze-draft';
    return readAnalysis(await requestJson<unknown>(endpoint, { method: 'POST', timeoutMs: aiTimeoutMs, body: { draft, topic } }), endpoint);
  },

  async buildTaskCard({ draft, topic, questions, answers }): Promise<BuildTaskCardResponse> {
    const endpoint = '/api/ai/build-card';
    const result = await requestJson<unknown>(endpoint, { method: 'POST', timeoutMs: aiTimeoutMs, body: { draft, topic, questions,
      answers: answers.map(({ question_id, answer }) => ({ question_id, answer })) } });
    if (!isRecord(result) || !isSource(result.source)) invalidResponse(endpoint);
    return { card: readCard(result.card, endpoint), source: result.source };
  },

  async previewRating({ card }): Promise<ScoreResult> {
    const endpoint = '/api/rating/preview';
    return readScore(await requestJson<unknown>(endpoint, { method: 'POST', body: { card } }), endpoint);
  },

  async confirmTaskCard({ taskId, card }): Promise<ScoreResult> {
    const endpoint = '/api/tasks/' + encodeURIComponent(taskId) + '/confirm';
    const task = readTask(await requestJson<unknown>(endpoint, { method: 'PUT', body: { card } }), endpoint);
    if (task.id !== taskId) invalidResponse(endpoint);
    return toScoreResult(task, endpoint);
  },

  async publishTask({ taskId }): Promise<PublishResult> {
    const endpoint = '/api/tasks/' + encodeURIComponent(taskId) + '/publish';
    const task = readTask(await requestJson<unknown>(endpoint, { method: 'POST' }), endpoint);
    if (task.id !== taskId || task.status !== 'published' || !isText(task.published_at)) invalidResponse(endpoint);
    return { task_id: task.id, status: 'published' };
  },

  async getCatalog(params: CatalogParams = {}): Promise<CatalogTask[]> {
    const query = new URLSearchParams({ status: 'published', sort: 'score_desc' });
    if (params.topic) query.set('topic', params.topic);
    if (params.readiness_level) query.set('readiness', params.readiness_level);
    const endpoint = '/api/tasks?' + query.toString();
    const tasks = await requestJson<unknown>(endpoint);
    if (!Array.isArray(tasks)) invalidResponse(endpoint);
    return tasks.map((task) => readCatalogTask(task, endpoint));
  },

  async getTask(id: string): Promise<PublishedTask | null> {
    const endpoint = '/api/tasks/' + encodeURIComponent(id);
    try { return toPublishedTask(readTask(await requestJson<unknown>(endpoint), endpoint), endpoint); }
    catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async getTeams(): Promise<Team[]> {
    const endpoint = '/api/teams';
    const teams = await requestJson<Team[]>(endpoint);
    if (!Array.isArray(teams) || teams.some((team) => !isRecord(team) || !isText(team.id) ||
        !isText(team.name) || !isNumber(team.points) || [team.interests, team.skills, team.technologies]
          .some((items) => !Array.isArray(items) || items.some((item) => typeof item !== 'string')))) invalidResponse(endpoint);
    return teams;
  },

  async getProposals(id: string): Promise<Proposal[]> {
    const endpoint = '/api/tasks/' + encodeURIComponent(id) + '/proposals';
    return readProposals(await requestJson<unknown>(endpoint), endpoint);
  },

  async getTeamProposals(teamId: string): Promise<TeamProposal[]> {
    const endpoint = '/api/proposals?' + new URLSearchParams({ team_id: teamId }).toString();
    return readProposals(await requestJson<unknown>(endpoint), endpoint).map((proposal) => ({ ...proposal,
      task: { id: proposal.task_id, title: proposal.task_title, topic: null } }));
  },

  async createProposal(id, input): Promise<Proposal> {
    const endpoint = '/api/tasks/' + encodeURIComponent(id) + '/proposals';
    return readProposal(await requestJson<unknown>(endpoint, { method: 'POST',
      body: { ...input, prototype_url: input.prototype_url.trim() || null } }), endpoint);
  },

  async updateProposalStatus(id, status): Promise<Proposal> {
    const endpoint = '/api/proposals/' + encodeURIComponent(id);
    return readProposal(await requestJson<unknown>(endpoint, { method: 'PATCH', body: { status } }), endpoint);
  },
};
