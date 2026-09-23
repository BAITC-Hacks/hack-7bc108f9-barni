import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import ScorePanel from '../components/ScorePanel';
import {
  fieldDefinitions,
  type CreateProposalInput,
  type CurrentDemoRole,
  type Proposal,
  type ProposalStatus,
  type PublishedTask,
} from '../types';

interface TaskPageProps {
  role: CurrentDemoRole;
}

type ProposalForm = Omit<CreateProposalInput, 'team_id'>;

const emptyProposal: ProposalForm = {
  idea: '',
  plan: '',
  estimated_duration: '',
  prototype_url: '',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: ProposalStatus): string {
  if (status === 'accepted') return 'Принято';
  if (status === 'rejected') return 'Отклонено';
  return 'На рассмотрении';
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function TaskPage({ role }: TaskPageProps) {
  const { id = '' } = useParams();
  const [task, setTask] = useState<PublishedTask | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalsError, setProposalsError] = useState('');
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [topicLabels, setTopicLabels] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ProposalForm>(emptyProposal);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [updatingProposal, setUpdatingProposal] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [proposalsReload, setProposalsReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setTask(null);
    api.getTask(id)
      .then((nextTask) => {
        if (active) setTask(nextTask);
      })
      .catch((caught) => {
        if (active) setLoadError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, reload]);

  useEffect(() => {
    let active = true;
    setProposalsLoading(true);
    setProposalsError('');
    setProposals([]);
    api.getProposals(id)
      .then((nextProposals) => {
        if (active) setProposals(nextProposals);
      })
      .catch((caught) => {
        if (active) setProposalsError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setProposalsLoading(false);
      });
    return () => { active = false; };
  }, [id, proposalsReload]);

  useEffect(() => {
    let active = true;
    api.getTeams().then((teams) => {
      if (active) setTeamNames(Object.fromEntries(teams.map((team) => [team.id, team.name])));
    }).catch(() => {
      // Proposal cards still show the team identifier if names are unavailable.
    });
    api.getMeta().then((meta) => {
      if (active) setTopicLabels(Object.fromEntries(meta.topics.map((topic) => [topic.slug, topic.label])));
    }).catch(() => {
      // The topic slug remains visible when metadata is unavailable.
    });
    return () => { active = false; };
  }, []);

  const missingByField = useMemo(
    () => new Map(task?.missing_fields.map((item) => [item.field, item]) ?? []),
    [task],
  );

  const ownProposals = role.type === 'team'
    ? proposals.filter(({ team_id }) => team_id === role.team_id)
    : [];

  function updateForm(field: keyof ProposalForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError('');
    setFormSuccess('');
  }

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = {
      idea: form.idea.trim(),
      plan: form.plan.trim(),
      estimated_duration: form.estimated_duration.trim(),
      prototype_url: form.prototype_url.trim(),
    };
    if (![values.idea, values.plan, values.estimated_duration].every(Boolean)) {
      setFormError('Заполните идею, план и срок предложения.');
      return;
    }
    if (values.prototype_url && !isValidUrl(values.prototype_url)) {
      setFormError('Укажите корректную ссылку с http:// или https://.');
      return;
    }
    if (role.type !== 'team' || !role.team_id) {
      setFormError('Выберите роль команды.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');
    try {
      const created = await api.createProposal(id, { team_id: role.team_id, ...values });
      setProposals((current) => [created, ...current]);
      setForm(emptyProposal);
      setFormSuccess('Предложение сохранено. Статус: «На рассмотрении».');
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(proposalId: string, status: Exclude<ProposalStatus, 'pending'>) {
    const previous = proposals;
    setDecisionError('');
    setUpdatingProposal(proposalId);
    setProposals((current) => current.map((proposal) =>
      proposal.id === proposalId ? { ...proposal, status } : proposal
    ));
    try {
      const updated = await api.updateProposalStatus(proposalId, status);
      setProposals((current) => current.map((proposal) =>
        proposal.id === proposalId ? updated : proposal
      ));
    } catch (caught) {
      setProposals(previous);
      setDecisionError(errorMessage(caught));
    } finally {
      setUpdatingProposal(null);
    }
  }

  if (loading) {
    return <div className="page-width loading-page" role="status"><span className="loading-dot" />Загружаем задачу…</div>;
  }

  if (loadError) {
    return <div className="page-width not-found" role="alert">
      <p className="eyebrow">Ошибка загрузки</p>
      <h1>Не удалось открыть задачу</h1>
      <p>{loadError}</p>
      <div className="action-row">
        <button className="button button-primary" type="button" onClick={() => setReload((value) => value + 1)}>Повторить</button>
        <Link className="button button-secondary" to="/catalog">Вернуться в каталог</Link>
      </div>
    </div>;
  }

  if (!task) {
    return <div className="page-width not-found">
      <p className="eyebrow">404</p>
      <h1>Задача не найдена</h1>
      <p>Возможно, ссылка устарела или задача была удалена из каталога.</p>
      <Link className="button button-primary" to="/catalog">Вернуться в каталог</Link>
    </div>;
  }

  return <div className="page-width detail-page">
    <Link className="back-link" to="/catalog">← Вернуться в каталог</Link>

    <header className="detail-heading">
      <div className="detail-title">
        <div className="task-row__meta">
          <span className="topic-pill">{task.topic ? (topicLabels[task.topic] ?? task.topic) : 'Без темы'}</span>
          <span className={'readiness readiness--' + task.readiness_level}>{task.readiness_label}</span>
        </div>
        <h1>{task.title}</h1>
        <p>Опубликовано {formatDate(task.published_at)} · {task.missing_fields.length} недостающих полей</p>
      </div>
      <div className="detail-score">
        <span>Рейтинг готовности</span>
        <strong>{task.score}<small>/100</small></strong>
        <div className="score-progress" aria-label={'Рейтинг ' + task.score + ' из 100'}>
          <span style={{ width: task.score + '%' }} />
        </div>
      </div>
    </header>

    <div className="detail-grid">
      <div className="detail-main">
        <section className="surface-section">
          <div className="section-heading">
            <span className="section-index">01</span>
            <div><h2>Карточка задачи</h2><p>Полный контекст для оценки задачи и подготовки предложения.</p></div>
          </div>
          <dl className="detail-fields">
            {fieldDefinitions.map(({ key, label }) => {
              const missing = missingByField.get(key);
              return <div key={key}>
                <dt>{label}</dt>
                <dd className={task.card[key] ? '' : 'field-missing'}>
                  {task.card[key] || 'Не указано'}
                  {!task.card[key] && missing && <small>Можно добавить +{missing.potential_points} баллов</small>}
                </dd>
              </div>;
            })}
          </dl>
        </section>

        {role.type === 'team' && <section className="surface-section">
          <div className="section-heading">
            <span className="section-index">02</span>
            <div><h2>Отправить предложение</h2><p>{role.label}: опишите идею и реалистичный план первого результата.</p></div>
          </div>
          <form className="proposal-form" onSubmit={submitProposal} noValidate>
            <label className="field"><span>Идея решения *</span>
              <textarea value={form.idea} onChange={(event) => updateForm('idea', event.target.value)} rows={4} disabled={submitting} placeholder="Как команда решит задачу?" />
            </label>
            <label className="field"><span>План реализации *</span>
              <textarea value={form.plan} onChange={(event) => updateForm('plan', event.target.value)} rows={4} disabled={submitting} placeholder="Ключевые шаги и первый результат" />
            </label>
            <div className="form-two">
              <label className="field"><span>Предполагаемый срок *</span>
                <input value={form.estimated_duration} onChange={(event) => updateForm('estimated_duration', event.target.value)} disabled={submitting} placeholder="Например, 3 недели" />
              </label>
              <label className="field"><span>Ссылка на прототип (необязательно)</span>
                <input type="url" value={form.prototype_url} onChange={(event) => updateForm('prototype_url', event.target.value)} disabled={submitting} placeholder="https://…" />
              </label>
            </div>
            {formError && <div className="error-banner" role="alert">{formError}</div>}
            {formSuccess && <div className="notice-banner" role="status">{formSuccess}</div>}
            <button className="button button-primary" type="submit" aria-busy={submitting} disabled={submitting}>
              {submitting ? 'Сохраняем…' : 'Отправить предложение'} <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="own-proposals">
            <h3>Предложения вашей команды</h3>
            {proposalsLoading
              ? <p className="inline-empty" role="status">Загружаем предложения…</p>
              : proposalsError
                ? <div className="error-banner" role="alert">
                    Не удалось загрузить предложения: {proposalsError}
                    <button className="button button-secondary" type="button" onClick={() => setProposalsReload((value) => value + 1)}>Повторить</button>
                  </div>
                : ownProposals.length === 0
                  ? <p className="inline-empty">Пока нет отправленных предложений.</p>
                  : ownProposals.map((proposal) => <div key={proposal.id}>
                      <strong>{proposal.idea}</strong>
                      <span className={'proposal-status proposal-status--' + proposal.status}>{statusLabel(proposal.status)}</span>
                    </div>)}
          </div>
        </section>}

        {role.type === 'business' && <section className="surface-section">
          <div className="section-heading">
            <span className="section-index">02</span>
            <div><h2>Предложения команд</h2><p>Решение принимает представитель бизнеса. Можно принять несколько предложений.</p></div>
          </div>
          {decisionError && <div className="error-banner" role="alert">{decisionError}</div>}
          {proposalsLoading
            ? <div className="inline-empty" role="status">Загружаем предложения…</div>
            : proposalsError
              ? <div className="error-banner" role="alert">
                  Не удалось загрузить предложения: {proposalsError}
                  <button className="button button-secondary" type="button" onClick={() => setProposalsReload((value) => value + 1)}>Повторить</button>
                </div>
              : proposals.length === 0
                ? <div className="inline-empty">Команды ещё не отправили предложения по этой задаче.</div>
                : <div className="proposal-list">{proposals.map((proposal) => <article className="proposal-item" key={proposal.id}>
                <div className="proposal-item__head">
                  <strong>{proposal.team_name || teamNames[proposal.team_id] || 'Команда ' + proposal.team_id.slice(0, 8)}</strong>
                  <span className={'proposal-status proposal-status--' + proposal.status}>{statusLabel(proposal.status)}</span>
                </div>
                <p>{proposal.idea}</p>
                <dl>
                  <div><dt>План</dt><dd>{proposal.plan}</dd></div>
                  <div><dt>Срок</dt><dd>{proposal.estimated_duration}</dd></div>
                  <div><dt>Прототип</dt><dd>{proposal.prototype_url && isValidUrl(proposal.prototype_url)
                    ? <a href={proposal.prototype_url} target="_blank" rel="noreferrer">{proposal.prototype_url}</a>
                    : 'Не указан'}</dd></div>
                  <div><dt>Отправлено</dt><dd>{formatDate(proposal.created_at)}</dd></div>
                </dl>
                {proposal.status === 'pending' && <div className="proposal-actions">
                  <button className="button button-primary" type="button" aria-busy={updatingProposal === proposal.id} disabled={updatingProposal === proposal.id} onClick={() => decide(proposal.id, 'accepted')}>
                    {updatingProposal === proposal.id ? 'Сохраняем…' : 'Принять'}
                  </button>
                  <button className="button button-secondary" type="button" disabled={updatingProposal === proposal.id} onClick={() => decide(proposal.id, 'rejected')}>Отклонить</button>
                </div>}
              </article>)}</div>}
        </section>}
      </div>

      <aside className="detail-aside">
        <ScorePanel result={{
          score: task.score,
          readiness_level: task.readiness_level,
          readiness_label: task.readiness_label,
          breakdown: task.score_breakdown,
          missing_fields: task.missing_fields,
        }} />
      </aside>
    </div>
  </div>;
}
