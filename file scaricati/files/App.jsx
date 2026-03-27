import { useState } from 'react'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import Dashboard from './pages/Dashboard'
import Atleti from './pages/Atleti'
import Attrezzature from './pages/Attrezzature'
import Calendario from './pages/Calendario'
import Modulistica from './pages/Modulistica'
import LoginPage from './pages/LoginPage'
import './index.css'

const TABS = [
  { id: 'home',          label: 'Home',       icon: IconHome },
  { id: 'atleti',        label: 'Atleti',     icon: IconAtleti },
  { id: 'attrezzature',  label: 'Attrezz.',   icon: IconSkate },
  { id: 'calendario',    label: 'Calendario', icon: IconCal },
  { id: 'modulistica',   label: 'Moduli',     icon: IconDoc },
]

export default function App() {
  const { isSignedIn, user, loading, errore, signIn } = useGoogleAuth()
  const [tab, setTab] = useState('home')

  if (loading) return <div className="loading-center">Caricamento...</div>
  if (!isSignedIn) return <LoginPage onSignIn={signIn} errore={errore} />

  return (
    <div className="app-layout">
      <div className="page-content">
        {tab === 'home'         && <Dashboard />}
        {tab === 'atleti'       && <Atleti />}
        {tab === 'attrezzature' && <Attrezzature />}
        {tab === 'calendario'   && <Calendario />}
        {tab === 'modulistica'  && <Modulistica />}
      </div>

      <nav className="bottom-nav">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon />
              {t.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ============================================================
// ICONE SVG inline
// ============================================================

function IconHome() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
}

function IconAtleti() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
}

function IconSkate() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="8" width="20" height="8" rx="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>
  </svg>
}

function IconCal() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
}

function IconDoc() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
}
