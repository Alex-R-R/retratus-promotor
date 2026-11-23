import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth/AuthProvider'
import { supabaseConfigured } from './lib/supabase'
import { isStaff } from './lib/types'
import Shell from './components/Shell'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import RecuperarSenha from './pages/RecuperarSenha'
import NovaSenha from './pages/NovaSenha'
import Aguardando from './pages/Aguardando'
import Inicio from './pages/Inicio'
import Equipe from './pages/Equipe'
import Perfil from './pages/Perfil'
import SemConfiguracao from './pages/SemConfiguracao'
import Trabalhos from './pages/Trabalhos'
import TrabalhoForm from './pages/TrabalhoForm'
import TrabalhoDetalhe from './pages/TrabalhoDetalhe'
import Vagas from './pages/Vagas'
import VagaDetalhe from './pages/VagaDetalhe'
import MeusTrabalhos from './pages/MeusTrabalhos'

/** Links antigos de aviso (/jobs/<id>) levam à tela certa de cada perfil. */
function JobsLegado() {
  const { profile } = useAuth()
  const id = useLocation().pathname.split('/').pop()
  return <Navigate to={profile?.role === 'promoter' ? `/vagas/${id}` : `/trabalhos/${id}`} replace />
}

function Carregando() {
  return <div className="boot" role="status"><span className="boot-frame" aria-hidden="true" />Carregando…</div>
}

type Acesso = 'gestao' | 'trabalhos' | 'promotor'

function Protegida({ children, staffOnly = false, acesso }: { children: ReactNode; staffOnly?: boolean; acesso?: Acesso }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Carregando />
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  if (!profile) return <Carregando />
  if (!profile.approved) return <Navigate to="/aguardando" replace />
  const pode = acesso === 'promotor' ? profile.role === 'promoter'
    : acesso === 'trabalhos' ? profile.role !== 'promoter'
    : (staffOnly || acesso === 'gestao') ? isStaff(profile) : true
  if (!pode) return <Navigate to="/" replace />
  return <Shell>{children}</Shell>
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
      <Route path="/meus-trabalhos" element={<Protegida acesso="promotor"><MeusTrabalhos /></Protegida>} />
      <Route path="/jobs/:id" element={<Protegida><JobsLegado /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
