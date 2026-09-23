import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, errorMessage } from '../api';
import ScorePanel from '../components/ScorePanel';
import { demoTeams, fieldDefinitions, proposalStatusLabels, readinessLabels, type Proposal, type ProposalStatus, type Task } from '../types';
import type { DemoRole } from '../App';

interface Props { role: DemoRole; }

export default function TaskPage({ role }: Props) {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [idea, setIdea] = useState('');
  const [plan, setPlan] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [prototypeUrl, setPrototypeUrl] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([api.getTask(id), api.listProposals(id)])
      .then(([nextTask, nextProposals]) => { if (!cancelled) { setTask(nextTask); setProposals(nextProposals); setError(''); } })
      .catch((caught) => { if (!cancelled) setError(errorMessage(caught)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !idea.trim() || !plan.trim() || !estimatedDuration.trim()) { setError('Заполните идею, план и срок.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await api.createProposal(id, {
        team_id: role.teamId, idea: idea.trim(), plan: plan.trim(),
        estimated_duration: estimatedDuration.trim(), prototype_url: prototypeUrl.trim(),
      });
      setProposals((current) => [created, ...current]);
      setIdea(''); setPlan(''); setEstimatedDuration(''); setPrototypeUrl('');
      setNotice('Предложение отправлено бизнесу.');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function decide(proposalId: string, status: Exclude<ProposalStatus, 'pending'>) {
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await api.updateProposal(proposalId, status);
      setProposals((current) => current.map((item) => item.id === proposalId ? updated : item));
      setNotice(status === 'accepted' ? 'Предложение принято.' : 'Предложение отклонено.');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="page-width loading-page" role="status">Загружаем задачу…</div>;
  if (error && !task) return <div className="page-width not-found"><h1>Не удалось открыть задачу</h1><p>{error}</p><Link className="button button-secondary" to="/catalog">В каталог</Link></div>;
  if (!task) return null;

  const ownProposals = proposals.filter((proposal) => proposal.team_id === role.teamId);
  return <div className="page-width detail-page">
    <Link to="/catalog" className="back-link">← Каталог задач</Link>
    <div className="detail-heading"><div className="detail-title"><div className="task-row__meta"><span className="topic-pill">{task.topic}</span><span>{readinessLabels[task.readiness_level]}</span></div><h1>{task.card?.title || 'Без названия'}</h1><p>{task.card?.need || task.draft_text}</p></div><div className="detail-score"><span>Рейтинг задачи</span><strong>{task.score}<small>/100</small></strong></div></div>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>×</button></div>}
    {notice && <div className="notice-banner" role="status">✓ {notice}</div>}
    <div className="detail-grid"><div className="detail-main">
      <section className="surface-section"><div className="section-heading"><span className="section-index">01</span><div><h2>О задаче</h2><p>Сведения подтверждены представителем бизнеса.</p></div></div><dl className="detail-fields">{fieldDefinitions.filter(({ key }) => key !== 'title' && key !== 'topic').map(({ key, label }) => <div key={key}><dt>{label}</dt><dd className={!task.card?.[key] ? 'field-missing' : ''}>{task.card?.[key] || 'Пока не указано'}</dd></div>)}</dl></section>
      {role.mode === 'team' ? <section className="surface-section proposal-section"><div className="section-heading"><span className="section-index">02</span><div><h2>Предложить решение</h2><p>Бизнес рассмотрит ваш план и примет решение вручную.</p></div></div><form onSubmit={submitProposal} className="proposal-form">
        <label className="field"><span>Идея решения</span><textarea rows={4} value={idea} onChange={(event) => setIdea(event.target.value)} required placeholder="Что вы предлагаете?" disabled={busy}/></label>
        <label className="field"><span>План реализации</span><textarea rows={4} value={plan} onChange={(event) => setPlan(event.target.value)} required placeholder="Основные этапы работы" disabled={busy}/></label>
        <div className="form-two"><label className="field"><span>Предполагаемый срок</span><input value={estimatedDuration} onChange={(event) => setEstimatedDuration(event.target.value)} required placeholder="Например, 2 недели" disabled={busy}/></label><label className="field"><span>Ссылка на прототип</span><input type="url" value={prototypeUrl} onChange={(event) => setPrototypeUrl(event.target.value)} placeholder="https://…" disabled={busy}/></label></div>
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить предложение'} <span aria-hidden="true">↗</span></button>
      </form>{ownProposals.length > 0 && <div className="own-proposals"><h3>Ваши предложения</h3>{ownProposals.map((proposal) => <div key={proposal.id}><strong>{proposal.idea}</strong><span className={`proposal-status proposal-status--${proposal.status}`}>{proposalStatusLabels[proposal.status]}</span></div>)}</div>}</section>
      : <section className="surface-section proposal-section"><div className="section-heading"><span className="section-index">02</span><div><h2>Предложения команд</h2><p>Можно принять несколько команд или ни одной. Решение всегда остаётся за бизнесом.</p></div></div>{proposals.length ? <div className="proposal-list">{proposals.map((proposal) => <article className="proposal-item" key={proposal.id}><div className="proposal-item__head"><strong>{demoTeams.find((team) => team.id === proposal.team_id)?.name || proposal.team_id}</strong><span className={`proposal-status proposal-status--${proposal.status}`}>{proposalStatusLabels[proposal.status]}</span></div><p>{proposal.idea}</p><dl><div><dt>План</dt><dd>{proposal.plan}</dd></div><div><dt>Срок</dt><dd>{proposal.estimated_duration}</dd></div>{proposal.prototype_url && <div><dt>Прототип</dt><dd><a href={proposal.prototype_url} target="_blank" rel="noreferrer">Открыть ссылку ↗</a></dd></div>}</dl><div className="proposal-actions"><button className="button button-primary" type="button" disabled={busy || proposal.status === 'accepted'} onClick={() => decide(proposal.id, 'accepted')}>Принять</button><button className="button button-secondary" type="button" disabled={busy || proposal.status === 'rejected'} onClick={() => decide(proposal.id, 'rejected')}>Отклонить</button></div></article>)}</div> : <div className="inline-empty">Предложений пока нет. Переключитесь на команду, чтобы отправить первое.</div>}</section>}
    </div><aside className="detail-aside"><ScorePanel task={task} /></aside></div>
  </div>;
}
