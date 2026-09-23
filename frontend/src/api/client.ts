import type {
  AnalyzeDraftResponse,
  BuildTaskCardInput,
  CatalogParams,
  CreateProposalInput,
  Proposal,
  ProposalStatus,
  PublishedTask,
  PublishResult,
  ScoreResult,
  TaskCard,
  Team,
} from '../types';
import { httpApi } from './httpApi';
import { mockApi } from './mockApi';

export interface TaskApi {
  analyzeDraft(input: { draft: string; topic: string }): Promise<AnalyzeDraftResponse>;
  buildTaskCard(input: BuildTaskCardInput): Promise<{ card: TaskCard }>;
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

export { ApiError } from './httpApi';

export const isMockMode = import.meta.env.VITE_USE_MOCK_API !== 'false';
export const api: TaskApi = isMockMode ? mockApi : httpApi;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Что-то пошло не так. Попробуйте ещё раз.';
}
