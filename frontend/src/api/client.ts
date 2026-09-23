import type {
  AnalyzeDraftResponse,
  BuildTaskCardInput,
  BuildTaskCardResponse,
  CatalogParams,
  CatalogTask,
  CreateProposalInput,
  CreateTaskResult,
  DraftInput,
  MetaResponse,
  Proposal,
  ProposalStatus,
  PublishedTask,
  PublishResult,
  ScoreResult,
  TaskCard,
  Team,
  TeamProposal,
} from '../types';
import { httpApi } from './httpApi';

export interface TaskApi {
  getMeta(): Promise<MetaResponse>;
  createTask(input: DraftInput): Promise<CreateTaskResult>;
  analyzeDraft(input: DraftInput): Promise<AnalyzeDraftResponse>;
  buildTaskCard(input: BuildTaskCardInput): Promise<BuildTaskCardResponse>;
  previewRating(input: { card: TaskCard }): Promise<ScoreResult>;
  confirmTaskCard(input: { taskId: string; card: TaskCard }): Promise<ScoreResult>;
  publishTask(input: { taskId: string }): Promise<PublishResult>;
  getCatalog(params?: CatalogParams): Promise<CatalogTask[]>;
  getTask(taskId: string): Promise<PublishedTask | null>;
  getTeams(): Promise<Team[]>;
  getProposals(taskId: string): Promise<Proposal[]>;
  getTeamProposals(teamId: string): Promise<TeamProposal[]>;
  createProposal(taskId: string, input: CreateProposalInput): Promise<Proposal>;
  updateProposalStatus(
    proposalId: string,
    status: Exclude<ProposalStatus, 'pending'>,
  ): Promise<Proposal>;
}

export { ApiError } from './httpApi';
export const api: TaskApi = httpApi;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Что-то пошло не так. Попробуйте ещё раз.';
}
