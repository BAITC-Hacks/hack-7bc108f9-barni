import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api, errorMessage } from '../api';
import { readinessLabels, type Readiness, type Task } from '../types';

export default function CatalogPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topic, setTopic] = useState('');
  const [readiness, setReadiness] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.listTasks('', '').then((items) => { if (!cancelled) { setTasks(items); setError(''); } })
      .catch((caught) => { if (!cancelled) setError(errorMessage(caught)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const topics = useMemo(() => [...new Set(tasks.map((task) => task.topic).filter(Boolean))].sort(), [tasks]);
  const filtered = useMemo(() => tasks
    .filter((task) => !topic || task.topic === topic)
    .filter((task) => !readiness || task.readiness_level === readiness)
    .sort((a, b) => b.score - a.score), [tasks, topic, readiness]);

  return <div className="page-width catalog-page">
    <div className="page-topline"><span className="eyebrow">Открытый каталог</span><span>Опубликованные задачи доступны каждой команде</span></div>
    <div className="catalog-heading"><div><h1>Задачи для команд<span className="heading-period">.</span></h1><p>Выберите интересный вызов, изучите детали и предложите свой план.</p></div><span className="catalog-total">{tasks.length.toString().padStart(2, '0')} <small>задач</small></span></div>
    <div className="catalog-toolbar"><div className="filter-group"><label>Тема <select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">Все темы</option>{topics.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Готовность <select value={readiness} onChange={(event) => setReadiness(event.target.value)}><option value="">Любой уровень</option>{(Object.keys(readinessLabels) as Readiness[]).map((key) => <option key={key} value={key}>{readinessLabels[key]}</option>)}</select></label></div><span className="sort-caption">↓ По убыванию рейтинга</span></div>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Повторить</button></div>}
    {loading ? <div className="catalog-empty" role="status">Загружаем задачи…</div> : !error && filtered.length === 0 ? <div className="catalog-empty"><span>✳</span><h2>Задач пока нет</h2><p>{tasks.length ? 'Попробуйте изменить фильтры.' : 'После публикации задачи появятся здесь.'}</p>{tasks.length > 0 && <button className="button button-secondary" type="button" onClick={() => { setTopic(''); setReadiness(''); }}>Сбросить фильтры</button>}</div> : <div className="task-list">{filtered.map((task, index) => <article className="task-row" key={task.id}>
      <div className="task-row__index">{String(index + 1).padStart(2, '0')}</div>
      <div className="task-row__body"><div className="task-row__meta"><span className="topic-pill">{task.topic}</span><span>{readinessLabels[task.readiness_level]}</span></div><h2><Link to={`/tasks/${task.id}`}>{task.card?.title || 'Без названия'}</Link></h2><p>{task.card?.context || task.draft_text}</p><div className="task-row__foot"><span>{task.missing_fields.length ? `Можно уточнить: ${task.missing_fields.slice(0, 2).map((field) => field.label.toLowerCase()).join(', ')}` : 'Сведения заполнены'}</span></div></div>
      <div className="task-row__end"><div className="row-score"><strong>{task.score}</strong><span>/100</span></div><Link className="row-open" to={`/tasks/${task.id}`} aria-label={`Открыть задачу ${task.card?.title || ''}`}>↗</Link></div>
    </article>)}</div>}
  </div>;
}
