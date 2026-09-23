import {
  fieldDefinitions,
  type CardField,
  type MissingField,
  type Proposal,
  type PublishedTask,
  type ScoreBreakdownItem,
  type TaskCard,
  type Team,
} from '../types';

const STORE_KEY = 'asar:mock-store:v2';
const STORE_VERSION = 2;

interface MockStore {
  version: typeof STORE_VERSION;
  tasks: PublishedTask[];
  teams: Team[];
  proposals: Proposal[];
}

const weights: ReadonlyArray<{ field: CardField; maximum: number }> = [
  { field: 'context', maximum: 10 },
  { field: 'need', maximum: 10 },
  { field: 'data', maximum: 20 },
  { field: 'expected_result', maximum: 15 },
  { field: 'success_criteria', maximum: 15 },
  { field: 'constraints', maximum: 10 },
  { field: 'users', maximum: 10 },
  { field: 'contact', maximum: 5 },
  { field: 'interaction_format', maximum: 5 },
];

const labels = Object.fromEntries(
  fieldDefinitions.map(({ key, label }) => [key, label]),
) as Record<CardField, string>;

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

function createCard(values: Partial<TaskCard>): TaskCard {
  return { ...emptyCard(), ...values };
}

function readiness(score: number): Pick<PublishedTask, 'readiness_level' | 'readiness_label'> {
  if (score < 40) return { readiness_level: 'draft', readiness_label: 'Черновик' };
  if (score < 70) return { readiness_level: 'working', readiness_label: 'Рабочая' };
  if (score < 90) return { readiness_level: 'ready', readiness_label: 'Готовая' };
  return { readiness_level: 'priority', readiness_label: 'Приоритетная' };
}

function scoreCard(card: TaskCard): {
  score: number;
  score_breakdown: ScoreBreakdownItem[];
  missing_fields: MissingField[];
} {
  const score_breakdown = weights.map(({ field, maximum }) => {
    const filled = Boolean(card[field]?.trim());
    return {
      field,
      label: labels[field],
      earned: filled ? maximum : 0,
      maximum,
      reason: filled ? 'Поле заполнено и подтверждено' : 'Сведений пока недостаточно',
    };
  });
  const missing_fields = score_breakdown
    .filter(({ earned }) => earned === 0)
    .map(({ field, label, maximum }) => ({
      field,
      label,
      potential_points: maximum,
      recommendation: `Добавьте сведения в поле «${label}»`,
    }));
  return {
    score: score_breakdown.reduce((sum, item) => sum + item.earned, 0),
    score_breakdown,
    missing_fields,
  };
}

function createSeedTask(
  id: string,
  published_at: string,
  values: Partial<TaskCard> & Pick<TaskCard, 'title' | 'topic'>,
): PublishedTask {
  const card = createCard(values);
  const score = scoreCard(card);
  return {
    id,
    title: card.title ?? 'Без названия',
    topic: card.topic ?? 'Без темы',
    card,
    ...score,
    ...readiness(score.score),
    status: 'published',
    published_at,
  };
}

const seedTeams: Team[] = [
  { id: 'team-alpha', name: 'Team Alpha', interests: ['EdTech', 'AI'], skills: ['UX', 'NLP'], technologies: ['React', 'Python'] },
  { id: 'team-beta', name: 'Team Beta', interests: ['Аналитика', 'Образование'], skills: ['Data Science', 'Backend'], technologies: ['Python', 'PostgreSQL'] },
  { id: 'team-gamma', name: 'Team Gamma', interests: ['Инклюзия', 'Mobile'], skills: ['Исследования', 'Frontend'], technologies: ['React', 'TypeScript'] },
  { id: 'team-delta', name: 'Team Delta', interests: ['HR Tech', 'Автоматизация'], skills: ['Product', 'ML'], technologies: ['FastAPI', 'scikit-learn'] },
  { id: 'team-orion', name: 'Team Orion', interests: ['Контент', 'Геймификация'], skills: ['Дизайн', 'Fullstack'], technologies: ['Figma', 'React', 'Python'] },
];

