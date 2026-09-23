import type { ScoreResult } from '../types';

interface Props {
  result: ScoreResult;
}

export default function ScorePanel({ result }: Props) {
  const potential = result.missing_fields.reduce((total, item) => total + item.potential_points, 0);
  return <section className="score-panel" aria-label="Рейтинг задачи">
    <div className="score-head">
      <div><p className="eyebrow">Готовность задачи</p><h2>Прозрачный рейтинг</h2></div>
      <span className={'readiness readiness--' + result.readiness_level}>{result.readiness_label}</span>
    </div>
    <div className="score-overview">
      <div className="score-dial" style={{ '--score': result.score + '%' } as React.CSSProperties}>
        <div className="score-dial__inner"><strong>{result.score}</strong><span>/ 100</span></div>
      </div>
      <div className="score-summary">
        <strong>{result.score >= 70 ? 'Задача хорошо подготовлена' : 'Карточку можно усилить'}</strong>
        <p>Рейтинг отражает подтверждённые сведения. Пустые поля не мешают публикации.</p>
        <span>{potential ? 'Потенциал роста: ' + potential + ' баллов' : 'Все критерии заполнены'}</span>
      </div>
    </div>
    <div className="score-progress" role="progressbar" aria-label="Рейтинг задачи"
      aria-valuenow={result.score} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: result.score + '%' }} />
    </div>
    <div className="score-breakdown">
      <h3>За что начислены баллы</h3>
      {result.breakdown.map((item) => <div className="score-row" key={item.field}>
        <div><span>{item.label}</span><small>{item.reason}</small></div>
        <strong className={item.earned ? 'score-earned' : 'score-empty'}>{item.earned} / {item.maximum}</strong>
      </div>)}
    </div>
    <div className="missing-list">
      <h3>Что ещё можно добавить</h3>
      {result.missing_fields.length ? result.missing_fields.map((item) => <div className="missing-item" key={item.field}>
        <span className="missing-plus">+</span>
        <div><strong>{item.label}</strong><p>{item.recommendation}</p></div>
        <b>+{item.potential_points}</b>
      </div>) : <p className="muted">Карточка заполнена по всем критериям.</p>}
    </div>
  </section>;
}
