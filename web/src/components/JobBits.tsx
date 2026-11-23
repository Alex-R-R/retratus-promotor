import { dia, diaSemana, mes } from '../lib/time'

/** Bloco de data no estilo folha de escala: dia grande condensado, mês e dia da semana. */
export function DataBloco({ iso }: { iso: string | null }) {
  if (!iso) return <div className="data-bloco vazio-data" aria-label="Sem data">—</div>
  return (
    <div className="data-bloco">
      <span className="data-dia">{dia(iso)}</span>
      <span className="data-mes">{mes(iso)}</span>
      <span className="data-semana">{diaSemana(iso)}</span>
    </div>
  )
}

/** Ocupação: um traço por vaga-dia até 12; acima disso, só o número. */
export function Ocupacao({ preenchidas, total }: { preenchidas: number; total: number }) {
  if (total === 0) return <span className="ocupacao-texto">Sem vagas definidas</span>
  const tracos = total <= 12
  return (
    <span className="ocupacao" aria-label={`${preenchidas} de ${total} vagas preenchidas`}>
      {tracos && (
        <span className="ocupacao-tracos" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < preenchidas ? 'cheio' : ''} />)}
        </span>
      )}
      <span className="ocupacao-texto">{preenchidas} de {total}</span>
    </span>
  )
}

export function Etiqueta({ tom, children }: { tom: 'ouro' | 'tinta' | 'neutro' | 'alerta' | 'ok'; children: React.ReactNode }) {
  return <span className={`etiqueta etiqueta-${tom}`}>{children}</span>
}
