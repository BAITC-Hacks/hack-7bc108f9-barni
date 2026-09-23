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
export type TaskStatus = 'draft' | 'published';
export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface ScoreBreakdown {
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

export interface Task {
  id: string;
  draft_text: string;
  topic: string;
  card: TaskCard | null;
  score: number;
  readiness_level: Readiness;
  score_breakdown: ScoreBreakdown[];
  missing_fields: MissingField[];
  status: TaskStatus;
  confirmed_at: string | null;
  published_at: string | null;
}

export interface AIQuestion {
  id: string;
  target_field: CardField;
  text: string;
}

export interface AnalyzeResult {
  known_fields: Partial<TaskCard>;
  missing_fields: CardField[];
  questions: AIQuestion[];
}

export interface Proposal {
  id: string;
  task_id: string;
  team_id: string;
  idea: string;
  plan: string;
  estimated_duration: string;
  prototype_url: string;
  status: ProposalStatus;
}

export interface Team {
  id: string;
  name: string;
}

export const demoTeams: Team[] = [
  { id: 'team-alpha', name: 'Team Alpha' },
  { id: 'team-beta', name: 'Team Beta' },
  { id: 'team-gamma', name: 'Team Gamma' },
  { id: 'team-delta', name: 'Team Delta' },
  { id: 'team-epsilon', name: 'Team Epsilon' },
];

export const readinessLabels: Record<Readiness, string> = {
  draft: 'Черновик',
  working: 'Рабочая',
  ready: 'Готовая',
  priority: 'Приоритетная',
};

export const proposalStatusLabels: Record<ProposalStatus, string> = {
  pending: 'На рассмотрении',
  accepted: 'Принято',
  rejected: 'Отклонено',
};
