import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { useAuth } from './auth/AuthProvider'
import { supabaseConfigured } from './lib/supabase'
import { isStaff, veMidias } from './lib/types'
import Shell from './components/Shell'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import RecuperarSenha from './pages/RecuperarSenha'
import NovaSenha from './pages/NovaSenha'
import Aguardando from './pages/Aguardando'
import Inicio from './pages/Inicio'
import SemConfiguracao from './pages/SemConfiguracao'

// Telas carregadas sob demanda: o celular baixa só o que vai abrir.
const Equipe = lazy(() => import('./pages/Equipe'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Trabalhos = lazy(() => import('./pages/Trabalhos'))
const TrabalhoForm = lazy(() => import('./pages/TrabalhoForm'))
const TrabalhoDetalhe = lazy(() => import('./pages/TrabalhoDetalhe'))
const Vagas = lazy(() => import('./pages/Vagas'))
const VagaDetalhe = lazy(() => import('./pages/VagaDetalhe'))
const Agenda = lazy(() => import('./pages/Agenda'))
const Valores = lazy(() => import('./pages/Valores'))
const Midias = lazy(() => import('./pages/Midias'))
const MidiaTrabalho = lazy(() => import('./pages/MidiaTrabalho'))

/** Links antigos de aviso (/jobs/<id>) levam à tela certa de cada perfil. */
function JobsLegado() {
  const { profile } = useAuth()
  const id = useLocation().pathname.split('/').pop()
  return <Navigate to={profile?.role === 'promoter' ? `/vagas/${id}` : profile?.role === 'media' ? `/midias/${id}` : `/trabalhos/${id}`} replace />
}

function Carregando() {
  return <div className="boot" role="status"><span className="boot-frame" aria-hidden="true" />Carregando…</div>
}

type Acesso = 'gestao' | 'trabalhos' | 'promotor' | 'dono' | 'midias'

function Protegida({ children, staffOnly = false, acesso }: { children: ReactNode; staffOnly?: boolean; acesso?: Acesso }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Carregando />
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  if (!profile) return <Carregando />
  if (!profile.approved) return <Navigate to="/aguardando" replace />
  const pode = acesso === 'dono' ? profile.role === 'owner'
    : acesso === 'promotor' ? profile.role === 'promoter'
    : acesso === 'midias' ? veMidias(profile)
    : acesso === 'trabalhos' ? profile.role !== 'promoter'
    : (staffOnly || acesso === 'gestao') ? isStaff(profile) : true
  if (!pode) return <Navigate to="/" replace />
  return <Shell><Suspense fallback={<p className="subtitulo">Carregando…</p>}>{children}</Suspense></Shell>
}

function Publica({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Carregando />
  if (session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  if (!supabaseConfigured) return <SemConfiguracao />
  return (
    <Routes>
      <Route path="/entrar" element={<Publica><Login /></Publica>} />
      <Route path="/cadastro" element={<Publica><Cadastro /></Publica>} />
      <Route path="/recuperar-senha" element={<Publica><RecuperarSenha /></Publica>} />
      <Route path="/nova-senha" element={<NovaSenha />} />
      <Route path="/aguardando" element={<Aguardando />} />
      <Route path="/" element={<Protegida><Inicio /></Protegida>} />
      <Route path="/equipe" element={<Protegida staffOnly><Equipe /></Protegida>} />
      <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />
      <Route path="/trabalhos" element={<Protegida acesso="trabalhos"><Trabalhos /></Protegida>} />
      <Route path="/trabalhos/novo" element={<Protegida acesso="gestao"><TrabalhoForm /></Protegida>} />
      <Route path="/trabalhos/:id" element={<Protegida acesso="trabalhos"><TrabalhoDetalhe /></Protegida>} />
      <Route path="/trabalhos/:id/editar" element={<Protegida acesso="gestao"><TrabalhoForm /></Protegida>} />
      <Route path="/vagas" element={<Protegida acesso="promotor"><Vagas /></Protegida>} />
      <Route path="/vagas/:id" element={<Protegida acesso="promotor"><VagaDetalhe /></Protegida>} />
      <Route path="/agenda" element={<Protegida><Agenda /></Protegida>} />
      <Route path="/valores" element={<Protegida acesso="dono"><Valores /></Protegida>} />
      <Route path="/midias" element={<Protegida acesso="midias"><Midias /></Protegida>} />
      <Route path="/midias/:id" element={<Protegida acesso="midias"><MidiaTrabalho /></Protegida>} />
      <Route path="/meus-trabalhos" element={<Navigate to="/agenda" replace />} />
      <Route path="/jobs/:id" element={<Protegida><JobsLegado /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
