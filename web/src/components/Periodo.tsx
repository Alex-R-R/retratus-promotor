import type { Periodo } from '../lib/periodo'

export function BarraPeriodo({ periodo, children }: { periodo: Periodo; children?: React.ReactNode }) {
  const { visao, titulo, contemHoje, ir, passo } = periodo
  return (
    <div className="agenda-barra">
      <div className="segmentado" role="group" aria-label="Período">
        <button aria-pressed={visao === 'semana'} onClick={() => ir({ v: 'semana' })}>Semana</button>
        <button aria-pressed={visao === 'mes'} onClick={() => ir({ v: 'mes' })}>Mês</button>
      </div>
      <div className="agenda-navega">
        <button className="btn btn-linha seta" onClick={() => passo(-1)} aria-label={visao === 'semana' ? 'Semana anterior' : 'Mês anterior'}>‹</button>
        <button className="btn btn-linha" onClick={() => ir({ d: null })} disabled={contemHoje}>{visao === 'semana' ? 'Esta semana' : 'Este mês'}</button>
        <button className="btn btn-linha seta" onClick={() => passo(1)} aria-label={visao === 'semana' ? 'Próxima semana' : 'Próximo mês'}>›</button>
        <h2 className="agenda-titulo" aria-live="polite">{titulo}</h2>
      </div>
      {children && <div className="agenda-filtros">{children}</div>}
    </div>
  )
}
