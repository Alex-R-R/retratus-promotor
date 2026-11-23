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

function Carregando() {
  return <div className="boot" role="status"><span className="boot-frame" aria-hidden="true" />Carregando…</div>
}

function Protegida({ children, staffOnly = false }: { children: ReactNode; staffOnly?: boolean }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Carregando />
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  if (!profile) return <Carregando />
  if (!profile.approved) return <Navigate to="/aguardando" replace />
  if (staffOnly && !isStaff(profile)) return <Navigate to="/" replace />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
