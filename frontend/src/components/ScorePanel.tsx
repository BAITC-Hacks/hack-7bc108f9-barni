import { readinessLabels, type Task } from '../types';

interface Props {
  task: Task;
  compact?: boolean;
}

export default function ScorePanel({ task, compact = false }: Props) {
  const score = Number.isFinite(task.score) ? task.score : 0;
  const percent = Math.min(100, Math.max(0, score));
  return (
    <section className={`score-panel ${compact ? 'score-panel--compact' : ''}`} aria-label="Рейтинг задачи">
      <div className="score-head">
        <div>
          <p className="eyebrow">Готовность задачи</p>
          <h2>Прозрачный рейтинг</h2>
        </div>
        <span className={`readiness readiness--${task.readiness_level}`}>{readinessLabels[task.readiness_level]}</span>
      </div>
      <div className="score-overview">
        <div className="score-dial" style={{ '--score': `${percent}%` } as React.CSSProperties}>
          <div className="score-dial__inner"><strong>{score}</strong><span>/ 100</span></div>
        </div>
        <div className="score-summary">
          <strong>{score >= 70 ? 'Задача хорошо подготовлена' : 'Карточку можно усилить'}</strong>
          <p>Баллы начисляются за подтверждённые сведения. Пустые поля видны командам и не мешают публикации.</p>
          <span>{task.missing_fields.length === 0 ? 'Все критерии заполнены' : `Потенциал роста: ${task.missing_fields.reduce((sum, item) => sum + item.potential_points, 0)} баллов`}</span>
        </div>
      </div>
      {!compact && <>
        <div className="score-breakdown">
          <h3>За что начислены баллы</h3>
          {task.score_breakdown.map((item) => (
            <div className="score-row" key={item.field}>
              <div><span>{item.label}</span><small>{item.reason}</small></div>
              <strong className={item.earned ? 'score-earned' : 'score-empty'}>{item.earned} / {item.maximum}</strong>
            </div>
          ))}
        </div>
        <div className="missing-list">
          <h3>Что ещё можно добавить</h3>
          {task.missing_fields.length ? task.missing_fields.map((item) => (
            <div className="missing-item" key={item.field}>
              <span className="missing-plus">+</span>
              <div><strong>{item.label}</strong><p>{item.recommendation}</p></div>
              <b>+{item.potential_points}</b>
            </div>
          )) : <p className="muted">Карточка заполнена по всем критериям.</p>}
        </div>
      </>}
    </section>
  );
}
