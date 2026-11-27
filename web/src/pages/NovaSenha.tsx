import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AcessoLayout from '../components/AcessoLayout'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/format'

// Destino do link de recuperação: o Supabase abre uma sessão temporária a partir da URL.
export default function NovaSenha() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    setErro(null); setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) return setErro(authErrorMessage(error.message))
    navigate('/', { replace: true })
  }

  if (!loading && !session) {
    return (
      <AcessoLayout titulo="Link expirado" subtitulo="Este link de recuperação não vale mais. Peça um novo na tela de entrar.">
        <div className="moldura-acoes"><span /><a className="btn btn-ouro" href="/recuperar-senha">Pedir novo link</a></div>
      </AcessoLayout>
    )
  }

  return (
    <AcessoLayout titulo="Criar senha nova" subtitulo="Depois de salvar, você entra direto no app.">
      <form onSubmit={salvar} noValidate>
        <div className="campo">
          <label htmlFor="senha">Senha nova</label>
          <input id="senha" type="password" autoComplete="new-password" required value={senha} onChange={e => setSenha(e.target.value)} />
          <span className="dica">Pelo menos 8 caracteres.</span>
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="moldura-acoes"><span /><button className="btn btn-ouro" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha'}</button></div>
      </form>
    </AcessoLayout>
  )
}