const seedTasks: PublishedTask[] = [
  createSeedTask('task-ai-feedback', '2026-09-22T09:15:00.000Z', {
    title: 'AI-помощник для обратной связи по эссе',
    topic: 'Искусственный интеллект',
    data: 'Анонимизированные эссе и комментарии преподавателей за два семестра.',
    contact: 'Куратор проекта через общий чат.',
  }),
  createSeedTask('task-practice-dashboard', '2026-09-21T12:30:00.000Z', {
    title: 'Панель прогресса производственной практики',
    topic: 'Аналитика',
    context: 'Отчёты студентов собираются в таблицах и проверяются вручную.',
    data: 'Журналы практики и итоговые оценки в CSV.',
    expected_result: 'Единая панель с рисками отставания и краткими итогами.',
  }),
  createSeedTask('task-inclusive-map', '2026-09-20T08:00:00.000Z', {
    title: 'Карта доступности учебных корпусов',
    topic: 'Инклюзивное образование',
    context: 'Абитуриентам сложно заранее оценить доступность маршрута.',
    data: 'Планы корпусов, фотографии входов и результаты аудита.',
    expected_result: 'Интерактивная карта доступных маршрутов внутри кампуса.',
    success_criteria: 'Для каждого корпуса построен проверенный маршрут.',
    contact: 'Центр инклюзивного образования.',
  }),
  createSeedTask('task-mentor-matching', '2026-09-19T15:45:00.000Z', {
    title: 'Подбор наставников для проектных команд',
    topic: 'Карьерное развитие',
    context: 'Координатор вручную сопоставляет заявки команд и экспертов.',
    need: 'Сократить время подбора и сделать критерии соответствия понятными.',
    data: 'Анкеты наставников, описания проектов и доступные временные слоты.',
    constraints: 'Первая версия должна работать без доступа к персональным данным.',
    expected_result: 'Список подходящих наставников с объяснимыми причинами совпадения.',
    success_criteria: 'Не менее 70% команд выбирают наставника из первой тройки.',
  }),
  createSeedTask('task-learning-path', '2026-09-18T10:10:00.000Z', {
    title: 'Персональный маршрут подготовки к экзаменам',
    topic: 'Адаптивное обучение',
    context: 'Студенты используют разрозненные материалы и не видят пробелы.',
    need: 'Собрать короткий персональный план повторения по результатам диагностики.',
    users: 'Студенты первого курса и преподаватели дисциплин.',
    data: 'Банк заданий, темы курса и обезличенные результаты тестов.',
    constraints: 'Рекомендации должны объясняться и подтверждаться преподавателем.',
    expected_result: 'Недельный маршрут с приоритетами, заданиями и оценкой прогресса.',
    success_criteria: 'Не менее 80% рекомендованных шагов понятны студентам на тестировании.',
    interaction_format: 'Еженедельная консультация и проверка гипотез с методистом.',
  }),
];

const seedProposals: Proposal[] = [
  {
    id: 'proposal-1', task_id: 'task-ai-feedback', team_id: 'team-alpha', team_name: 'Team Alpha',
    idea: 'Прототип помощника с рубрикой и объяснением каждой рекомендации.',
    plan: 'Исследование примеров, прототип интерфейса, API-заглушка и тест на 20 эссе.',
    estimated_duration: '3 недели', prototype_url: 'https://example.com/alpha-feedback',
    status: 'pending', created_at: '2026-09-22T13:00:00.000Z',
  },
  {
    id: 'proposal-2', task_id: 'task-practice-dashboard', team_id: 'team-beta', team_name: 'Team Beta',
    idea: 'Дашборд с индикаторами риска и сводкой по группам.',
    plan: 'Схема данных, импорт CSV, метрики и интерактивный прототип.',
    estimated_duration: '4 недели', prototype_url: 'https://example.com/beta-dashboard',
    status: 'accepted', created_at: '2026-09-21T16:10:00.000Z',
  },
  {
    id: 'proposal-3', task_id: 'task-inclusive-map', team_id: 'team-gamma', team_name: 'Team Gamma',
    idea: 'Маршруты с пошаговыми подсказками и отметками препятствий.',
    plan: 'Полевое исследование, карта одного корпуса, тест доступности.',
    estimated_duration: '3 недели', prototype_url: 'https://example.com/gamma-map',
    status: 'pending', created_at: '2026-09-20T11:20:00.000Z',
  },
  {
    id: 'proposal-4', task_id: 'task-mentor-matching', team_id: 'team-delta', team_name: 'Team Delta',
    idea: 'Прозрачный подбор на основе навыков, тем и доступности.',
    plan: 'Матрица критериев, алгоритм ранжирования и кабинет координатора.',
    estimated_duration: '5 недель', prototype_url: 'https://example.com/delta-mentors',
    status: 'rejected', created_at: '2026-09-19T18:35:00.000Z',
  },
  {
    id: 'proposal-5', task_id: 'task-learning-path', team_id: 'team-orion', team_name: 'Team Orion',
    idea: 'Визуальный недельный план с понятным объяснением приоритетов.',
    plan: 'Сценарии, кликабельный прототип, проверка на учебной группе.',
    estimated_duration: '4 недели', prototype_url: 'https://example.com/orion-path',
    status: 'pending', created_at: '2026-09-18T14:00:00.000Z',
  },
];

function freshStore(): MockStore {
  return {
    version: STORE_VERSION,
    tasks: JSON.parse(JSON.stringify(seedTasks)) as PublishedTask[],
    teams: JSON.parse(JSON.stringify(seedTeams)) as Team[],
    proposals: JSON.parse(JSON.stringify(seedProposals)) as Proposal[],
  };
}

function isStore(value: unknown): value is MockStore {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MockStore>;
  return candidate.version === STORE_VERSION
    && Array.isArray(candidate.tasks)
    && Array.isArray(candidate.teams)
    && Array.isArray(candidate.proposals);
}

let memoryStore = freshStore();

export function readMockStore(): MockStore {
  if (typeof window === 'undefined') return memoryStore;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(memoryStore));
      return memoryStore;
    }
    const parsed: unknown = JSON.parse(raw);
    if (isStore(parsed)) {
      memoryStore = parsed;
      return parsed;
    }
  } catch {
    // Повреждённое или недоступное хранилище заменяется чистыми seed-данными.
  }
  memoryStore = freshStore();
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(memoryStore));
  } catch {
    // В приватном режиме приложение продолжит работать в памяти вкладки.
  }
  return memoryStore;
}

export function writeMockStore(store: MockStore): void {
  memoryStore = store;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Состояние остаётся доступно до закрытия вкладки.
  }
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

