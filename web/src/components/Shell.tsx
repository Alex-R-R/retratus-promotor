import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import logo from '../assets/retratus-dark.png'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { isStaff, ROLE_LABEL, veMidias } from '../lib/types'

export default function Shell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const staff = isStaff(profile)
  const [pendentes, setPendentes] = useState(0)

  const { pathname } = useLocation()

  // Recontado a cada troca de página, para refletir aprovações recém-feitas.
  useEffect(() => {
    if (!staff) return
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approved', false)
      .then(({ count }) => setPendentes(count ?? 0))
  }, [staff, pathname])

  const promotor = profile?.role === 'promoter'
  const itens = [
    { to: '/', label: 'Início', show: true },
    { to: '/trabalhos', label: 'Trabalhos', show: !promotor },
    { to: '/vagas', label: 'Vagas', show: promotor },
    { to: '/agenda', label: 'Agenda', show: true },
    { to: '/midias', label: 'Mídias', show: veMidias(profile) },
    { to: '/valores', label: 'Valores', show: profile?.role === 'owner' },
    { to: '/contratantes', label: 'Contratantes', show: staff },
    { to: '/equipe', label: 'Equipe', show: staff, contador: pendentes },
    { to: '/perfil', label: 'Meu cadastro', show: true, soDesktop: true },
  ].filter(i => i.show)

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-logo"><img src={logo} alt="Retratus" /></div>
        <nav className="nav" aria-label="Principal">
          {itens.map(i => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'}>
              {i.label}
              {!!i.contador && <span className="contador" aria-label={`${i.contador} aguardando aprovação`}>{i.contador}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="rail-pessoa">
          <strong>{profile?.full_name}</strong>
          <span>{profile ? ROLE_LABEL[profile.role] : ''}</span>
          <button className="btn-texto" onClick={() => void signOut()}>Sair</button>
        </div>
      </aside>

      <header className="topo-movel">
        <img src={logo} alt="Retratus" />
        <div className="topo-acoes">
          <NavLink to="/perfil">Meu cadastro</NavLink>
          <button className="btn-texto" onClick={() => void signOut()}>Sair</button>
        </div>
      </header>

      <main className="conteudo">{children}</main>

      <nav className="nav-movel" aria-label="Principal">
        {itens.filter(i => !i.soDesktop).map(i => <NavLink key={i.to} to={i.to} end={i.to === '/'}>{i.label}</NavLink>)}
      </nav>
    </div>
  )
}
