import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { CatalogSort, CatalogTask, CurrentDemoRole, ProposalStatus, ReadinessLevel, TeamProposal } from '../types';

const readinessOptions: Array<{ value: ReadinessLevel; label: string }> = [
  { value: 'draft', label: 'Черновик' },
  { value: 'working', label: 'Рабочая' },
  { value: 'ready', label: 'Готовая' },
  { value: 'priority', label: 'Приоритетная' },
];

interface TopicOption {
  slug: string;
  label: string;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function readinessLabel(value: ReadinessLevel): string {
  return readinessOptions.find((item) => item.value === value)?.label ?? value;
}

const proposalStatusLabels: Record<ProposalStatus, string> = {
  pending: 'На рассмотрении',
  accepted: 'Принято',
  rejected: 'Отклонено',
};

export default function CatalogPage({ role }: { role: CurrentDemoRole }) {
  const [tasks, setTasks] = useState<CatalogTask[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topic, setTopic] = useState('');
  const [readiness, setReadiness] = useState<ReadinessLevel | ''>('');
  const [sort, setSort] = useState<CatalogSort>('score_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [teamProposals, setTeamProposals] = useState<TeamProposal[]>([]);
  const [teamProposalsLoading, setTeamProposalsLoading] = useState(false);
  const [teamProposalsError, setTeamProposalsError] = useState('');
  const [teamProposalsReload, setTeamProposalsReload] = useState(0);

  useEffect(() => {
    if (role.type !== 'team' || !role.team_id) {
      setTeamProposals([]);
      setTeamProposalsLoading(false);
      setTeamProposalsError('');
      return;
    }

    let active = true;
    setTeamProposals([]);
    setTeamProposalsLoading(true);
    setTeamProposalsError('');
    api.getTeamProposals(role.team_id).then((result) => {
      if (active) setTeamProposals(result);
    }).catch((caught) => {
      if (active) setTeamProposalsError(errorMessage(caught));
    }).finally(() => {
      if (active) setTeamProposalsLoading(false);
    });
    return () => { active = false; };
  }, [role.type, role.team_id, teamProposalsReload]);

  useEffect(() => {
    let active = true;
    api.getMeta().then((meta) => {
      if (active) setTopics((current) => {
        const options = new Map(current.map((item) => [item.slug, item]));
        meta.topics.forEach((item) => options.set(item.slug, item));
        return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
      });
    }).catch(() => {
      // Catalog still works if the optional topic labels cannot be loaded.
    });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getCatalog({
      topic: topic || undefined,
      readiness_level: readiness || undefined,
      sort,
    }).then((result) => {
      if (!active) return;
      setTasks(result);
      if (!topic && !readiness) {
        setTopics((current) => {
          const options = new Map(current.map((item) => [item.slug, item]));
          result.forEach((task) => {
            if (task.topic && !options.has(task.topic)) {
              options.set(task.topic, { slug: task.topic, label: task.topic });
            }
          });
          return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
        });
      }
    }).catch((caught) => {
      if (active) setError(errorMessage(caught));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [topic, readiness, sort, reload]);

  function resetFilters() {
    setTopic('');
    setReadiness('');
    setSort('score_desc');
  }

  function topicLabel(value: string | null): string {
    if (!value) return 'Без темы';
    return topics.find((item) => item.slug === value)?.label ?? value;
  }

  return <div className="page-width catalog-page">
    <div className="page-topline">
      <span>Каталог задач</span>
      <span>Открытые задачи бизнеса для студенческих команд</span>
    </div>

    <section className="catalog-heading">
      <div>
        <p className="eyebrow">Возможности для команд</p>
        <h1>Задачи, которым нужен <span className="heading-period">результат.</span></h1>
        <p>Сравните контекст, готовность и ожидаемый результат. Низкий рейтинг показывает, какие сведения ещё можно уточнить.</p>
      </div>
      <div className="catalog-total" aria-label={'Найдено задач: ' + tasks.length}>
        {loading ? '—' : tasks.length}<small>задач найдено</small>
      </div>
    </section>

    <section className="catalog-toolbar" aria-label="Фильтры каталога">
      <div className="filter-group">
        <label>Тема
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="">Все темы</option>
            {topics.map((item) => <option value={item.slug} key={item.slug}>{item.label}</option>)}
          </select>
        </label>
        <label>Готовность
          <select value={readiness} onChange={(event) => setReadiness(event.target.value as ReadinessLevel | '')}>
            <option value="">Все уровни</option>
            {readinessOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>Сортировка
          <select value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)}>
            <option value="score_desc">Рейтинг: выше сначала</option>
            <option value="score_asc">Рейтинг: ниже сначала</option>
            <option value="newest">Сначала новые</option>
          </select>
        </label>
      </div>
      <button className="button button-secondary" type="button" onClick={resetFilters}>Сбросить фильтры</button>
    </section>

    {role.type === 'team' && role.team_id && <section className="surface-section" aria-labelledby="team-proposals-heading">
      <div className="section-heading">
        <span className="section-index">↗</span>
        <div>
          <h2 id="team-proposals-heading">Мои предложения</h2>
          <p>Предложения команды «{role.label}» и решения по ним.</p>
        </div>
      </div>
      {teamProposalsLoading
        ? <div className="inline-empty" role="status">Загружаем предложения…</div>
        : teamProposalsError
          ? <div className="error-banner" role="alert">
              Не удалось загрузить предложения: {teamProposalsError}
              <button className="button button-secondary" type="button" onClick={() => setTeamProposalsReload((value) => value + 1)}>Повторить</button>
            </div>
          : teamProposals.length === 0
            ? <div className="inline-empty">Команда ещё не отправила предложения.</div>
            : <div className="proposal-list">
                {teamProposals.map((proposal) => <article className="proposal-item" key={proposal.id}>
                  <div className="proposal-item__head">
                    <strong><Link to={'/tasks/' + encodeURIComponent(proposal.task_id)}>{proposal.task.title || 'Задача без названия'}</Link></strong>
                    <span className={'proposal-status proposal-status--' + proposal.status}>{proposalStatusLabels[proposal.status]}</span>
                  </div>
                  <p>{proposal.idea}</p>
                </article>)}
              </div>}
    </section>}

    {loading && <div className="catalog-state" role="status"><span className="loading-dot" />Загружаем задачи…</div>}

    {!loading && error && <div className="catalog-state catalog-state--error" role="alert">
      <strong>Не удалось загрузить каталог</strong>
      <p>{error}</p>
      <button className="button button-secondary" type="button" onClick={() => setReload((value) => value + 1)}>Повторить</button>
    </div>}

    {!loading && !error && tasks.length === 0 && <div className="catalog-empty">
      <span aria-hidden="true">○</span>
      <h2>По этим фильтрам задач нет</h2>
      <p>Сбросьте фильтры, чтобы снова увидеть весь каталог.</p>
      <button className="button button-primary" type="button" onClick={resetFilters}>Сбросить фильтры</button>
    </div>}

    {!loading && !error && tasks.length > 0 && <div className="task-list">
      {tasks.map((task, index) => {
        const title = task.title || 'Задача без названия';
        const taskPath = '/tasks/' + encodeURIComponent(task.id);
        return <article className="task-row" key={task.id}>
          <div className="task-row__index">{String(index + 1).padStart(2, '0')}</div>
          <div>
            <div className="task-row__meta">
              <span className="topic-pill">{topicLabel(task.topic)}</span>
              <span className={'readiness readiness--' + task.readiness_level}>{readinessLabel(task.readiness_level)}</span>
            </div>
            <h2><Link to={taskPath}>{title}</Link></h2>
            <p><strong>Контекст:</strong> {task.context || 'Не указано'}</p>
            <div className="task-row__foot">
              {task.missing_fields.length} недостающих полей · Опубликовано {formatDate(task.published_at)}
            </div>
          </div>
          <div className="task-row__end">
            <div className="row-score"><strong>{task.score}</strong><span>/100</span></div>
            <Link className="row-open" to={taskPath} aria-label={'Открыть задачу «' + title + '»'}>↗</Link>
            <Link className="button button-secondary row-open-text" to={taskPath}>Открыть задачу</Link>
          </div>
        </article>;
      })}
    </div>}
  </div>;
}
