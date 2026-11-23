import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { authErrorMessage, formatPhone, onlyDigits } from '../lib/format'
import { LINK_LABEL, ROLE_LABEL } from '../lib/types'

export default function Perfil() {
  const { profile, refreshProfile } = useAuth()
  const [nome, setNome] = useState(profile?.full_name ?? '')
  const [telefone, setTelefone] = useState(formatPhone(profile?.phone ?? ''))
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [senha, setSenha] = useState('')
  const [msgSenha, setMsgSenha] = useState<{ ok: boolean; texto: string } | null>(null)

  if (!profile) return null

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const fone = onlyDigits(telefone)
    if (nome.trim().length < 3) return setMsg({ ok: false, texto: 'Informe seu nome completo.' })
    if (fone.length < 10 || fone.length > 11) return setMsg({ ok: false, texto: 'Informe o telefone com DDD.' })
    const { error } = await supabase.from('profiles').update({ full_name: nome.trim(), phone: fone }).eq('id', profile!.id)
    if (error) return setMsg({ ok: false, texto: 'Não foi possível salvar. Tente de novo.' })
    await refreshProfile()
    setMsg({ ok: true, texto: 'Cadastro salvo.' })
  }

  async function trocarSenha(e: FormEvent) {
    e.preventDefault()
    if (senha.length < 6) return setMsgSenha({ ok: false, texto: 'A senha precisa ter pelo menos 6 caracteres.' })
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) return setMsgSenha({ ok: false, texto: authErrorMessage(error.message) })
    setSenha('')
    setMsgSenha({ ok: true, texto: 'Senha trocada.' })
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Meu cadastro</h1>
          <p className="subtitulo">{ROLE_LABEL[profile.role]}, {LINK_LABEL[profile.link].toLowerCase()}. {profile.email}</p>
        </div>
      </div>

      <form className="form-cartao" onSubmit={salvar} noValidate>
        <div className="campo">
          <label htmlFor="nome">Nome completo</label>
          <input id="nome" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" />
        </div>
        <div className="campo">
          <label htmlFor="tel">Telefone com DDD</label>
          <input id="tel" type="tel" inputMode="tel" value={telefone} onChange={e => setTelefone(e.target.value)} autoComplete="tel" />
        </div>
        {msg && <p className={msg.ok ? 'aviso-ok' : 'erro'} role="status">{msg.texto}</p>}
        <div><button className="btn">Salvar cadastro</button></div>
      </form>

      <section className="secao" aria-labelledby="senha-titulo">
        <h2 id="senha-titulo">Trocar senha</h2>
        <form className="form-cartao" onSubmit={trocarSenha} noValidate>
          <div className="campo">
            <label htmlFor="senha">Senha nova</label>
            <input id="senha" type="password" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} />
          </div>
          {msgSenha && <p className={msgSenha.ok ? 'aviso-ok' : 'erro'} role="status">{msgSenha.texto}</p>}
          <div><button className="btn btn-linha">Trocar senha</button></div>
        </form>
      </section>
    </>
  )
}
