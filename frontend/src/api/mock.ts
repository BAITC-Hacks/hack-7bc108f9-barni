import {
  demoTeams,
  fieldDefinitions,
  type AnalyzeResult,
  type CardField,
  type MissingField,
  type Proposal,
  type ProposalStatus,
  type Readiness,
  type ScoreBreakdown,
  type Task,
  type TaskCard,
} from '../types';

const STORAGE_KEY = 'barni-frontend-demo-v1';

interface Store {
  tasks: Task[];
  proposals: Proposal[];
}

const scoring = [
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

const labels = Object.fromEntries(fieldDefinitions.map(({ key, label }) => [key, label])) as Record<CardField, string>;

function emptyCard(title: string, topic: string): TaskCard {
  return {
    title,
    topic,
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

function scoreCard(card: TaskCard): {
  score: number;
  readiness_level: Readiness;
  score_breakdown: ScoreBreakdown[];
  missing_fields: MissingField[];
} {
  const score_breakdown = scoring.map(({ field, maximum }) => {
    const filled = Boolean(card[field]?.trim());
    return {
      field,
      label: labels[field],
      earned: filled ? maximum : 0,
      maximum,
      reason: filled ? 'Сведения указаны и подтверждены' : 'Сведения пока не указаны',
    };
  });
  const score = score_breakdown.reduce((sum, item) => sum + item.earned, 0);
  const readiness_level: Readiness = score < 40 ? 'draft' : score < 70 ? 'working' : score < 90 ? 'ready' : 'priority';
  const missing_fields = score_breakdown
    .filter((item) => item.earned === 0)
    .map(({ field, label, maximum }) => ({
      field,
      label,
      potential_points: maximum,
      recommendation: `Добавьте сведения в поле «${label}»`,
    }));
  return { score, readiness_level, score_breakdown, missing_fields };
}

function seedTask(id: string, title: string, topic: string, filled: CardField[], context: string): Task {
  const card = emptyCard(title, topic);
  for (const key of filled) {
    if (key === 'context') card.context = context;
    else if (key === 'need') card.need = 'Улучшить текущий процесс с помощью студенческой команды';
    else card[key] = `Сведения по полю «${labels[key]}» предоставлены бизнесом`;
  }
  return {
    id,
    draft_text: card.need ?? title,
    topic,
    card,
    ...scoreCard(card),
    status: 'published',
    confirmed_at: '2026-09-23T09:00:00.000Z',
    published_at: '2026-09-23T09:05:00.000Z',
  };
}

function initialStore(): Store {
  const tasks = [
    seedTask('seed-25', 'Улучшить работу с заявками', 'Автоматизация', ['context', 'need', 'contact'], 'Заявки поступают из нескольких каналов и обрабатываются вручную.'),
    seedTask('seed-45', 'Собрать аналитику обращений', 'Аналитика', ['context', 'need', 'data', 'contact'], 'Команда хочет видеть причины и скорость обработки обращений.'),
    seedTask('seed-65', 'Обновить базу знаний', 'Образование', ['context', 'need', 'data', 'expected_result', 'contact', 'interaction_format'], 'Материалы обучения разбросаны по нескольким источникам.'),
    seedTask('seed-80', 'Помочь с маршрутизацией заявок', 'Автоматизация', ['context', 'need', 'data', 'expected_result', 'success_criteria', 'constraints'], 'Заявки распределяются вручную между специалистами.'),
    seedTask('seed-95', 'Создать помощника для стажёров', 'Образование', ['context', 'need', 'data', 'expected_result', 'success_criteria', 'constraints', 'users', 'interaction_format'], 'Стажёры долго находят инструкции для типовых процессов.'),
  ];
  const proposals: Proposal[] = demoTeams.map((team, index) => ({
    id: `seed-proposal-${index + 1}`,
    task_id: tasks[index]?.id ?? 'seed-25',
    team_id: team.id,
    idea: 'Предлагаем проверить гипотезу на небольшом прототипе.',
    plan: 'Исследование, прототип, проверка с пользователями.',
    estimated_duration: '2 недели',
    prototype_url: '',
    status: 'pending',
  }));
  return { tasks, proposals };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'tasks' in parsed && 'proposals' in parsed &&
          Array.isArray(parsed.tasks) && Array.isArray(parsed.proposals)) return parsed as Store;
    }
  } catch {
    // В приватном режиме localStorage может быть недоступен.
  }
  return initialStore();
}

