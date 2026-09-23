import type {
  AnalyzeDraftResponse,
  CatalogParams,
  CreateProposalInput,
  Proposal,
  ProposalStatus,
  PublishedTask,
  PublishResult,
  QuestionAnswer,
  ScoreResult,
  TaskCard,
  Team,
} from '../types';
import { mockApi } from './mockApi';

export interface TaskApi {
  analyzeDraft(input: { draft: string; topic: string }): Promise<AnalyzeDraftResponse>;
  buildTaskCard(input: { draft: string; topic: string; answers: QuestionAnswer[] }): Promise<{ card: TaskCard }>;
  confirmTaskCard(input: { card: TaskCard }): Promise<ScoreResult>;
  publishTask(input: { card: TaskCard }): Promise<PublishResult>;
  getCatalog(params?: CatalogParams): Promise<PublishedTask[]>;
  getTask(taskId: string): Promise<PublishedTask | null>;
  getTeams(): Promise<Team[]>;
  getProposals(taskId: string): Promise<Proposal[]>;
  createProposal(taskId: string, input: CreateProposalInput): Promise<Proposal>;
  updateProposalStatus(
    proposalId: string,
    status: Exclude<ProposalStatus, 'pending'>,
  ): Promise<Proposal>;
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isMockMode = import.meta.env.VITE_USE_MOCK_API !== 'false';

// В текущем checkout нет backend routes и schemas. До согласования контракта
// HTTP-режим сообщает об этом явно, не отправляя запросы на предполагаемые пути.
async function unavailable(): Promise<never> {
  throw new ApiError('Контракт FastAPI ещё не подключён. Используйте демонстрационный режим.');
}

const unavailableHttpApi: TaskApi = {
  analyzeDraft: unavailable,
  buildTaskCard: unavailable,
  confirmTaskCard: unavailable,
  publishTask: unavailable,
  getCatalog: unavailable,
  getTask: unavailable,
  getTeams: unavailable,
  getProposals: unavailable,
  createProposal: unavailable,
  updateProposalStatus: unavailable,
};

export const api: TaskApi = isMockMode ? mockApi : unavailableHttpApi;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Что-то пошло не так. Попробуйте ещё раз.';
}
