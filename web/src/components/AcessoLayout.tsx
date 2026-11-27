import type { ReactNode } from 'react'
import logo from '../assets/retratus-dark.png'

interface Props {
  titulo: string
  subtitulo?: string
  children: ReactNode
  rodape?: ReactNode
}

// Moldura dourada aberta do logo. O botão principal ocupa a abertura (ver .moldura-acoes).
export default function AcessoLayout({ titulo, subtitulo, children, rodape }: Props) {
  return (
    <main className="acesso">
      <div className="acesso-marca">
        <img src={logo} alt="Retratus" />
        <p>Vagas e escalas de eventos e ações.</p>
      </div>
      <div>
        <section className="moldura" aria-labelledby="titulo-acesso">
          <span className="moldura-ponta" aria-hidden="true" />
          <h1 id="titulo-acesso" className="titulo-m">{titulo}</h1>
          {subtitulo && <p className="subtitulo">{subtitulo}</p>}
          {children}
        </section>
        {rodape && <div className="moldura-rodape">{rodape}</div>}
      </div>
    </main>
  )
}
