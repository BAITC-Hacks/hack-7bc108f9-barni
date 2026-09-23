import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, errorMessage } from '../api';
import ScorePanel from '../components/ScorePanel';
import TaskCardEditor from '../components/TaskCardEditor';
import type { AnalyzeResult, CardField, Task, TaskCard } from '../types';

type Busy = 'analyzing' | 'building' | 'confirming' | 'publishing' | null;

const steps = ['Описание', 'Вопросы AI', 'Карточка', 'Публикация'];

export default function CreatePage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [topic, setTopic] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [card, setCard] = useState<TaskCard | null>(null);
  const [confirmed, setConfirmed] = useState<Task | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);

  const activeStep = published ? 3 : card ? 2 : analysis ? 1 : 0;

  async function analyze() {
    if (!draft.trim() || !topic.trim()) { setError('Заполните описание и тему задачи.'); return; }
    setBusy('analyzing'); setError('');
    try {
      let id = taskId;
      if (!id) {
        const task = await api.createTask(draft.trim(), topic.trim());
        id = task.id;
        setTaskId(id);
      }
      const result = await api.analyzeDraft(draft.trim(), topic.trim());
      if (!Array.isArray(result.questions) || result.questions.length < 3 ||
          result.questions.some((question) => !question.text?.trim() || !result.missing_fields?.includes(question.target_field))) {
        throw new Error('AI вернул неполные вопросы. Попробуйте ещё раз.');
      }
      setAnalysis(result);
      setCard(null);
      setConfirmed(null);
      setPublished(false);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  async function buildCard() {
    if (!analysis) return;
    setBusy('building'); setError('');
    try {
      const result = await api.buildCard(draft.trim(), analysis.questions.map((question) => ({
        question_id: question.id, answer: answers[question.id]?.trim() ?? '',
      })));
      const values = Object.fromEntries([
        ['title', null], ['topic', null], ['context', null], ['need', null], ['users', null], ['data', null],
        ['constraints', null], ['expected_result', null], ['success_criteria', null], ['contact', null], ['interaction_format', null],
      ]) as TaskCard;
      for (const key of Object.keys(values) as CardField[]) {
        const value = result.card?.[key];
        values[key] = typeof value === 'string' ? value : null;
      }
      values.topic = values.topic || topic.trim();
      setCard(values);
      setDirty(true);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  function updateCard(field: CardField, value: string) {
    if (!card) return;
    setCard({ ...card, [field]: value });
    setDirty(true);
  }

  async function confirm() {
    if (!taskId || !card) return;
    if (!card.title?.trim() || !card.topic?.trim()) { setError('Укажите название и тему задачи.'); return; }
    setBusy('confirming'); setError('');
    try {
      const task = await api.confirmTask(taskId, card);
      setConfirmed(task);
      setDirty(false);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  async function publish() {
    if (!taskId || !confirmed || dirty) return;
    setBusy('publishing'); setError('');
    try {
      await api.publishTask(taskId);
      setPublished(true);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  return <div className="page-width create-page">
    <div className="page-topline"><span className="eyebrow">Рабочее пространство бизнеса</span><span>От идеи до понятной задачи</span></div>
    <div className="page-heading">
      <div><h1>Создать задачу</h1><p>Начните с нескольких строк. AI поможет уточнить пробелы, а вы подтвердите итоговую карточку.</p></div>
      <div className="heading-art" aria-hidden="true"><span className="art-circle art-circle-one"/><span className="art-circle art-circle-two"/><span className="art-cross">✳</span></div>
    </div>
    <ol className="stepper" aria-label="Этапы создания задачи">
      {steps.map((step, index) => <li key={step} className={index === activeStep ? 'current' : index < activeStep ? 'done' : ''}>
        <span>{index < activeStep ? '✓' : `0${index + 1}`}</span>{step}</li>)}
    </ol>
    <div className="workspace-grid">
      <div className="workspace-main">
        {!analysis && <section className="surface-section">
          <div className="section-heading"><span className="section-index">01</span><div><h2>Расскажите о задаче</h2><p>Можно написать свободным текстом. Необязательно знать все детали заранее.</p></div></div>
          <label className="field"><span>Тема</span><input value={topic} onChange={(event) => { setTopic(event.target.value); setTaskId(null); }} placeholder="Например, автоматизация" disabled={busy !== null} /></label>
          <label className="field"><span>Описание задачи</span><textarea className="draft-input" rows={7} value={draft} onChange={(event) => { setDraft(event.target.value); setTaskId(null); }} placeholder="Например: хотим улучшить обработку заявок клиентов…" disabled={busy !== null} /></label>
          <div className="action-row"><button className="button button-primary" type="button" onClick={analyze} disabled={busy !== null}>{busy === 'analyzing' ? 'Анализируем…' : 'Проанализировать'} <span aria-hidden="true">↗</span></button><span className="action-note">AI не добавляет неизвестные факты</span></div>
        </section>}

        {analysis && !card && <section className="surface-section">
          <div className="section-heading"><span className="section-index">02</span><div><h2>Уточним детали</h2><p>Ответы помогут сделать карточку полезной для студенческих команд.</p></div></div>
          <div className="question-list">{analysis.questions.map((question, index) => <label className="question" key={question.id}>
            <span className="question-number">0{index + 1}</span><span className="question-body"><strong>{question.text}</strong><textarea rows={3} value={answers[question.id] ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} placeholder="Ваш ответ, если информация уже известна" disabled={busy !== null}/></span>
          </label>)}</div>
          <div className="action-row"><button className="button button-primary" type="button" onClick={buildCard} disabled={busy !== null}>{busy === 'building' ? 'Собираем карточку…' : 'Сформировать карточку'} <span aria-hidden="true">↗</span></button><button className="button button-text" type="button" onClick={() => setAnalysis(null)} disabled={busy !== null}>Назад к описанию</button></div>
        </section>}

        {card && !published && <section className="surface-section">
          <div className="section-heading"><span className="section-index">03</span><div><h2>Проверьте карточку</h2><p>Каждое поле можно изменить. Пустые поля останутся видимыми как пробелы.</p></div></div>
          <TaskCardEditor card={card} onChange={updateCard} disabled={busy !== null} />
          <div className="action-row action-row--bordered"><button className="button button-primary" type="button" onClick={confirm} disabled={busy !== null}>{busy === 'confirming' ? 'Пересчитываем…' : confirmed ? 'Подтвердить и пересчитать' : 'Подтвердить и рассчитать'}</button>{confirmed && dirty && <span className="inline-warning">Есть изменения — рейтинг нужно пересчитать</span>}</div>
        </section>}

        {published && confirmed && <section className="success-panel" role="status"><span className="success-icon">✓</span><p className="eyebrow">Готово</p><h2>Задача опубликована</h2><p>Команды увидят её в общем каталоге. Рейтинг не ограничивает доступ к отклику.</p><div className="action-row"><button className="button button-primary" type="button" onClick={() => navigate(`/tasks/${taskId}`)}>Открыть задачу <span aria-hidden="true">↗</span></button><Link className="button button-secondary" to="/catalog">Перейти в каталог</Link></div></section>}

        {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Закрыть сообщение">×</button></div>}
      </div>
      <aside className="workspace-aside">
        {confirmed ? <><ScorePanel task={confirmed} /><div className="aside-action"><button className="button button-primary button-full" type="button" onClick={publish} disabled={busy !== null || dirty || published}>{busy === 'publishing' ? 'Публикуем…' : published ? 'Опубликовано' : 'Опубликовать задачу'}</button><small>Опубликовать можно после подтверждения карточки. Минимального рейтинга нет.</small></div></> : <div className="guide-panel"><span className="guide-mark">✳</span><p className="eyebrow">Как это работает</p><h2>Чёткая задача получает больше внимания</h2><p>AI поможет задать правильные вопросы. Вы решаете, какие сведения верны, и можете изменить любое поле.</p><div className="guide-points"><div><span>01</span>Опишите запрос своими словами</div><div><span>02</span>Ответьте на вопросы AI</div><div><span>03</span>Подтвердите и опубликуйте</div></div></div>}
      </aside>
    </div>
  </div>;
}
