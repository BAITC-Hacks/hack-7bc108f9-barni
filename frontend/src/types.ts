export const fieldDefinitions = [
  { key: 'title', label: 'Название задачи', placeholder: 'Кратко и понятно' },
  { key: 'topic', label: 'Тема', placeholder: 'Например, автоматизация' },
  { key: 'context', label: 'Контекст и текущая ситуация', placeholder: 'Что происходит сейчас?' },
  { key: 'need', label: 'Потребность', placeholder: 'Что требуется изменить?' },
  { key: 'users', label: 'Пользователи', placeholder: 'Для кого создаётся решение?' },
  { key: 'data', label: 'Данные и материалы', placeholder: 'Какие данные доступны?' },
  { key: 'constraints', label: 'Ограничения', placeholder: 'Сроки, технологии и доступы' },
  { key: 'expected_result', label: 'Ожидаемый результат', placeholder: 'Какой результат нужен бизнесу?' },
  { key: 'success_criteria', label: 'Критерии успеха', placeholder: 'Как измерить результат?' },
  { key: 'contact', label: 'Контакт', placeholder: 'Как связаться с представителем?' },
  { key: 'interaction_format', label: 'Формат взаимодействия', placeholder: 'Как проходят консультации и обратная связь?' },
] as const;

export type CardField = (typeof fieldDefinitions)[number]['key'];
export type TaskCard = Record<CardField, string | null>;
export type Readiness = 'draft' | 'working' | 'ready' | 'priority';
export type ReadinessLevel = Readiness;
export type CatalogSort = 'score_desc' | 'score_asc' | 'newest';

export interface ClarifyingQuestion {
  id: string;
  target_field: CardField;
  text: string;
}

export interface AnalyzeDraftResponse {
  known_fields: Partial<TaskCard>;
  missing_fields: CardField[];
  questions: ClarifyingQuestion[];
}

export interface QuestionAnswer {
  question_id: string;
  target_field: CardField;
  answer: string;
}

export interface ScoreBreakdownItem {
  field: CardField;
  label: string;
  earned: number;
  maximum: number;
  reason: string;
}

export interface MissingField {
  field: CardField;
  label: string;
  potential_points: number;
  recommendation: string;
}

export interface ScoreResult {
  score: number;
  readiness_level: Readiness;
  readiness_label: string;
  breakdown: ScoreBreakdownItem[];
  missing_fields: MissingField[];
}

export interface PublishResult {
  task_id: string;
  status: 'published';
}

export interface CatalogParams {
  topic?: string;
  readiness_level?: ReadinessLevel;
  sort?: CatalogSort;
}

export interface PublishedTask {
  id: string;
  title: string;
  topic: string;
  card: TaskCard;
  score: number;
  readiness_level: ReadinessLevel;
  readiness_label: string;
  score_breakdown: ScoreBreakdownItem[];
  missing_fields: MissingField[];
  status: 'published';
  published_at: string;
}

export interface Team {
  id: string;
  name: string;
  interests: string[];
  skills: string[];
  technologies: string[];
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface Proposal {
  id: string;
  task_id: string;
  team_id: string;
  team_name: string;
  idea: string;
  plan: string;
  estimated_duration: string;
  prototype_url: string;
  status: ProposalStatus;
  created_at: string;
}

export interface CurrentDemoRole {
  type: 'business' | 'team';
  team_id?: string;
  label: string;
}

export interface CreateProposalInput {
  team_id: string;
  idea: string;
  plan: string;
  estimated_duration: string;
  prototype_url: string;
}