let store = load();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* Демо остаётся в памяти. */ }
}

function findTask(id: string): Task {
  const task = store.tasks.find((item) => item.id === id);
  if (!task) throw new Error('Задача не найдена');
  return task;
}

async function pause() { await new Promise((resolve) => setTimeout(resolve, 250)); }

export const mockApi = {
  async createTask(draft_text: string, topic: string): Promise<Task> {
    await pause();
    const task: Task = {
      id: crypto.randomUUID(), draft_text, topic, card: null, score: 0,
      readiness_level: 'draft', score_breakdown: [], missing_fields: [],
      status: 'draft', confirmed_at: null, published_at: null,
    };
    store.tasks.unshift(task);
    persist();
    return task;
  },
  async analyzeDraft(draft: string): Promise<AnalyzeResult> {
    await pause();
    if (!draft.trim()) throw new Error('Введите описание задачи');
    return {
      known_fields: { need: draft.trim() },
      missing_fields: ['context', 'users', 'data', 'constraints', 'expected_result', 'success_criteria', 'contact', 'interaction_format'],
      questions: [
        { id: 'q1', target_field: 'context', text: 'Как задача решается сейчас?' },
        { id: 'q2', target_field: 'data', text: 'Какие данные и материалы уже доступны?' },
        { id: 'q3', target_field: 'success_criteria', text: 'Какой измеримый результат будет считаться успешным?' },
      ],
    };
  },
  async buildCard(draft: string, answers: { question_id: string; answer: string }[]): Promise<{ card: TaskCard }> {
    await pause();
    const card = emptyCard(draft.trim().slice(0, 80), '');
    card.need = draft.trim();
    const mapping: Record<string, CardField> = { q1: 'context', q2: 'data', q3: 'success_criteria' };
    for (const { question_id, answer } of answers) {
      const field = mapping[question_id];
      if (field && answer.trim()) card[field] = answer.trim();
    }
    return { card };
  },
  async getTask(id: string): Promise<Task> { await pause(); return structuredClone(findTask(id)); },
  async confirmTask(id: string, card: TaskCard): Promise<Task> {
    await pause();
    const task = findTask(id);
    task.card = structuredClone(card);
    task.topic = card.topic?.trim() || task.topic;
    Object.assign(task, scoreCard(card));
    task.confirmed_at = new Date().toISOString();
    persist();
    return structuredClone(task);
  },
  async publishTask(id: string): Promise<Task> {
    await pause();
    const task = findTask(id);
    if (!task.confirmed_at) throw new Error('Сначала подтвердите карточку');
    task.status = 'published';
    task.published_at = new Date().toISOString();
    persist();
    return structuredClone(task);
  },
  async listTasks(topic: string, readiness: string): Promise<Task[]> {
    await pause();
    return store.tasks
      .filter((task) => task.status === 'published')
      .filter((task) => !topic || task.topic === topic)
      .filter((task) => !readiness || task.readiness_level === readiness)
      .sort((a, b) => b.score - a.score)
      .map((task) => structuredClone(task));
  },
  async createProposal(task_id: string, proposal: Omit<Proposal, 'id' | 'task_id' | 'status'>): Promise<Proposal> {
    await pause();
    findTask(task_id);
    const created: Proposal = { ...proposal, id: crypto.randomUUID(), task_id, status: 'pending' };
    store.proposals.unshift(created);
    persist();
    return structuredClone(created);
  },
  async listProposals(task_id: string): Promise<Proposal[]> {
    await pause();
    return store.proposals.filter((proposal) => proposal.task_id === task_id).map((proposal) => structuredClone(proposal));
  },
  async updateProposal(id: string, status: Exclude<ProposalStatus, 'pending'>): Promise<Proposal> {
    await pause();
    const proposal = store.proposals.find((item) => item.id === id);
    if (!proposal) throw new Error('Предложение не найдено');
    proposal.status = status;
    persist();
    return structuredClone(proposal);
  },
};
