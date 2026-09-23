import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { CatalogSort, PublishedTask, ReadinessLevel } from '../types';

const readinessOptions: Array<{ value: ReadinessLevel; label: string }> = [
  { value: 'draft', label: 'Черновик' },
  { value: 'working', label: 'Рабочая' },
  { value: 'ready', label: 'Готовая' },
  { value: 'priority', label: 'Приоритетная' },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export default function CatalogPage() {
  const [tasks, setTasks] = useState<PublishedTask[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [readiness, setReadiness] = useState<ReadinessLevel | ''>('');
  const [sort, setSort] = useState<CatalogSort>('score_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

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
          const next = Array.from(new Set(result.map((task) => task.topic))).sort((a, b) => a.localeCompare(b, 'ru'));
          return next.length >= current.length ? next : current;
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
            {topics.map((item) => <option value={item} key={item}>{item}</option>)}
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
      {tasks.map((task, index) => <article className="task-row" key={task.id}>
        <div className="task-row__index">{String(index + 1).padStart(2, '0')}</div>
        <div>
          <div className="task-row__meta">
            <span className="topic-pill">{task.topic}</span>
            <span className={'readiness readiness--' + task.readiness_level}>{task.readiness_label}</span>
          </div>
          <h2><Link to={'/tasks/' + encodeURIComponent(task.id)}>{task.title}</Link></h2>
          <p><strong>Контекст:</strong> {task.card.context || 'Не указано'}</p>
          <p><strong>Результат:</strong> {task.card.expected_result || 'Не указано'}</p>
          <div className="task-row__foot">
            {task.missing_fields.length} недостающих полей · Опубликовано {formatDate(task.published_at)}
          </div>
        </div>
        <div className="task-row__end">
          <div className="row-score"><strong>{task.score}</strong><span>/100</span></div>
          <Link className="row-open" to={'/tasks/' + encodeURIComponent(task.id)} aria-label={'Открыть задачу «' + task.title + '»'}>↗</Link>
          <Link className="button button-secondary row-open-text" to={'/tasks/' + encodeURIComponent(task.id)}>Открыть задачу</Link>
        </div>
      </article>)}
    </div>}
  </div>;
}
