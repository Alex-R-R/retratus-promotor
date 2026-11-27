import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileError: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const ultimaConsulta = useRef(0)

  const loadProfile = useCallback(async (s: Session | null) => {
    const consulta = ++ultimaConsulta.current
    if (!s) { setProfile(null); return }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    if (consulta !== ultimaConsulta.current) return  // resposta de uma sessão anterior
    if (error) {
      // Falha de rede não apaga o perfil já carregado da mesma pessoa; o de outra pessoa sai.
      setProfile(p => p?.id === s.user.id ? p : null)
      setProfileError('Não foi possível carregar seu cadastro. Confira a internet e tente de novo.')
      return
    }
    setProfileError(null)
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session)
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // Fora do callback para não travar o cliente de auth.
      setTimeout(() => { void loadProfile(s) }, 0)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const value: AuthState = {
    session, profile, loading, profileError,
    refreshProfile: () => loadProfile(session),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null) },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
