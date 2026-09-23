import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router';
import CreatePage from './pages/CreatePage';
import CatalogPage from './pages/CatalogPage';
import TaskPage from './pages/TaskPage';
import { isMockMode } from './api';
import { demoTeams } from './types';

export interface DemoRole {
  mode: 'business' | 'team';
  teamId: string;
}

export default function App() {
  const [role, setRole] = useState<DemoRole>({ mode: 'business', teamId: demoTeams[0]!.id });
  return <div className="app-shell">
    <header className="site-header">
      <div className="header-main">
        <Link className="brand" to="/create" aria-label="Barni — главная">
          <span className="brand-mark"><span /></span><span>barni<span className="brand-dot">.</span></span>
        </Link>
        <nav className="main-nav" aria-label="Основная навигация">
          <NavLink to="/create" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Создать задачу</NavLink>
          <NavLink to="/catalog" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Каталог</NavLink>
        </nav>
        <div className="header-spacer" />
        {isMockMode && <span className="demo-badge" title="Данные хранятся в этом браузере">Демо-данные</span>}
        <div className="role-switch" aria-label="Демонстрационный режим">
          <button type="button" className={role.mode === 'business' ? 'selected' : ''}
            aria-pressed={role.mode === 'business'} onClick={() => setRole({ ...role, mode: 'business' })}>Бизнес</button>
          <button type="button" className={role.mode === 'team' ? 'selected' : ''}
            aria-pressed={role.mode === 'team'} onClick={() => setRole({ ...role, mode: 'team' })}>Команда</button>
        </div>
        {role.mode === 'team' && <label className="team-picker"><span className="sr-only">Профиль команды</span>
          <select value={role.teamId} onChange={(event) => setRole({ mode: 'team', teamId: event.target.value })}>
            {demoTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>}
      </div>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/tasks/:id" element={<TaskPage role={role} />} />
        <Route path="*" element={<div className="not-found page-width"><p className="eyebrow">404</p><h1>Страница не найдена</h1><Link className="button button-primary" to="/catalog">Открыть каталог</Link></div>} />
      </Routes>
    </main>
  </div>;
}
