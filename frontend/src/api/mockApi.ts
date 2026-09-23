import {
  fieldDefinitions,
  type AnalyzeDraftResponse,
  type CardField,
  type CreateProposalInput,
  type Proposal,
  type ProposalStatus,
  type PublishResult,
  type PublishedTask,
  type ScoreResult,
  type TaskCard,
} from '../types';
import type { TaskApi } from './client';
import { createId, readMockStore, writeMockStore } from './mockStore';

const weights = [
  { field: 'context', maximum: 10 },
  { field: 'need', maximum: 10 },
  { field: 'data', maximum: 20 },
  { field: 'expected_result', maximum: 15 },
  { field: 'success_criteria', maximum: 15 },
  { field: 'constraints', maximum: 10 },
  { field: 'users', maximum: 10 },
  { field: 'contact', maximum: 5 },
  { field: 'interaction_format', maximum: 5 },
] as const;

const labels = Object.fromEntries(
  fieldDefinitions.map(({ key, label }) => [key, label]),
) as Record<CardField, string>;

const readinessLabels = {
  draft: 'Черновик',
  working: 'Рабочая',
  ready: 'Готовая',
  priority: 'Приоритетная',
} as const;

interface ConfirmedSnapshot {
  serializedCard: string;
  score: ScoreResult;
  taskId: string | null;
}

let confirmedSnapshot: ConfirmedSnapshot | null = null;

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 280));
}

function meaningful(value: string | null): boolean {
  if (!value) return false;
  const characters = value.trim().replace(/[^\p{L}\p{N}]/gu, '');
  return characters.length >= 3;
}

function emptyCard(): TaskCard {
  return {
    title: null,
    topic: null,
    context: null,
    need: null,
    users: null,
    data: null,
    constraints: null,
    expected_result: null,
    success_criteria: null,
    contact: null,
    interaction_format: null,
  };
}

