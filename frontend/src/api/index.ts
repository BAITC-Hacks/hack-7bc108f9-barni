import type { AnalyzeResult, Proposal, ProposalStatus, Task, TaskCard } from '../types';
import { mockApi } from './mock';

export const isMockMode = import.meta.env.VITE_USE_MOCK !== 'false';
const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Не удалось связаться с сервером. Проверьте подключение и повторите.');
  }
  if (!response.ok) {
    let message = `Ошибка сервера (${response.status})`;
    try {
      const data: unknown = await response.json();
      if (data && typeof data === 'object' && 'detail' in data) {
        const detail = data.detail;
        if (typeof detail === 'string') message = detail;
      }
    } catch { /* Ответ может не содержать JSON. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function json(body: unknown): RequestInit { return { method: 'POST', body: JSON.stringify(body) }; }

const httpApi = {
  createTask: (draft_text: string, topic: string) => request<Task>('/api/tasks', json({ draft_text, topic })),
  analyzeDraft: (draft: string, topic: string) => request<AnalyzeResult>('/api/ai/analyze-draft', json({ draft, topic })),
  buildCard: (draft: string, answers: { question_id: string; answer: string }[]) =>
    request<{ card: TaskCard }>('/api/ai/build-card', json({ draft, answers })),
  getTask: (id: string) => request<Task>(`/api/tasks/${encodeURIComponent(id)}`),
  confirmTask: (id: string, card: TaskCard) => request<Task>(`/api/tasks/${encodeURIComponent(id)}/confirm`, {
    method: 'PUT', body: JSON.stringify({ card }),
  }),
  publishTask: (id: string) => request<Task>(`/api/tasks/${encodeURIComponent(id)}/publish`, json({})),
  listTasks: async (topic: string, readiness: string) => {
    const params = new URLSearchParams({ status: 'published', sort: 'score_desc' });
    if (topic) params.set('topic', topic);
    if (readiness) params.set('readiness', readiness);
    const data = await request<Task[] | { items: Task[] }>(`/api/tasks?${params}`);
    return Array.isArray(data) ? data : data.items;
  },
  createProposal: (task_id: string, proposal: Omit<Proposal, 'id' | 'task_id' | 'status'>) =>
    request<Proposal>(`/api/tasks/${encodeURIComponent(task_id)}/proposals`, json(proposal)),
  listProposals: async (task_id: string) => {
    const data = await request<Proposal[] | { items: Proposal[] }>(`/api/tasks/${encodeURIComponent(task_id)}/proposals`);
    return Array.isArray(data) ? data : data.items;
  },
  updateProposal: (id: string, status: Exclude<ProposalStatus, 'pending'>) =>
    request<Proposal>(`/api/proposals/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const api = isMockMode ? {
  ...mockApi,
  analyzeDraft: (draft: string, _topic: string) => mockApi.analyzeDraft(draft),
} : httpApi;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Что-то пошло не так. Попробуйте ещё раз.';
}
