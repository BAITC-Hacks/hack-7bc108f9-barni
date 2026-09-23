import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api, errorMessage } from './api/client';
import CreatePage from './pages/CreatePage';
import CatalogPage from './pages/CatalogPage';
import TaskPage from './pages/TaskPage';
import type { CurrentDemoRole, Team } from './types';

const ROLE_KEY = 'asar:demo-role:v1';
const businessRole: CurrentDemoRole = { type: 'business', label: 'Бизнес' };

function loadRole(): CurrentDemoRole {
  try {
    const raw = window.localStorage.getItem(ROLE_KEY);
    if (!raw) return businessRole;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return businessRole;
    const candidate = parsed as Partial<CurrentDemoRole>;
    if (candidate.type === 'business') return businessRole;
    if (candidate.type === 'team' && typeof candidate.team_id === 'string') {
      return { type: 'team', team_id: candidate.team_id, label: '' };
    }
  } catch {
    // Повреждённое значение роли безопасно заменяется ролью бизнеса.
  }
  return businessRole;
}

export default function App() {
  const [role, setRole] = useState<CurrentDemoRole>(loadRole);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsReady, setTeamsReady] = useState(false);
  const [teamsError, setTeamsError] = useState('');
  const [teamsReload, setTeamsReload] = useState(0);

  useEffect(() => {
    let active = true;
    setTeamsReady(false);
    setTeamsError('');
    api.getTeams().then((result) => {
      if (!active) return;
      setTeams(result);
      setRole((current) => {
        if (current.type !== 'team') return current;
        const team = result.find(({ id }) => id === current.team_id) ?? result[0];
        return team ? { type: 'team', team_id: team.id, label: team.name } : businessRole;
      });
      setTeamsReady(true);
    }).catch((caught) => {
      if (!active) return;
      setTeams([]);
      setTeamsError(errorMessage(caught));
    });
    return () => { active = false; };
  }, [teamsReload]);

  useEffect(() => {
    if (!teamsReady) return;
    try {
      const preference = role.type === 'team'
        ? { type: role.type, team_id: role.team_id }
        : { type: role.type };
      window.localStorage.setItem(ROLE_KEY, JSON.stringify(preference));
    } catch {
      // Переключатель продолжает работать в текущей вкладке.
    }
  }, [role, teamsReady]);

  function changeRole(value: string) {
    const next = value === 'business'
      ? businessRole
      : (() => {
          const team = teams.find(({ id }) => id === value);
          return team
            ? { type: 'team' as const, team_id: team.id, label: team.name }
            : businessRole;
        })();
    setRole(next);
  }

  return <div className="app-shell">
    <header className="site-header">
      <div className="header-main">
        <Link className="brand" to="/create" aria-label="ASAR — главная">
          <img className="brand-logo" src="/asar-logo.png" alt="" width="44" height="44" />
          <span>ASAR</span>
        </Link>
        <nav className="main-nav" aria-label="Основная навигация">
          <NavLink to="/create" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Создать задачу</NavLink>
          <NavLink to="/catalog" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Каталог</NavLink>
        </nav>
        <div className="header-spacer" />
        <label className="role-control">
          <span>Роль</span>
          <select
            aria-label="Демонстрационная роль"
            disabled={!teamsReady}
            value={!teamsReady || role.type === 'business' ? 'business' : role.team_id}
            onChange={(event) => changeRole(event.target.value)}
          >
            <option value="business">Бизнес</option>
            {teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
          </select>
        </label>
      </div>
    </header>
    <main>
      {teamsError && <div className="page-width error-banner" role="alert">
        <span>Не удалось загрузить команды: {teamsError}</span>
        <button type="button" onClick={() => setTeamsReload((value) => value + 1)}>Повторить</button>
      </div>}
      <Routes>
        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/catalog" element={<CatalogPage role={teamsReady ? role : businessRole} />} />
        <Route path="/tasks/:id" element={<TaskPage role={teamsReady ? role : businessRole} />} />
        <Route path="*" element={<div className="not-found page-width">
          <h1>Страница не найдена</h1>
          <Link className="button button-primary" to="/catalog">Перейти в каталог</Link>
        </div>} />
      </Routes>
    </main>
  </div>;
}
