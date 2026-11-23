import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AcessoLayout from '../components/AcessoLayout'
import { supabase } from '../lib/supabase'
import { authErrorMessage, onlyDigits } from '../lib/format'

export default function Cadastro() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarEmail, setConfirmarEmail] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function cadastrar(e: FormEvent) {
    e.preventDefault()
    const fone = onlyDigits(telefone)
    if (nome.trim().length < 3) return setErro('Informe seu nome completo.')
    if (fone.length < 10 || fone.length > 11) return setErro('Informe o telefone com DDD, por exemplo (91) 98888-7777.')
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    setErro(null); setEnviando(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { full_name: nome.trim(), phone: fone }, emailRedirectTo: `${window.location.origin}/aguardando` },
    })
    setEnviando(false)
    if (error) return setErro(authErrorMessage(error.message))
    if (data.session) navigate('/aguardando', { replace: true })
    else setConfirmarEmail(true)
  }

  if (confirmarEmail) {
    return (
      <AcessoLayout titulo="Confira seu e-mail" subtitulo={`Enviamos um link de confirmação para ${email}. Depois de confirmar, seu cadastro segue para aprovação dos donos.`}
        rodape={<Link to="/entrar">Voltar para entrar</Link>}>
        <span />
      </AcessoLayout>
    )
  }

  return (
    <AcessoLayout
      titulo="Criar cadastro"
      subtitulo="Os donos da Retratus aprovam cada cadastro antes do primeiro acesso às vagas."
      rodape={<>Já tem cadastro? <Link to="/entrar">Entrar</Link></>}
    >
      <form onSubmit={cadastrar} noValidate>
        <div className="campo">
          <label htmlFor="nome">Nome completo</label>
          <input id="nome" autoComplete="name" required value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="telefone">Telefone com DDD</label>
          <input id="telefone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(91) 98888-7777" value={telefone} onChange={e => setTelefone(e.target.value)} />
          <span className="dica">Usado pela gestão para falar com você sobre os trabalhos.</span>
        </div>
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="new-password" required value={senha} onChange={e => setSenha(e.target.value)} />
          <span className="dica">Pelo menos 6 caracteres.</span>
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="moldura-acoes">
          <span />
          <button className="btn btn-ouro" disabled={enviando}>{enviando ? 'Enviando…' : 'Criar cadastro'}</button>
        </div>
      </form>
    </AcessoLayout>
  )
}