function calculateScore(card: TaskCard): ScoreResult {
  const breakdown = weights.map(({ field, maximum }) => {
    const filled = meaningful(card[field]);
    return {
      field,
      label: labels[field],
      earned: filled ? maximum : 0,
      maximum,
      reason: filled ? 'Поле заполнено и подтверждено' : 'Сведений пока недостаточно',
    };
  });
  const score = breakdown.reduce((total, item) => total + item.earned, 0);
  const readiness_level = score < 40 ? 'draft' : score < 70 ? 'working' : score < 90 ? 'ready' : 'priority';
  return {
    score,
    readiness_level,
    readiness_label: readinessLabels[readiness_level],
    breakdown,
    missing_fields: breakdown
      .filter((item) => item.earned === 0)
      .map(({ field, label, maximum }) => ({
        field,
        label,
        potential_points: maximum,
        recommendation: `Добавьте сведения в поле «${label}»`,
      })),
  };
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const mockApi: TaskApi = {
  async analyzeDraft({ draft, topic }): Promise<AnalyzeDraftResponse> {
    await delay();
    if (!meaningful(draft)) throw new Error('Опишите задачу хотя бы несколькими словами.');
    if (!meaningful(topic)) throw new Error('Укажите тему задачи.');
    confirmedSnapshot = null;
    return {
      known_fields: { need: draft.trim(), topic: topic.trim() },
      missing_fields: [
        'context', 'users', 'data', 'constraints', 'expected_result',
        'success_criteria', 'contact', 'interaction_format',
      ],
      questions: [
        { id: 'q1', target_field: 'context', text: 'Как задача решается сейчас и где возникает основная сложность?' },
        { id: 'q2', target_field: 'data', text: 'Какие данные и материалы доступны команде?' },
        { id: 'q3', target_field: 'success_criteria', text: 'Как вы измерите успешность результата?' },
      ],
    };
  },

  async buildTaskCard({ draft, topic, questions, answers }): Promise<{ card: TaskCard }> {
    await delay();
    if (!meaningful(draft) || !meaningful(topic)) throw new Error('Описание и тема обязательны.');
    if (questions.length < 3 || answers.length !== questions.length ||
        questions.some((question) => !answers.some((answer) =>
          answer.question_id === question.id &&
          answer.target_field === question.target_field &&
          Boolean(answer.answer.trim())))) {
      throw new Error('Ответьте на все уточняющие вопросы.');
    }
    const card = emptyCard();
    card.title = draft.trim().slice(0, 100);
    card.topic = topic.trim();
    card.need = draft.trim();
    for (const { target_field, answer } of answers) {
      if (target_field in card) card[target_field] = answer.trim();
    }
    return { card };
  },

  async confirmTaskCard({ card }): Promise<ScoreResult> {
    await delay();
    if (!meaningful(card.title) || !meaningful(card.topic)) {
      throw new Error('Укажите название и тему задачи.');
    }
    const score = calculateScore(card);
    confirmedSnapshot = {
      serializedCard: JSON.stringify(card),
      score,
      taskId: null,
    };
    return score;
  },

  async publishTask({ card }): Promise<PublishResult> {
    await delay();
    const serializedCard = JSON.stringify(card);
    if (!confirmedSnapshot || confirmedSnapshot.serializedCard !== serializedCard) {
      throw new Error('Сначала подтвердите текущую версию карточки.');
    }
    if (confirmedSnapshot.taskId) {
      return { task_id: confirmedSnapshot.taskId, status: 'published' };
    }
    const store = readMockStore();
    const taskId = createId('task');
    const task: PublishedTask = {
      id: taskId,
      title: card.title?.trim() || 'Без названия',
      topic: card.topic?.trim() || 'Без темы',
      card,
      score: confirmedSnapshot.score.score,
      readiness_level: confirmedSnapshot.score.readiness_level,
      readiness_label: confirmedSnapshot.score.readiness_label,
      score_breakdown: confirmedSnapshot.score.breakdown,
      missing_fields: confirmedSnapshot.score.missing_fields,
      status: 'published',
      published_at: new Date().toISOString(),
    };
    writeMockStore({ ...store, tasks: [task, ...store.tasks] });
    confirmedSnapshot.taskId = taskId;
    return { task_id: taskId, status: 'published' };
  },

  async getCatalog(params = {}) {
    await delay();
    const { topic, readiness_level, sort = 'score_desc' } = params;
    const tasks = readMockStore().tasks.filter((task) =>
      (!topic || task.topic === topic)
      && (!readiness_level || task.readiness_level === readiness_level)
    );
    return [...tasks].sort((left, right) => {
      if (sort === 'score_asc') return left.score - right.score;
      if (sort === 'newest') {
        return new Date(right.published_at).getTime() - new Date(left.published_at).getTime();
      }
      return right.score - left.score;
    });
  },

  async getTask(taskId) {
    await delay();
    return readMockStore().tasks.find(({ id }) => id === taskId) ?? null;
  },

  async getTeams() {
    await delay();
    return [...readMockStore().teams];
  },

  async getProposals(taskId) {
    await delay();
    return readMockStore().proposals
      .filter((proposal) => proposal.task_id === taskId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  },

  async createProposal(taskId: string, input: CreateProposalInput): Promise<Proposal> {
    await delay();
    const store = readMockStore();
    if (!store.tasks.some(({ id }) => id === taskId)) throw new Error('Задача не найдена.');
    const team = store.teams.find(({ id }) => id === input.team_id);
    if (!team) throw new Error('Команда не найдена.');
    if (![input.idea, input.plan, input.estimated_duration, input.prototype_url].every((value) => value.trim())) {
      throw new Error('Заполните все поля предложения.');
    }
    if (!validHttpUrl(input.prototype_url.trim())) {
      throw new Error('Укажите корректную ссылку с http:// или https://.');
    }
    const proposal: Proposal = {
      id: createId('proposal'),
      task_id: taskId,
      team_id: team.id,
      team_name: team.name,
      idea: input.idea.trim(),
      plan: input.plan.trim(),
      estimated_duration: input.estimated_duration.trim(),
      prototype_url: input.prototype_url.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    writeMockStore({ ...store, proposals: [proposal, ...store.proposals] });
    return proposal;
  },

  async updateProposalStatus(proposalId: string, status: ProposalStatus): Promise<Proposal> {
    await delay();
    const store = readMockStore();
    const current = store.proposals.find(({ id }) => id === proposalId);
    if (!current) throw new Error('Предложение не найдено.');
    const updated = { ...current, status };
    writeMockStore({
      ...store,
      proposals: store.proposals.map((proposal) => proposal.id === proposalId ? updated : proposal),
    });
    return updated;
  },
};
