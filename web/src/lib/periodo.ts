import { useSearchParams } from 'react-router-dom'
import { addDays, inicioDaSemana, inicioDoMes, meiaNoite, proximoMes, splitLocal, todayLocal, tituloMes, tituloSemana } from './time'

export type VisaoPeriodo = 'semana' | 'mes'

/** Aceita só datas reais; o resto volta para hoje. */
function dataValida(v: string | null) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const t = new Date(`${v}T12:00:00-03:00`)
  return !Number.isNaN(t.getTime()) && splitLocal(t.toISOString()).date === v ? v : null
}

/** Período escolhido na URL (?v=semana|mes&d=AAAA-MM-DD), com o intervalo pronto para as RPCs. */
export function usePeriodo(padrao: VisaoPeriodo = 'mes') {
  const [params, setParams] = useSearchParams()
  const visao: VisaoPeriodo = params.get('v') === 'semana' ? 'semana' : params.get('v') === 'mes' ? 'mes' : padrao
  const data = dataValida(params.get('d')) ?? todayLocal()
  const inicio = visao === 'semana' ? inicioDaSemana(data) : inicioDoMes(data)
  const fim = visao === 'semana' ? addDays(inicio, 7) : proximoMes(inicio)
  const titulo = visao === 'semana' ? tituloSemana(data) : tituloMes(data)

  function ir(mudar: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(mudar)) { if (v === null) p.delete(k); else p.set(k, v) }
    setParams(p, { replace: true })
  }

  return {
    visao, data, inicio, fim, titulo,
    de: meiaNoite(inicio), ate: meiaNoite(fim),
    contemHoje: todayLocal() >= inicio && todayLocal() < fim,
    ir,
    passo: (n: number) => ir({ d: visao === 'semana' ? addDays(inicio, 7 * n) : proximoMes(inicio, n) }),
  }
}

export type Periodo = ReturnType<typeof usePeriodo>
