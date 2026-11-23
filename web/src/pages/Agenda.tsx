import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Etiqueta } from '../components/JobBits'
import { BRIEFING_LABEL, dbError, rpc, situacaoDia, TIPO_LABEL, type CalRow } from '../lib/jobs'
import {
  addDays, faixa, gradeDoMes, hora, inicioDaSemana, inicioDoMes, meiaNoite, nomeSemanaCurto, numeroDia,
  proximoMes, splitLocal, todayLocal, tituloDia, tituloMes, tituloSemana,
} from '../lib/time'
import { isStaff } from '../lib/types'

type Visao = 'dia' | 'semana' | 'mes'
const VISOES: { id: Visao; label: string }[] = [{ id: 'dia', label: 'Dia' }, { id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mês' }]
/** Aceita só datas reais (2026-13-01 e 2026-02-30 voltam para hoje em vez de quebrar ou virar outro mês). */
function dataValida(v: string | null) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const t = new Date(`${v}T12:00:00-03:00`)
  return !Number.isNaN(t.getTime()) && splitLocal(t.toISOString()).date === v ? v : null
}

const SITUACAO_LABEL = { cancelado: 'Cancelado', rascunho: 'Rascunho', completo: 'Equipe completa', aberto: 'Vagas em aberto', meu: '' } as const

export default function Agenda() {
  const { profile } = useAuth()
  const gestao = isStaff(profile)
  const verTodos = profile?.role !== 'promoter'
  const [params, setParams] = useSearchParams()

  const visao: Visao = (['dia', 'semana', 'mes'] as const).find(v => v === params.get('v')) ?? (verTodos ? 'semana' : 'mes')
  const data = dataValida(params.get('d')) ?? todayLocal()
  // Filtros só valem para quem vê o controle; um link com ?p= ou ?abertos= não esconde a agenda de mais ninguém.
  const filtroPessoa = verTodos ? (params.get('p') ?? '') : ''
  const soAbertos = gestao && params.get('abertos') === '1'
  const hoje = todayLocal()

  const [linhas, setLinhas] = useState<CalRow[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  /** Intervalo de datas locais [inicio, fimExclusivo) mostrado na visão atual. */
  const [inicio, fim] = useMemo(() => {
    if (visao === 'dia') return [data, addDays(data, 1)]
    if (visao === 'semana') { const s = inicioDaSemana(data); return [s, addDays(s, 7)] }
    const g = gradeDoMes(data); return [g[0], addDays(g[g.length - 1], 1)]
  }, [visao, data])

  useEffect(() => {
    let atual = true
    setLinhas(null); setErro(null)
    rpc<CalRow[]>('calendar', { p_from: meiaNoite(inicio), p_to: meiaNoite(fim) }).then(({ data: d, error }) => {
      if (!atual) return
      if (error) { setErro(dbError(error, 'Não foi possível carregar a agenda.')); return }
      setLinhas(d ?? [])
    })
    return () => { atual = false }
  }, [inicio, fim])

  // Lista do filtro sai das próprias escalas do período: funciona para gestão e mídia
  // (mídia não lê a tabela de perfis) e só oferece quem tem trabalho.
  const pessoas = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of linhas ?? []) for (const p of r.promoters) m.set(p.promoter_id, p.full_name)
    return [...m].map(([id, full_name]) => ({ id, full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
  }, [linhas])

  const visiveis = useMemo(() => (linhas ?? []).filter(r =>
    (!filtroPessoa || r.promoters.some(p => p.promoter_id === filtroPessoa)) &&
    (!soAbertos || situacaoDia(r) === 'aberto')), [linhas, filtroPessoa, soAbertos])

  /**
   * Cada dia de trabalho aparece na data em que começa. Um turno que começou antes do período
   * (ex.: domingo 22h a segunda 2h, vendo a semana de segunda) aparece no primeiro dia mostrado.
   */
  const porData = useMemo(() => {
    const m = new Map<string, CalRow[]>()
    for (const r of visiveis) {
      const comeco = splitLocal(r.starts_at).date
      const d = comeco < inicio ? inicio : comeco
      m.set(d, [...(m.get(d) ?? []), r])
    }
    return m
  }, [visiveis, inicio])

  function ir(mudanca: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(mudanca)) { if (v === null || v === '') p.delete(k); else p.set(k, v) }
    setParams(p, { replace: false })
  }

  const passo = (n: number) => {
    if (visao === 'dia') return ir({ d: addDays(data, n) })
    if (visao === 'semana') return ir({ d: addDays(data, 7 * n) })
    ir({ d: proximoMes(inicioDoMes(data), n) })
  }

  const titulo = visao === 'dia' ? tituloDia(data) : visao === 'semana' ? tituloSemana(data) : tituloMes(data)
  const nomePessoa = pessoas.find(p => p.id === filtroPessoa)?.full_name

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Agenda</h1>
          <p className="subtitulo">
            {verTodos ? 'Quando, onde e quem trabalha em cada evento e ação.' : 'Os dias em que você está escalado, com horário, local e equipamento.'}
          </p>
        </div>
      </div>

      <div className="agenda-barra">
        <div className="segmentado" role="tablist" aria-label="Visão da agenda">
          {VISOES.map(v => <button key={v.id} role="tab" aria-selected={visao === v.id} onClick={() => ir({ v: v.id })}>{v.label}</button>)}
        </div>
        <div className="agenda-navega">
          <button className="btn btn-linha seta" onClick={() => passo(-1)} aria-label="Anterior">‹</button>
          <button className="btn btn-linha" onClick={() => ir({ d: null })} disabled={data === hoje}>Hoje</button>
          <button className="btn btn-linha seta" onClick={() => passo(1)} aria-label="Próximo">›</button>
          <h2 className="agenda-titulo" aria-live="polite">{titulo}</h2>
        </div>
        {verTodos && (
          <div className="agenda-filtros">
            <select aria-label="Filtrar por promotor" value={filtroPessoa} onChange={e => ir({ p: e.target.value || null })}>
              <option value="">Toda a equipe</option>
              {pessoas.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              {filtroPessoa && !nomePessoa && <option value={filtroPessoa}>Pessoa sem trabalho neste período</option>}
            </select>
            {gestao && (
              <label className="marcar">
                <input type="checkbox" checked={soAbertos} onChange={e => ir({ abertos: e.target.checked ? '1' : null })} />
                Só com vagas em aberto
              </label>
            )}
          </div>
        )}
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {linhas === null && !erro && <p className="subtitulo">Carregando agenda…</p>}

      {linhas && !erro && visao === 'mes' && <Mes data={data} hoje={hoje} porData={porData} abrirDia={d => ir({ v: 'dia', d })} />}
      {linhas && !erro && visao === 'semana' && <Semana data={data} hoje={hoje} porData={porData} abrirDia={d => ir({ v: 'dia', d })} gestao={verTodos} />}
      {linhas && !erro && visao === 'dia' && <Dia data={data} itens={porData.get(data) ?? []} gestao={verTodos} />}

      {linhas && !erro && visiveis.length === 0 && (
        <div className="vazio" style={{ marginTop: 16 }}>
          <strong>{filtroPessoa ? `${nomePessoa ?? 'Esta pessoa'} não tem trabalho neste período.` : soAbertos ? 'Nenhum trabalho com vagas em aberto neste período.' : verTodos ? 'Nenhum trabalho neste período.' : 'Você não está escalado neste período.'}</strong>
          {!verTodos && 'Candidate-se nas vagas abertas. Quando a gestão escolher você, o trabalho aparece aqui.'}
        </div>
      )}

      {verTodos && linhas && visao !== 'dia' && visiveis.length > 0 && (
        <ul className="legenda" aria-label="Legenda">
          <li><i className="marca-completo" />Equipe completa</li>
          <li><i className="marca-aberto" />Vagas em aberto</li>
          {gestao && <li><i className="marca-rascunho" />Rascunho</li>}
          <li><i className="marca-cancelado" />Cancelado</li>
        </ul>
      )}
    </>
  )
}

function Mes({ data, hoje, porData, abrirDia }: { data: string; hoje: string; porData: Map<string, CalRow[]>; abrirDia: (d: string) => void }) {
  const grade = gradeDoMes(data)
  const mes = data.slice(0, 7)
  return (
    // Botões comuns (cada um com a data completa no nome); os cabeçalhos são só visuais.
    <div className="mes" role="group" aria-label={tituloMes(data)}>
      {grade.slice(0, 7).map(d => <div key={d} className="mes-cab" aria-hidden="true">{nomeSemanaCurto(d)}</div>)}
      {grade.map(d => {
        const itens = porData.get(d) ?? []
        const fora = d.slice(0, 7) !== mes
        return (
          <button key={d} aria-current={d === hoje ? 'date' : undefined} className={`mes-dia${fora ? ' fora' : ''}${d === hoje ? ' hoje' : ''}${itens.length ? ' com' : ''}`}
            onClick={() => abrirDia(d)} aria-label={`${tituloDia(d)}: ${itens.length ? `${itens.length} ${itens.length === 1 ? 'trabalho' : 'trabalhos'}` : 'sem trabalho'}`}>
            <span className="mes-num">{numeroDia(d)}</span>
            <span className="mes-itens">
              {itens.slice(0, 3).map(r => (
                <span key={r.day_id} className={`mes-item s-${situacaoDia(r)}`}>
                  <b>{hora(r.starts_at)}</b> {r.title}
                </span>
              ))}
              {itens.length > 3 && <span className="mes-mais">mais {itens.length - 3}</span>}
            </span>
            {itens.length > 0 && <span className="mes-contagem" aria-hidden="true">{itens.length}</span>}
          </button>
        )
      })}
    </div>
  )
}

function Semana({ data, hoje, porData, abrirDia, gestao }: { data: string; hoje: string; porData: Map<string, CalRow[]>; abrirDia: (d: string) => void; gestao: boolean }) {
  const ini = inicioDaSemana(data)
  const dias = Array.from({ length: 7 }, (_, i) => addDays(ini, i))
  return (
    <div className="semana">
      {dias.map(d => {
        const itens = porData.get(d) ?? []
        return (
          <section key={d} className={`semana-dia${d === hoje ? ' hoje' : ''}${itens.length ? '' : ' livre'}`} aria-label={tituloDia(d)}>
            <button className="semana-cab" onClick={() => abrirDia(d)}>
              <span className="semana-nome">{nomeSemanaCurto(d)}</span>
              <span className="semana-num">{numeroDia(d)}</span>
            </button>
            <div className="semana-itens">
              {itens.map(r => <Cartao key={r.day_id} r={r} gestao={gestao} exibidoEm={d} compacto />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Dia({ data, itens, gestao }: { data: string; itens: CalRow[]; gestao: boolean }) {
  if (!itens.length) return null
  return <div className="dia-lista">{itens.map(r => <Cartao key={r.day_id} r={r} gestao={gestao} exibidoEm={data} />)}</div>
}

function Cartao({ r, gestao, exibidoEm, compacto = false }: { r: CalRow; gestao: boolean; exibidoEm: string; compacto?: boolean }) {
  const sit = situacaoDia(r)
  const comecouAntes = splitLocal(r.starts_at).date < exibidoEm
  const madrugada = splitLocal(r.starts_at).date !== splitLocal(new Date(new Date(r.ends_at).getTime() - 1).toISOString()).date
  const local = [r.location, r.city].filter(Boolean).join(', ')
  const titulo = gestao ? <Link to={`/trabalhos/${r.job_id}`}>{r.title}</Link> : r.title

  return (
    <article className={`cartao s-${sit}${compacto ? ' compacto' : ''}`}>
      <div className="cartao-hora">
        <span className="folha-hora">{faixa(r.starts_at, r.ends_at)}</span>
        {comecouAntes ? <span className="madrugada">começou no dia anterior</span> : madrugada && <span className="madrugada">termina no dia seguinte</span>}
      </div>
      <h3 className="cartao-titulo">{titulo}</h3>
      {local && <p className="cartao-local">{local}</p>}
      {!compacto && (
        <p className="cartao-meta">
          <span>{TIPO_LABEL[r.type]}</span>
          {r.client_name && <span>{r.client_name}</span>}
        </p>
      )}
      {(sit !== 'meu' && sit !== 'aberto' && sit !== 'completo') && <Etiqueta tom={sit === 'cancelado' ? 'alerta' : 'neutro'}>{SITUACAO_LABEL[sit]}</Etiqueta>}
      {!compacto && gestao && r.status !== 'cancelado' && r.briefing === 'aguardando' && <Etiqueta tom="ouro">{BRIEFING_LABEL.aguardando}</Etiqueta>}

      {gestao && r.slots ? (
        <ul className="cartao-equipe">
          {r.slots.map(s => {
            const nomes = r.promoters.filter(p => p.equipment === s.equipment)
            return (
              <li key={s.equipment}>
                <span className="cartao-equip">{s.equipment} <b className={s.filled < s.capacity ? 'falta' : ''}>{s.filled}/{s.capacity}</b></span>
                {nomes.length > 0 && <span className="cartao-nomes">{nomes.map(p => p.full_name).join(', ')}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        r.promoters.length > 0 && <p className="cartao-meu">Você opera {[...new Set(r.promoters.map(p => p.equipment))].join(' e ')}</p>
      )}
    </article>
  )
}
