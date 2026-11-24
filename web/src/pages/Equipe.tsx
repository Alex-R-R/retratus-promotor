import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { formatDate, formatPhone } from '../lib/format'
import { LINK_LABEL, ROLE_LABEL, type PersonLink, type Profile, type UserRole } from '../lib/types'

type Aba = 'pendentes' | 'ativos'

export default function Equipe() {
  const { profile: eu } = useAuth()
  const dono = eu?.role === 'owner'
  const [pessoas, setPessoas] = useState<Profile[] | null>(null)
  const [aba, setAba] = useState<Aba>('pendentes')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) setErro('Não foi possível carregar a equipe.')
    setPessoas((data as Profile[]) ?? [])
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const pendentes = pessoas?.filter(p => !p.approved) ?? []
  const ativos = pessoas?.filter(p => p.approved) ?? []
  useEffect(() => { if (pessoas && pendentes.length === 0) setAba('ativos') }, [pessoas, pendentes.length])

  async function alterar(p: Profile, mudanca: Partial<Pick<Profile, 'approved' | 'role' | 'link'>>, mensagemErro: string) {
    setSalvando(p.id); setErro(null)
    const { error } = await supabase.from('profiles').update(mudanca).eq('id', p.id)
    setSalvando(null)
    if (error) return setErro(mensagemErro)
    setPessoas(ps => ps?.map(x => x.id === p.id ? { ...x, ...mudanca } : x) ?? null)
  }

  const lista = aba === 'pendentes' ? pendentes : ativos

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Equipe</h1>
          <p className="subtitulo">
            {dono ? 'Aprove cadastros novos e defina o perfil e o vínculo de cada pessoa.' : 'Consulte a equipe. Aprovações e mudanças de perfil são feitas pelos donos.'}
          </p>
        </div>
      </div>

      <div className="abas" role="group" aria-label="Cadastros">
        <button aria-pressed={aba === 'pendentes'} onClick={() => setAba('pendentes')}>Aguardando aprovação ({pendentes.length})</button>
        <button aria-pressed={aba === 'ativos'} onClick={() => setAba('ativos')}>Equipe ativa ({ativos.length})</button>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {pessoas === null && <p className="subtitulo">Carregando equipe…</p>}
      {pessoas && lista.length === 0 && (
        <div className="vazio" style={{ marginTop: 16 }}>
          <strong>{aba === 'pendentes' ? 'Nenhum cadastro esperando.' : 'Ninguém aprovado ainda.'}</strong>
          {aba === 'pendentes' ? 'Quando alguém criar um cadastro, ele aparece aqui para aprovação.' : 'Aprove os cadastros na outra aba.'}
        </div>
      )}

      {lista.length > 0 && (
        <ul className="lista">
          {lista.map(p => (
            <li key={p.id}>
              <div>
                <div className="nome">{p.full_name}</div>
                <div className="meta">
                  {p.phone && <span>{formatPhone(p.phone)}</span>}
                  {p.email && <span>{p.email}</span>}
                  {aba === 'pendentes' ? <span>Cadastrado em {formatDate(p.created_at)}</span> : <span>{ROLE_LABEL[p.role]}, {LINK_LABEL[p.link].toLowerCase()}</span>}
                </div>
              </div>
              {dono && p.id !== eu?.id && (
                <div className="acoes">
                  <select aria-label={`Perfil de ${p.full_name}`} value={p.role} disabled={salvando === p.id}
                    onChange={e => void alterar(p, { role: e.target.value as UserRole }, 'Não foi possível mudar o perfil.')}>
                    {(Object.keys(ROLE_LABEL) as UserRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <select aria-label={`Vínculo de ${p.full_name}`} value={p.link} disabled={salvando === p.id}
                    onChange={e => void alterar(p, { link: e.target.value as PersonLink }, 'Não foi possível mudar o vínculo.')}>
                    {(Object.keys(LINK_LABEL) as PersonLink[]).map(l => <option key={l} value={l}>{LINK_LABEL[l]}</option>)}
                  </select>
                  {p.approved
                    ? <button className="btn btn-linha" disabled={salvando === p.id} onClick={() => { if (confirm(`Suspender o acesso de ${p.full_name}?`)) void alterar(p, { approved: false }, 'Não foi possível suspender o acesso.') }}>Suspender acesso</button>
                    : <button className="btn" disabled={salvando === p.id} onClick={() => void alterar(p, { approved: true }, 'Não foi possível aprovar o cadastro.')}>Aprovar cadastro</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
