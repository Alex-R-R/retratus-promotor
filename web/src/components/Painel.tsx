import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { brl, dbError, rpc, type DashboardCounts, type PromoterCount } from '../lib/jobs'
import { BarraPeriodo } from './Periodo'
import { usePeriodo } from '../lib/periodo'

interface Dados { contagem: DashboardCounts; pessoas: PromoterCount[] }

/** Painel da gestão: situação dos trabalhos do período e quanto cada promotor trabalhou. Valores só para os donos. */
export default function Painel({ dono }: { dono: boolean }) {
  const periodo = usePeriodo('mes')
  const { de, ate, visao, inicio, fim: fimPeriodo } = periodo
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let atual = true
    setDados(null); setErro(null)
    Promise.all([
      rpc<DashboardCounts[]>('dashboard_counts', { p_from: de, p_to: ate }),
      rpc<PromoterCount[]>('promoter_job_counts', { p_from: de, p_to: ate }),
    ]).then(([c, p]) => {
      if (!atual) return
      const e = c.error ?? p.error
      if (e) { setErro(dbError(e, 'Não foi possível carregar o painel.')); return }
      const z = { aguardando_briefing: 0, briefing_fechado: 0, vagas_abertas: 0, equipe_completa: 0 }
      const linha = c.data?.[0] ?? z
      setDados({
        contagem: Object.fromEntries(Object.entries(linha).map(([k, v]) => [k, Number(v)])) as unknown as DashboardCounts,
        pessoas: p.data ?? [],
      })
    })
    return () => { atual = false }
  }, [de, ate])

  const { ativos, parados, maior, totais } = useMemo(() => {
    const total = (p: PromoterCount) => Number(p.eventos) + Number(p.dias_acao)
    const lista = [...(dados?.pessoas ?? [])].sort((a, b) => total(b) - total(a) || a.full_name.localeCompare(b.full_name, 'pt-BR'))
    const ativos = lista.filter(p => total(p) > 0 || Number(p.valor_total ?? 0) > 0)
    return {
      ativos,
      parados: lista.filter(p => !ativos.includes(p)),
      maior: Math.max(1, ...ativos.map(total)),
      totais: lista.reduce((t, p) => ({
        valor: t.valor + Number(p.valor_total ?? 0),
        pago: t.pago + Number(p.valor_pago ?? 0),
        semValor: t.semValor + Number(p.sem_valor ?? 0),
      }), { valor: 0, pago: 0, semValor: 0 }),
    }
  }, [dados])

  const c = dados?.contagem
  const linkAgenda = `/agenda?v=${visao}&d=${inicio}&abertos=1`
  const linkValores = (f: string) => `/valores?v=${visao}&d=${inicio}&f=${f}`

  return (
    <section className="painel" aria-labelledby="painel-titulo">
      <h2 id="painel-titulo" className="sr">Painel do período</h2>
      <BarraPeriodo periodo={periodo} />

      {erro && <p className="erro" role="alert">{erro}</p>}
      {!dados && !erro && <p className="subtitulo">Carregando painel…</p>}

      {c && (
        <div className="placar">
          <Par
            titulo="Briefing com o contratante"
            nota="Trabalhos com dia no período, fora os cancelados."
            pendente={{ n: c.aguardando_briefing, label: 'Aguardando briefing', link: `/trabalhos?f=briefing&de=${inicio}&ate=${fimPeriodo}` }}
            feito={{ n: c.briefing_fechado, label: 'Briefing fechado' }}
          />
          <Par
            titulo="Equipe dos trabalhos publicados"
            nota="Equipe completa quando todo equipamento tem gente em todos os dias."
            pendente={{ n: c.vagas_abertas, label: 'Vagas em aberto', link: linkAgenda }}
            feito={{ n: c.equipe_completa, label: 'Equipe completa' }}
          />
        </div>
      )}

      {dono && dados && (
        <div className="caixa-valores">
          <div>
            <span className="rotulo">A pagar no período</span>
            <strong className="valor-grande">{brl(totais.valor - totais.pago)}</strong>
            <span className="meta-pequena">{brl(totais.valor)} lançados, {brl(totais.pago)} já pagos</span>
          </div>
          {totais.semValor > 0
            ? <Link className="btn btn-ouro" to={linkValores('sem')}>Lançar {totais.semValor} {totais.semValor === 1 ? 'valor pendente' : 'valores pendentes'}</Link>
            : <Link className="btn btn-linha" to={linkValores('apagar')}>Ver valores</Link>}
        </div>
      )}

      {dados && (
        <div className="secao">
          <h2>Trabalhos por promotor</h2>
          <p>Eventos contam uma vez; ações contam pelos dias trabalhados.{dono ? ' Valores contam no período do primeiro dia de cada trabalho.' : ''}</p>
          {ativos.length === 0
            ? <div className="vazio"><strong>Ninguém foi escalado neste período.</strong>Quando a gestão selecionar promotores, a contagem aparece aqui.</div>
            : (
              <table className={`ranking${dono ? ' com-valor' : ''}`}>
                <thead>
                  <tr>
                    <th scope="col">Promotor</th>
                    <th scope="col" className="num">Eventos</th>
                    <th scope="col" className="num">Dias de ação</th>
                    {dono && <th scope="col" className="num">Valor</th>}
                    {dono && <th scope="col" className="num">A pagar</th>}
                  </tr>
                </thead>
                <tbody>
                  {ativos.map(p => {
                    const total = Number(p.eventos) + Number(p.dias_acao)
                    const aPagar = Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0)
                    return (
                      <tr key={p.promoter_id}>
                        <th scope="row">
                          <Link to={`/agenda?v=${visao}&d=${inicio}&p=${p.promoter_id}`}>{p.full_name}</Link>
                          <span className="barra-total" aria-hidden="true"><i style={{ width: `${(total / maior) * 100}%` }} /></span>
                        </th>
                        <td className="num">{Number(p.eventos)}</td>
                        <td className="num">{Number(p.dias_acao)}</td>
                        {dono && (
                          <td className="num">
                            {brl(p.valor_total)}
                            {!!Number(p.sem_valor) && <span className="falta">{Number(p.sem_valor)} sem valor</span>}
                          </td>
                        )}
                        {dono && <td className={`num${aPagar > 0 ? '' : ' quitado'}`}>{aPagar > 0 ? brl(aPagar) : 'Quitado'}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          {parados.length > 0 && (
            <p className="parados"><strong>Sem trabalho no período:</strong> {parados.map(p => p.full_name).join(', ')}.</p>
          )}
        </div>
      )}
    </section>
  )
}

interface Lado { n: number; label: string; link?: string }

/** Duas contagens que somam o mesmo grupo de trabalhos, com a proporção desenhada. */
function Par({ titulo, nota, pendente, feito }: { titulo: string; nota: string; pendente: Lado; feito: Lado }) {
  const total = pendente.n + feito.n
  const parte = total ? (feito.n / total) * 100 : 0
  return (
    <div className="par">
      <div className="par-topo">
        <h3>{titulo}</h3>
        <span className="meta-pequena">{total} {total === 1 ? 'trabalho' : 'trabalhos'}</span>
      </div>
      <div className="par-barra" role="img" aria-label={`${feito.label}: ${feito.n} de ${total}`}>
        <i style={{ width: `${parte}%` }} />
      </div>
      <div className="par-numeros">
        <Numero lado={pendente} tom="pendente" />
        <Numero lado={feito} tom="feito" />
      </div>
      <p className="meta-pequena">{nota}</p>
    </div>
  )
}

function Numero({ lado, tom }: { lado: Lado; tom: 'pendente' | 'feito' }) {
  const corpo = <><strong>{lado.n}</strong><span>{lado.label}</span></>
  return lado.link && lado.n > 0
    ? <Link className={`par-num ${tom}`} to={lado.link}>{corpo}</Link>
    : <div className={`par-num ${tom}`}>{corpo}</div>
}
