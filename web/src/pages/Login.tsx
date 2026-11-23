import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AcessoLayout from '../components/AcessoLayout'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/format'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null); setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) { setErro(authErrorMessage(error.message)); return }
    const destino = (location.state as { from?: string } | null)?.from ?? '/'
    navigate(destino, { replace: true })
  }

  return (
    <AcessoLayout
      titulo="Entrar"
      subtitulo="Use o e-mail e a senha do seu cadastro."
      rodape={<><Link to="/cadastro">Criar cadastro</Link><Link to="/recuperar-senha">Esqueci a senha</Link></>}
    >
      <form onSubmit={entrar} noValidate>
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} />
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="moldura-acoes">
          <span />
          <button className="btn btn-ouro" disabled={enviando || !email || !senha}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        </div>
      </form>
    </AcessoLayout>
  )
}
