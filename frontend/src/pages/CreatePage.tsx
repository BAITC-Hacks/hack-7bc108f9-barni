import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import ScorePanel from '../components/ScorePanel';
import TaskCardEditor from '../components/TaskCardEditor';
import type {
  AnalyzeDraftResponse, CardField, PublishResult, QuestionAnswer, ScoreResult, TaskCard,
} from '../types';

type Stage = 'draft' | 'questions' | 'card' | 'confirmed' | 'published';
type Busy = 'analyzing' | 'building' | 'confirming' | 'publishing' | null;

const steps = [
  { stage: 'draft', label: 'Описание' },
  { stage: 'questions', label: 'Вопросы AI' },
  { stage: 'card', label: 'Карточка' },
  { stage: 'confirmed', label: 'Рейтинг' },
  { stage: 'published', label: 'Публикация' },
] as const;

function ErrorNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return <div className="error-banner" role="alert"><span>{message}</span>
    <button type="button" onClick={onDismiss} aria-label="Закрыть сообщение">×</button>
  </div>;
}

export default function CreatePage() {
  const [stage, setStage] = useState<Stage>('draft');
  const [draft, setDraft] = useState('');
  const [topic, setTopic] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeDraftResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [card, setCard] = useState<TaskCard | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');

  const activeStep = steps.findIndex((item) => item.stage === stage);
  const allAnswered = Boolean(analysis?.questions.length) &&
    analysis!.questions.every((question) => Boolean(answers[question.id]?.trim()));

  async function analyze() {
    if (!draft.trim() || !topic.trim()) return;
    setBusy('analyzing'); setError('');
    try {
      const result = await api.analyzeDraft({ draft: draft.trim(), topic: topic.trim() });
      if (!Array.isArray(result.questions) || result.questions.length < 3 ||
          !Array.isArray(result.missing_fields) ||
          result.questions.some((question) => !question.id || !question.text?.trim() ||
            !result.missing_fields.includes(question.target_field))) {
        throw new Error('AI вернул неполные вопросы. Попробуйте ещё раз.');
      }
      setAnalysis(result);
      setAnswers({});
      setCard(null);
      setScore(null);
      setStage('questions');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  async function buildCard() {
    if (!analysis || !allAnswered) return;
    const questionAnswers: QuestionAnswer[] = analysis.questions.map((question) => ({
      question_id: question.id,
      target_field: question.target_field,
      answer: (answers[question.id] ?? '').trim(),
    }));
    setBusy('building'); setError('');
    try {
      const result = await api.buildTaskCard({ draft: draft.trim(), topic: topic.trim(), questions: analysis.questions, answers: questionAnswers });
      if (!result.card || typeof result.card !== 'object') throw new Error('Не удалось получить карточку.');
      const fields: CardField[] = [
        'title', 'topic', 'context', 'need', 'users', 'data', 'constraints',
        'expected_result', 'success_criteria', 'contact', 'interaction_format',
      ];
      const safeCard = Object.fromEntries(fields.map((field) => {
        const value = result.card[field];
        return [field, typeof value === 'string' ? value : null];
      })) as TaskCard;
      safeCard.topic = safeCard.topic || topic.trim();
      setCard(safeCard);
      setScore(null);
      setStage('card');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  function updateCard(field: CardField, value: string) {
    if (!card) return;
    setCard({ ...card, [field]: value });
  }

  async function confirm() {
    if (!card) return;
    if (!card.title?.trim() || !card.topic?.trim()) {
      setError('Укажите название и тему задачи.');
      return;
    }
    setBusy('confirming'); setError('');
    try {
      const result = await api.confirmTaskCard({ card });
      if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100 ||
          !Array.isArray(result.breakdown) || !Array.isArray(result.missing_fields) ||
          result.breakdown.reduce((sum, item) => sum + item.earned, 0) !== result.score) {
        throw new Error('Сервер вернул некорректный рейтинг. Попробуйте ещё раз.');
      }
      setScore(result);
      setStage('confirmed');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  function returnToEdit() {
    setScore(null);
    setError('');
    setStage('card');
  }

  async function publish() {
    if (!card || !score || stage !== 'confirmed') return;
    setBusy('publishing'); setError('');
    try {
      const result = await api.publishTask({ card });
      if (!result.task_id || result.status !== 'published') {
        throw new Error('Сервер не подтвердил публикацию.');
      }
      setPublished(result);
      setStage('published');
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
      {steps.map((item, index) => <li key={item.stage} className={index === activeStep ? 'current' : index < activeStep ? 'done' : ''}>
        <span>{index < activeStep ? '✓' : '0' + (index + 1)}</span>{item.label}
      </li>)}
    </ol>
    <div className="workspace-grid">
      <div className="workspace-main">
        {stage === 'draft' && <section className="surface-section">
          <div className="section-heading"><span className="section-index">01</span><div><h2>Расскажите о задаче</h2><p>Можно написать свободным текстом. Необязательно знать все детали заранее.</p></div></div>
          <label className="field"><span>Тема</span><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Например, автоматизация" disabled={busy !== null} /></label>
          <label className="field"><span>Описание задачи</span><textarea className="draft-input" rows={7} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Например: хотим улучшить обработку заявок клиентов…" disabled={busy !== null} /></label>
          <div className="action-row"><button className="button button-primary" type="button" onClick={analyze} disabled={busy !== null || !draft.trim() || !topic.trim()}>{busy === 'analyzing' ? 'Анализируем…' : 'Проанализировать задачу'} <span aria-hidden="true">↗</span></button><span className="action-note">AI не добавляет неизвестные факты</span></div>
          <ErrorNotice message={error} onDismiss={() => setError('')} />
        </section>}

        {stage === 'questions' && analysis && <section className="surface-section">
          <div className="section-heading"><span className="section-index">02</span><div><h2>Уточним детали</h2><p>Ответьте на каждый вопрос, чтобы собрать карточку.</p></div></div>
          <div className="question-list">{analysis.questions.map((question, index) => <label className="question" key={question.id}>
            <span className="question-number">0{index + 1}</span><span className="question-body"><strong>{question.text}</strong><textarea rows={3} required value={answers[question.id] ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} placeholder="Ваш ответ" disabled={busy !== null} /></span>
          </label>)}</div>
          <div className="action-row"><button className="button button-primary" type="button" onClick={buildCard} disabled={busy !== null || !allAnswered}>{busy === 'building' ? 'Собираем карточку…' : 'Сформировать карточку'} <span aria-hidden="true">↗</span></button><button className="button button-text" type="button" onClick={() => { setError(''); setStage('draft'); }} disabled={busy !== null}>Назад к описанию</button></div>
          <ErrorNotice message={error} onDismiss={() => setError('')} />
        </section>}

        {stage === 'card' && card && <section className="surface-section">
          <div className="section-heading"><span className="section-index">03</span><div><h2>Проверьте карточку</h2><p>Каждое поле можно изменить. Пустые поля останутся видимыми.</p></div></div>
          <TaskCardEditor card={card} onChange={updateCard} disabled={busy !== null} />
          <div className="action-row action-row--bordered"><button className="button button-primary" type="button" onClick={confirm} disabled={busy !== null}>{busy === 'confirming' ? 'Пересчитываем…' : 'Подтвердить и пересчитать'}</button></div>
          <ErrorNotice message={error} onDismiss={() => setError('')} />
        </section>}

        {stage === 'confirmed' && score && <section className="surface-section confirmation-section">
          <div className="section-heading"><span className="section-index">04</span><div><h2>Карточка подтверждена</h2><p>Рейтинг рассчитан. Можно вернуться к редактированию или опубликовать задачу.</p></div></div>
          <p className="confirmed-copy">Текущий рейтинг: <strong>{score.score} / 100</strong> · {score.readiness_label}</p>
          <div className="action-row"><button className="button button-primary" type="button" onClick={publish} disabled={busy !== null}>{busy === 'publishing' ? 'Публикуем…' : 'Опубликовать задачу'} <span aria-hidden="true">↗</span></button><button className="button button-secondary" type="button" onClick={returnToEdit} disabled={busy !== null}>Вернуться к редактированию</button></div>
          <p className="action-note">Минимального рейтинга для публикации нет.</p>
          <ErrorNotice message={error} onDismiss={() => setError('')} />
        </section>}

        {stage === 'published' && published && <section className="success-panel" role="status">
          <span className="success-icon">✓</span><p className="eyebrow">Готово</p><h2>Задача опубликована</h2>
          <p>Карточка сохранена вместе с рейтингом и уже доступна командам в каталоге.</p>
          <p className="published-id">ID задачи: <code>{published.task_id}</code></p>
          <div className="action-row"><Link className="button button-primary" to={"/tasks/" + encodeURIComponent(published.task_id)}>Открыть задачу <span aria-hidden="true">↗</span></Link><Link className="button button-secondary" to="/catalog">Перейти в каталог</Link></div>
        </section>}
      </div>
      <aside className="workspace-aside">
        {score ? <ScorePanel result={score} /> : <div className="guide-panel"><span className="guide-mark">✳</span><p className="eyebrow">Как это работает</p><h2>Чёткая задача получает больше внимания</h2><p>AI поможет задать правильные вопросы. Вы проверите факты и сможете изменить любое поле.</p><div className="guide-points"><div><span>01</span>Опишите запрос своими словами</div><div><span>02</span>Ответьте на вопросы AI</div><div><span>03</span>Подтвердите и опубликуйте</div></div></div>}
      </aside>
    </div>
  </div>;
}
