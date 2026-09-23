import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../api/client';
import ScorePanel from '../components/ScorePanel';
import TaskCardEditor from '../components/TaskCardEditor';
import ProductIntro, { ProductExplainer } from '../components/ProductIntro';
import '../product-entry.css';
import type {
  AiSource, AnalyzeDraftResponse, CardField, ClarifyingQuestion, PublishResult,
  QuestionAnswer, ScoreResult, TaskCard, TopicOption,
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
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState('');
  const [metaReload, setMetaReload] = useState(0);
  const [analysis, setAnalysis] = useState<AnalyzeDraftResponse | null>(null);
  const [cardSource, setCardSource] = useState<AiSource | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [card, setCard] = useState<TaskCard | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const workspaceRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    setMetaLoading(true);
    setMetaError('');
    setTopics([]);
    api.getMeta().then((result) => {
      if (!active) return;
      if (!Array.isArray(result.topics) || result.topics.length === 0 ||
          result.topics.some((item) => !item || typeof item.slug !== 'string' ||
            !item.slug || typeof item.label !== 'string' || !item.label)) {
        throw new Error('Сервер вернул некорректный список тем.');
      }
      setTopics(result.topics);
      setTopic((current) => result.topics.some((item) => item.slug === current) ? current : '');
    }).catch((caught) => {
      if (active) setMetaError(errorMessage(caught));
    }).finally(() => {
      if (active) setMetaLoading(false);
    });
    return () => { active = false; };
  }, [metaReload]);

  useEffect(() => {
    if (stage === 'draft') return;
    workspaceRef.current?.focus({ preventScroll: true });
    workspaceRef.current?.scrollIntoView({ block: 'start' });
  }, [stage]);

  function focusDraft() {
    draftInputRef.current?.focus({ preventScroll: true });
    draftInputRef.current?.scrollIntoView({ block: 'center' });
  }

  function fillExample() {
    setDraft('Новые сотрудники тратят много времени на поиск учебных материалов. Хотим собрать понятный маршрут обучения и проверять, что основные темы усвоены. Сейчас материалы хранятся в разных документах.');
    setTopic(topics.some(({ slug }) => slug === 'education') ? 'education' : '');
    focusDraft();
  }

  const activeStep = steps.findIndex((item) => item.stage === stage);
  const allAnswered = Boolean(analysis?.questions.length) &&
    analysis!.questions.every((question) => Boolean(answers[question.id]?.trim()));

  async function analyze() {
    if (!draft.trim() || !topics.some((item) => item.slug === topic)) return;
    setBusy('analyzing'); setError('');
    try {
      const result = await api.analyzeDraft({ draft: draft.trim(), topic });
      if (!Array.isArray(result.questions) || result.questions.length < 3 ||
          result.questions.length > 5 || !Array.isArray(result.missing_fields) ||
          (result.source !== 'model' && result.source !== 'fallback') ||
          result.questions.some((question) => !question.id || !question.text?.trim() ||
            !result.missing_fields.includes(question.target_field))) {
        throw new Error('AI вернул неполные вопросы. Попробуйте ещё раз.');
      }
      setAnalysis(result);
      setAnswers({});
      setCard(null);
      setCardSource(null);
      setScore(null);
      setStage('questions');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 &&
          caught.code === 'INSUFFICIENT_MISSING_FIELDS') {
        setAnalysis(null);
        setAnswers({});
        await requestCard([], []);
      } else {
        setError(errorMessage(caught));
      }
    } finally { setBusy(null); }
  }

  async function requestCard(questions: ClarifyingQuestion[], questionAnswers: QuestionAnswer[]) {
    setBusy('building'); setError('');
    try {
      const result = await api.buildTaskCard({
        draft: draft.trim(), topic, questions, answers: questionAnswers,
      });
      if (!result.card || typeof result.card !== 'object' ||
          (result.source !== 'model' && result.source !== 'fallback')) {
        throw new Error('Не удалось получить карточку.');
      }
      const fields: CardField[] = [
        'title', 'topic', 'context', 'need', 'users', 'data', 'constraints',
        'expected_result', 'success_criteria', 'contact', 'interaction_format',
      ];
      const safeCard = Object.fromEntries(fields.map((field) => {
        const value = result.card[field];
        return [field, typeof value === 'string' ? value : null];
      })) as TaskCard;
      safeCard.topic = topic;
      setCard(safeCard);
      setCardSource(result.source);
      setScore(null);
      setStage('card');
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
    await requestCard(analysis.questions, questionAnswers);
  }

  function updateCard(field: CardField, value: string) {
    if (!card) return;
    if (field === 'topic' && value && !topics.some((item) => item.slug === value)) return;
    setCard({ ...card, [field]: value });
  }

  async function confirm() {
    if (!card) return;
    if (!card.title?.trim() || !card.topic ||
        !topics.some((item) => item.slug === card.topic)) {
      setError('Укажите название и выберите тему из списка.');
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

  return <div className={'page-width create-page' + (stage === 'draft' ? ' create-page--intro' : '')}>
    <div className={stage === 'draft' ? 'entry-layout' : 'workflow-layout'}>
    {stage === 'draft' ? <ProductIntro /> : <>
      <div className="page-topline"><span className="eyebrow">Рабочее пространство бизнеса</span><span>От идеи до понятной задачи</span></div>
      <div className="page-heading">
        <div><h1>Создать задачу</h1><p>Уточните детали, проверьте карточку и опубликуйте задачу для студенческих команд.</p></div>
        <div className="heading-art" aria-hidden="true"><span className="art-circle art-circle-one"/><span className="art-circle art-circle-two"/><span className="art-cross">✳</span></div>
      </div>
    </>}
    <div className="workflow-content" id="task-workspace" ref={workspaceRef} tabIndex={-1}>
    {stage !== 'draft' && <ol className="stepper" aria-label="Этапы создания задачи">
      {steps.map((item, index) => <li key={item.stage} className={index === activeStep ? 'current' : index < activeStep ? 'done' : ''}>
        <span>{index < activeStep ? '✓' : '0' + (index + 1)}</span>{item.label}
      </li>)}
    </ol>}
    <div className="workspace-grid">
      <div className="workspace-main">
        {stage === 'draft' && <section className="surface-section entry-form" aria-labelledby="draft-title">
          <p className="entry-form__eyebrow">Начните здесь · Шаг 1 из 5</p>
          <div className="section-heading"><div><h2 id="draft-title">С какой задачей вам помочь?</h2><p>Начните с обычного описания. Детали уточним вместе с AI.</p></div></div>
          <label className="field"><span>Тема</span>
            <select value={topic} onChange={(event) => setTopic(event.target.value)} disabled={busy !== null || metaLoading || Boolean(metaError)}>
              <option value="">{metaLoading ? 'Загружаем темы…' : 'Выберите тему'}</option>
              {topics.map(({ slug, label }) => <option value={slug} key={slug}>{label}</option>)}
            </select>
          </label>
          {metaError && <div className="error-banner" role="alert"><span>Не удалось загрузить темы: {metaError}</span>
            <button type="button" onClick={() => setMetaReload((value) => value + 1)}>Повторить</button>
          </div>}
          <label className="field"><span>Какую задачу вы хотите решить?</span><textarea ref={draftInputRef} className="draft-input" rows={6} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Например: новые сотрудники долго ищут учебные материалы. Хотим сделать обучение понятнее…" disabled={busy !== null} /></label>
          {!draft.trim() && <div className="draft-example"><span>Пока нет описания?</span><button type="button" onClick={fillExample} disabled={busy !== null || metaLoading || Boolean(metaError)}>Попробовать на примере <span aria-hidden="true">↗</span></button></div>}
          <div className="action-row"><button className="button button-primary" type="button" onClick={analyze} aria-busy={busy === 'analyzing' || busy === 'building'} disabled={busy !== null || metaLoading || Boolean(metaError) || !draft.trim() || !topic}>{busy === 'building' ? 'Собираем карточку…' : busy === 'analyzing' ? 'Анализируем…' : 'Уточнить задачу с AI'} <span aria-hidden="true">↗</span></button></div>
          <p className="action-note">Вы проверите и подтвердите карточку перед публикацией.</p>
          <ErrorNotice message={error} onDismiss={() => setError('')} />
        </section>}

        {stage === 'questions' && analysis && <section className="surface-section">
          <div className="section-heading"><span className="section-index">02</span><div><h2>Уточним детали</h2><p>Ответьте на каждый вопрос, чтобы собрать карточку.</p></div></div>
          <p className="action-note" role="status">{analysis.source === 'fallback'
            ? 'Вопросы подготовлены резервным способом. Проверьте их перед ответом.'
            : 'Вопросы сформированы AI.'}</p>
          <div className="question-list">{analysis.questions.map((question, index) => <label className="question" key={question.id}>
            <span className="question-number">0{index + 1}</span><span className="question-body"><strong>{question.text}</strong><textarea rows={3} required value={answers[question.id] ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} placeholder="Ваш ответ" disabled={busy !== null} /></span>
          </label>)}</div>
          <div className="action-row"><button className="button button-primary" type="button" onClick={buildCard} aria-busy={busy === 'building'} disabled={busy !== null || !allAnswered}>{busy === 'building' ? 'Собираем карточку…' : 'Сформировать карточку'} <span aria-hidden="true">↗</span></button><button className="button button-text" type="button" onClick={() => { setError(''); setStage('draft'); }} disabled={busy !== null}>Назад к описанию</button></div>
          <ErrorNotice message={error} onDismiss={() => setError('')} />
        </section>}

        {stage === 'card' && card && <section className="surface-section">
          <div className="section-heading"><span className="section-index">03</span><div><h2>Проверьте карточку</h2><p>Каждое поле можно изменить. Пустые поля останутся видимыми.</p></div></div>
          {cardSource && <p className="action-note" role="status">{cardSource === 'fallback'
            ? 'Карточка подготовлена локально. Проверьте каждое поле.'
            : 'Карточка сформирована AI. Проверьте каждое поле.'}</p>}
          <TaskCardEditor card={card} onChange={updateCard} topicOptions={topics} disabled={busy !== null} />
          <div className="action-row action-row--bordered"><button className="button button-primary" type="button" onClick={confirm} aria-busy={busy === 'confirming'} disabled={busy !== null}>{busy === 'confirming' ? 'Пересчитываем…' : 'Подтвердить и пересчитать'}</button></div>
          <ErrorNotice message={error} onDismiss={() => setError('')} />
        </section>}

        {stage === 'confirmed' && score && <section className="surface-section confirmation-section">
          <div className="section-heading"><span className="section-index">04</span><div><h2>Карточка подтверждена</h2><p>Рейтинг рассчитан. Можно вернуться к редактированию или опубликовать задачу.</p></div></div>
          <p className="confirmed-copy">Текущий рейтинг: <strong>{score.score} / 100</strong> · {score.readiness_label}</p>
          <div className="action-row"><button className="button button-primary" type="button" onClick={publish} aria-busy={busy === 'publishing'} disabled={busy !== null}>{busy === 'publishing' ? 'Публикуем…' : 'Опубликовать задачу'} <span aria-hidden="true">↗</span></button><button className="button button-secondary" type="button" onClick={returnToEdit} disabled={busy !== null}>Вернуться к редактированию</button></div>
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
      {stage !== 'draft' && <aside className="workspace-aside">
        {score ? <ScorePanel result={score} /> : <div className="guide-panel"><span className="guide-mark">✳</span><p className="eyebrow">Как это работает</p><h2>Чёткая задача получает больше внимания</h2><p>AI поможет задать правильные вопросы. Вы проверите факты и сможете изменить любое поле.</p><div className="guide-points"><div><span>01</span>Опишите запрос своими словами</div><div><span>02</span>Ответьте на вопросы AI</div><div><span>03</span>Подтвердите и опубликуйте</div></div></div>}
      </aside>}
    </div>
    </div>
    </div>
    {stage === 'draft' && <ProductExplainer onStart={focusDraft} />}
  </div>;
}
