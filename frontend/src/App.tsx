import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api, isMockMode } from './api/client';
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
    if (candidate.type === 'team' && typeof candidate.team_id === 'string' && typeof candidate.label === 'string') {
      return { type: 'team', team_id: candidate.team_id, label: candidate.label };
    }
  } catch {
    // Повреждённое значение роли безопасно заменяется ролью бизнеса.
  }
  return businessRole;
}

export default function App() {
  const [role, setRole] = useState<CurrentDemoRole>(loadRole);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    let active = true;
    api.getTeams().then((result) => {
      if (active) setTeams(result);
    }).catch(() => {
      if (active) setTeams([]);
    });
    return () => { active = false; };
  }, []);

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
    try {
      window.localStorage.setItem(ROLE_KEY, JSON.stringify(next));
    } catch {
      // Переключатель продолжает работать в текущей вкладке.
    }
  }

  return <div className="app-shell">
    <header className="site-header">
      <div className="header-main">
        <Link className="brand" to="/create" aria-label="ASAR — главная">ASAR</Link>
        <nav className="main-nav" aria-label="Основная навигация">
          <NavLink to="/create" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Создать задачу</NavLink>
          <NavLink to="/catalog" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Каталог</NavLink>
        </nav>
        <div className="header-spacer" />
        <label className="role-control">
          <span>Роль</span>
          <select
            aria-label="Демонстрационная роль"
            value={role.type === 'business' ? 'business' : role.team_id}
            onChange={(event) => changeRole(event.target.value)}
          >
            <option value="business">Бизнес</option>
            {teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
          </select>
        </label>
        {isMockMode && <span className="demo-badge">Demo</span>}
      </div>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/tasks/:id" element={<TaskPage role={role} />} />
        <Route path="*" element={<div className="not-found page-width">
          <h1>Страница не найдена</h1>
          <Link className="button button-primary" to="/catalog">Перейти в каталог</Link>
        </div>} />
      </Routes>
    </main>
  </div>;
}
