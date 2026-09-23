import { Link } from 'react-router-dom';

function StepIcon({ kind }: { kind: 'write' | 'card' | 'team' }) {
  return <svg className="product-step-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'write' && <><path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/><path d="m16 3 5 5M10 14l-1 4 4-1L22 8a2 2 0 0 0-5-5Z"/></>}
    {kind === 'card' && <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h4m1 5 2 2 4-4M8 16h1"/></>}
    {kind === 'team' && <><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/></>}
  </svg>;
}

export default function ProductIntro() {
  return <section className="product-intro" aria-labelledby="product-title">
    <p className="product-intro__eyebrow">ASAR · Бизнес и студенческие команды</p>
    <h1 id="product-title">Опишите задачу бизнеса.<span>Найдите студенческую команду.</span></h1>
    <p className="product-intro__description">AI поможет уточнить детали и собрать понятную карточку задачи. Опубликуйте её, получите предложения студенческих команд и выберите, с кем работать.</p>
    <div className="product-intro__links">
      <a href="#how-it-works">Как это работает <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6"/></svg></a>
      <Link to="/catalog">Я из команды <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></Link>
    </div>
    <div className="product-intro__path" aria-label="От запроса бизнеса через помощь AI к совместному проекту">
      <span>Запрос бизнеса</span><span aria-hidden="true">→</span><span>Помощь AI</span><span aria-hidden="true">→</span><span>Совместный проект</span>
    </div>
  </section>;
}

export function ProductExplainer({ onStart }: { onStart: () => void }) {
  return <div className="product-explainer">
    <section className="product-how" id="how-it-works" aria-labelledby="how-title">
      <div className="product-section-heading">
        <p className="eyebrow">Как работает ASAR</p>
        <h2 id="how-title">От описания задачи<br/>до совместной работы</h2>
        <p>Бизнес приносит реальный запрос. Студенты получают возможность применить знания на практике.</p>
      </div>
      <ol className="product-steps">
        <li><span className="product-step-number">01</span><StepIcon kind="write"/><h3>Расскажите о задаче</h3><p>Что происходит сейчас и что вы хотите изменить? Начните своими словами — AI задаст вопросы по недостающим деталям.</p></li>
        <li><span className="product-step-number">02</span><StepIcon kind="card"/><h3>Проверьте и опубликуйте</h3><p>AI соберёт карточку. Вы проверите факты, отредактируете поля и увидите, насколько задача готова к работе.</p></li>
        <li><span className="product-step-number">03</span><StepIcon kind="team"/><h3>Выберите команду</h3><p>Студенты предложат идею, план и сроки. Рассмотрите отклики и примите решение по каждому предложению.</p></li>
      </ol>
    </section>

    <section className="product-rating" aria-labelledby="rating-explained-title">
      <div>
        <p className="eyebrow">Понятные условия с самого начала</p>
        <h2 id="rating-explained-title">Видно, чего<br/>не хватает задаче</h2>
        <p>Рейтинг от 0 до 100 показывает полноту подтверждённых сведений: контекст, данные, ожидаемый результат и условия работы. В карточке видно, за что начислены баллы и что ещё можно уточнить.</p>
        <small>С любым рейтингом можно публиковать задачу и получать отклики.</small>
      </div>
      <div className="rating-example" aria-label="Пример заполнения карточки задачи">
        <span className="rating-example__label">Пример карточки</span>
        <h3>Упростить обучение<br/>новых сотрудников</h3>
        <ul>
          <li><span>Контекст задачи</span><small>Указан <span aria-hidden="true">✓</span></small></li>
          <li><span>Ожидаемый результат</span><small>Указан <span aria-hidden="true">✓</span></small></li>
          <li className="is-missing"><span>Данные и материалы</span><small>Нужно уточнить <span aria-hidden="true">+</span></small></li>
        </ul>
      </div>
    </section>

    <section className="product-final" aria-labelledby="team-entry-title">
      <div><p className="eyebrow">Для студенческих команд</p><h2 id="team-entry-title">Знаниям нужна практика.<br/>Бизнесу — ваше решение.</h2><p>Найдите задачу в каталоге, изучите условия и предложите свой подход.</p></div>
      <div className="product-final__actions"><Link className="button button-primary" to="/catalog">Смотреть задачи <span aria-hidden="true">↗</span></Link><button className="button button-secondary" type="button" onClick={onStart}>У меня есть задача</button></div>
    </section>
    <footer className="product-footer"><strong>ASAR</strong><span>Реальные задачи. Совместный опыт.</span><button type="button" onClick={onStart}>К описанию задачи <span aria-hidden="true">↑</span></button></footer>
  </div>;
}
