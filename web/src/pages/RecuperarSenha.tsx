import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AcessoLayout from '../components/AcessoLayout'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/format'

export default function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null); setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/nova-senha` })
    setEnviando(false)
    if (error) return setErro(authErrorMessage(error.message))
    setEnviado(true)
  }

  return (
    <AcessoLayout
      titulo="Recuperar senha"
      subtitulo="Enviamos um link para você criar uma senha nova."
      rodape={<Link to="/entrar">Voltar para entrar</Link>}
    >
      <form onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor="email">E-mail do cadastro</label>
          <input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {enviado && <p className="aviso-ok" role="status">Se houver cadastro com este e-mail, o link chega em alguns minutos. Confira também o spam.</p>}
        <div className="moldura-acoes">
          <span />
          <button className="btn btn-ouro" disabled={enviando || !email}>{enviando ? 'Enviando…' : 'Enviar link'}</button>
        </div>
      </form>
    </AcessoLayout>
  )
}
