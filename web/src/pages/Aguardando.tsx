import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import AcessoLayout from '../components/AcessoLayout'
import { useAuth } from '../auth/AuthProvider'

export default function Aguardando() {
  const { session, profile, loading, refreshProfile, signOut, profileError } = useAuth()
  const [conferindo, setConferindo] = useState(false)

  if (loading) return null
  if (!session) return <Navigate to="/entrar" replace />
  if (profile?.approved) return <Navigate to="/" replace />

  const primeiroNome = profile?.full_name?.split(' ')[0]

  return (
    <AcessoLayout
      titulo={primeiroNome ? `${primeiroNome}, seu cadastro está em análise` : 'Seu cadastro está em análise'}
      subtitulo="Os donos da Retratus conferem cada cadastro. Assim que aprovarem, você recebe um aviso aqui e passa a ver as vagas abertas."
      rodape={<button className="btn-texto" onClick={() => void signOut()}>Sair</button>}
    >
      {profileError && <p className="erro" role="alert">{profileError}</p>}
      <div className="moldura-acoes">
        <span />
        <button className="btn btn-ouro" disabled={conferindo} onClick={async () => { setConferindo(true); await refreshProfile(); setConferindo(false) }}>
          {conferindo ? 'Conferindo…' : 'Conferir de novo'}
        </button>
      </div>
    </AcessoLayout>
  )
}
