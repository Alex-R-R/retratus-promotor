import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarraPeriodo } from '../components/Periodo'
import { usePeriodo } from '../lib/periodo'
import { Etiqueta } from '../components/JobBits'
import { brl, dbError, duracao, lerValor, rpc, TIPO_LABEL, valorCampo, type PaymentRow } from '../lib/jobs'
import { supabase } from '../lib/supabase'
import { dataCurta, dataHora } from '../lib/time'

type Filtro = 'sem' | 'apagar' | 'pagos' | 'todos'
const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'sem', label: 'Sem valor' },
  { id: 'apagar', label: 'A pagar' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'todos', label: 'Todos' },
]

export default function Valores() {
  const periodo = usePeriodo('mes')
  const { de, ate } = periodo
  const [params] = useSearchParams()
  const filtro: Filtro = FILTROS.find(f => f.id === params.get('f'))?.id ?? 'apagar'

  const [linhas, setLinhas] = useState<PaymentRow[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let atual = true
    setErro(null)
    rpc<PaymentRow[]>('payments_overview', { p_from: de, p_to: ate }).then(({ data, error }) => {
      if (!atual) return
      if (error) { setErro(dbError(error, 'Não foi possível carregar os valores.')); setLinhas([]); return }
      setLinhas(data ?? [])
    })
    return () => { atual = false }
  }, [de, ate, recarga])

  // Troca de período: some a lista antiga para não editar a linha de outro mês.
  useEffect(() => { setLinhas(null) }, [de, ate])

  const recarregar = () => setRecarga(n => n + 1)

  // Gravações em andamento ficam na página (não na linha), para sobreviver à troca de filtro.
  // Depois de cada gravação a lista é relida do banco, em vez de remontada com dados de antes do pedido.
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set())
  async function escrever(id: string, pedido: () => PromiseLike<{ error: { message: string; code?: string } | null }>) {
    if (ocupados.has(id)) return null
    setOcupados(o => new Set(o).add(id))
    const { error } = await pedido()
    setOcupados(o => { const n = new Set(o); n.delete(id); return n })
    recarregar()
    return error
  }

  const resumo = useMemo(() => {
    const ls = linhas ?? []
    const soma = (f: (l: PaymentRow) => boolean) => ls.filter(f).reduce((t, l) => t + Number(l.amount ?? 0), 0)
    return {
      total: soma(l => l.amount !== null),
      pago: soma(l => !!l.paid_at),
      aPagar: soma(l => l.amount !== null && !l.paid_at),
      sem: ls.filter(l => l.amount === null).length,
      apagar: ls.filter(l => l.amount !== null && !l.paid_at).length,
      pagos: ls.filter(l => !!l.paid_at).length,
      todos: ls.length,
    }
  }, [linhas])

  const grupos = useMemo(() => {
    const visiveis = (linhas ?? []).filter(l =>
      filtro === 'sem' ? l.amount === null
        : filtro === 'apagar' ? l.amount !== null && !l.paid_at
          : filtro === 'pagos' ? !!l.paid_at : true)
    const m = new Map<string, PaymentRow[]>()
    for (const l of visiveis) m.set(l.job_id, [...(m.get(l.job_id) ?? []), l])
    return [...m.values()]
  }, [linhas, filtro])

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Valores</h1>
          <p className="subtitulo">O valor de cada promotor por trabalho. Eventos vêm da tabela de horas; ações e ajustes você digita. Só os donos veem esta tela.</p>
        </div>
      </div>

      <BarraPeriodo periodo={periodo} />

      {linhas && !erro && (
        <dl className="resumo-valores">
          <div><dt>A pagar</dt><dd>{brl(resumo.aPagar)}</dd></div>
          <div><dt>Já pago</dt><dd>{brl(resumo.pago)}</dd></div>
          <div><dt>Total lançado</dt><dd>{brl(resumo.total)}</dd></div>
          <div className={resumo.sem ? 'pendente' : ''}><dt>Sem valor</dt><dd>{resumo.sem}</dd></div>
        </dl>
      )}

      <div className="abas" role="group" aria-label="Filtrar valores">
        {FILTROS.map(f => (
          <button key={f.id} aria-pressed={filtro === f.id} onClick={() => periodo.ir({ f: f.id })}>
            {f.label}{linhas && <span className="aba-n">{resumo[f.id]}</span>}
          </button>
        ))}
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {linhas === null && !erro && <p className="subtitulo">Carregando valores…</p>}
      {linhas && !erro && grupos.length === 0 && (
        <div className="vazio" style={{ marginTop: 16 }}>
          <strong>{filtro === 'sem' ? 'Todo mundo deste período já tem valor.' : filtro === 'apagar' ? 'Nada a pagar neste período.' : filtro === 'pagos' ? 'Nenhum pagamento registrado neste período.' : 'Ninguém foi escalado neste período.'}</strong>
          Os valores entram aqui quando a gestão seleciona promotores. Contam no período do primeiro dia de cada trabalho.
        </div>
      )}

      {grupos.map(g => (
        <section key={g[0].job_id} className="valores-trabalho" aria-label={g[0].title}>
          <header>
            <div>
              <Link to={`/trabalhos/${g[0].job_id}`} className="nome">{g[0].title}</Link>
              <span className="meta-pequena">{dataCurta(g[0].first_start)}</span>
            </div>
            <Etiqueta tom={g[0].type === 'evento' ? 'tinta' : 'ouro'}>{TIPO_LABEL[g[0].type]}</Etiqueta>
          </header>
          <ul className="lista">
            {g.map(l => <LinhaValor key={l.selection_id} l={l} ocupado={ocupados.has(l.selection_id)} escrever={escrever} />)}
          </ul>
        </section>
      ))}

      <TabelaEventos aoMudar={recarregar} />
    </>
  )
}

type Escrever = (id: string, pedido: () => PromiseLike<{ error: { message: string; code?: string } | null }>) => Promise<{ message: string; code?: string } | null>

function LinhaValor({ l, ocupado, escrever }: { l: PaymentRow; ocupado: boolean; escrever: Escrever }) {
  const [texto, setTexto] = useState(valorCampo(l.amount))
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { setTexto(valorCampo(l.amount)) }, [l.amount])

  const pago = !!l.paid_at
  const id = `valor-${l.selection_id}`

  async function gravar(valor: number | null) {
    setErro(null)
    const error = await escrever(l.selection_id, () => rpc('set_payment', { p_selection_id: l.selection_id, p_amount: valor }))
    if (error) { setErro(dbError(error, 'Não foi possível gravar o valor.')); setTexto(valorCampo(l.amount)) }
  }

  function confirmar() {
    const v = lerValor(texto)
    if (Number.isNaN(v)) { setErro('Use só números, como 130 ou 130,50.'); return }
    if (v === (l.amount === null ? null : Number(l.amount))) { setErro(null); setTexto(valorCampo(l.amount)); return }
    void gravar(v)
  }

  async function marcarPago(p: boolean) {
    setErro(null)
    const error = await escrever(l.selection_id, () => rpc<number>('set_paid', { p_selection_ids: [l.selection_id], p_paid: p }))
    if (error) setErro(dbError(error, 'Não foi possível registrar o pagamento.'))
  }

  const dias = l.type === 'acao' ? `${l.day_count} ${Number(l.day_count) === 1 ? 'dia' : 'dias'}, ` : ''
  const origem = l.amount === null
    ? (l.type === 'evento' ? 'Sem faixa na tabela para esta duração' : 'Ação: digite o valor')
    : l.source === 'tabela' ? 'Pela tabela' : l.suggested !== null ? `Ajustado (tabela: ${brl(l.suggested)})` : 'Digitado'

  return (
    <li className={`linha-valor${pago ? ' pago' : ''}`}>
      <div>
        <div className="nome">{l.full_name}</div>
        <div className="meta"><span>{l.equipment}</span><span>{dias}{duracao(l.hours)}</span></div>
      </div>
      <div className="acoes">
        <div className="campo-valor">
          <label htmlFor={id} className="sr">Valor de {l.full_name}</label>
          <span aria-hidden="true">R$</span>
          <input id={id} inputMode="decimal" value={texto} placeholder="0,00" disabled={pago || ocupado}
            aria-invalid={!!erro} aria-describedby={`${id}-origem`}
            onChange={e => setTexto(e.target.value)} onBlur={confirmar}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setTexto(valorCampo(l.amount)); setErro(null) } }} />
        </div>
        {pago
          ? <button className="btn btn-linha" disabled={ocupado} onClick={() => void marcarPago(false)}>Desfazer pagamento</button>
          : <button className="btn" disabled={ocupado || l.amount === null} onClick={() => void marcarPago(true)}>Marcar pago</button>}
      </div>
      <div className="linha-valor-rodape">
        <span id={`${id}-origem`} className="meta-pequena">{pago ? `Pago em ${dataHora(l.paid_at!)}` : origem}</span>
        {!pago && l.source === 'manual' && l.suggested !== null && (
          <button className="btn-texto" disabled={ocupado} onClick={() => void gravar(null)}>Voltar ao valor da tabela</button>
        )}
        {erro && <span className="erro" role="alert">{erro}</span>}
      </div>
    </li>
  )
}

interface Faixa { hours: number; amount: number }

/** Tabela de horas dos eventos. Mudanças recalculam no banco os valores de eventos que não foram ajustados nem pagos. */
function TabelaEventos({ aoMudar }: { aoMudar: () => void }) {
  const [faixas, setFaixas] = useState<Faixa[] | null>(null)
  const [extra, setExtra] = useState('')
  const [extraSalvo, setExtraSalvo] = useState<number | null>(null)
  const [novaHora, setNovaHora] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function carregar() {
    const [r, s] = await Promise.all([
      supabase.from('event_pay_rates').select('hours,amount').order('hours'),
      supabase.from('pay_settings').select('extra_hour_amount').maybeSingle(),
    ])
    if (r.error || s.error) { setErro(dbError(r.error ?? s.error, 'Não foi possível carregar a tabela.')); setFaixas([]); return }
    setFaixas((r.data ?? []).map(f => ({ hours: f.hours, amount: Number(f.amount) })))
    const ex = s.data?.extra_hour_amount ?? null
    setExtraSalvo(ex === null ? null : Number(ex)); setExtra(valorCampo(ex === null ? null : Number(ex)))
  }
  useEffect(() => { void carregar() }, [])

  async function feito(error: { message: string; code?: string } | null, msg: string) {
    if (error) { setErro(dbError(error, 'Não foi possível gravar.')); setOk(null); return false }
    setErro(null); setOk(msg); await carregar(); aoMudar(); return true
  }

  // Faixa nova usa insert e faixa existente usa update: editar e remover ao mesmo tempo nunca recria a faixa removida.
  async function salvarFaixa(hours: number, texto: string, nova = false) {
    const v = lerValor(texto)
    if (v === null || Number.isNaN(v)) { setErro('Informe o valor em reais, como 130 ou 130,50.'); return false }
    const { error } = nova
      ? await supabase.from('event_pay_rates').insert({ hours, amount: v })
      : await supabase.from('event_pay_rates').update({ amount: v }).eq('hours', hours)
    return feito(error, `Evento de ${hours}h agora vale ${brl(v)}.`)
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const h = Number(novaHora)
    if (!Number.isInteger(h) || h < 1 || h > 24) { setErro('Informe a duração em horas inteiras, de 1 a 24.'); return }
    if (faixas?.some(f => f.hours === h)) { setErro(`Já existe a faixa de ${h}h. Altere o valor dela na lista.`); return }
    if (await salvarFaixa(h, novoValor, true)) { setNovaHora(''); setNovoValor('') }
  }

  async function remover(h: number) {
    const { error } = await supabase.from('event_pay_rates').delete().eq('hours', h)
    void feito(error, `Faixa de ${h}h removida.`)
  }

  async function salvarExtra() {
    const v = lerValor(extra)
    if (Number.isNaN(v)) { setErro('Informe a hora adicional em reais, como 25 ou 25,50.'); return }
    if (v === extraSalvo) return
    const { error } = await supabase.from('pay_settings').update({ extra_hour_amount: v }).eq('id', true)
    void feito(error, v === null ? 'Hora adicional removida.' : `Hora adicional agora vale ${brl(v)}.`)
  }

  const maior = faixas?.length ? faixas[faixas.length - 1].hours : null

  return (
    <section className="secao tabela-eventos" aria-labelledby="tabela-eventos">
      <h2 id="tabela-eventos">Tabela de eventos</h2>
      <p>Valor do promotor por duração do evento. Ao mudar, os eventos ainda não pagos e sem ajuste manual são recalculados.</p>
      {faixas === null && <p className="subtitulo">Carregando tabela…</p>}
      {faixas && (
        <div className="faixas">
          <ul className="lista">
            {faixas.map(f => <LinhaFaixa key={f.hours} f={f} salvar={salvarFaixa} remover={remover} />)}
            {faixas.length === 0 && <li><span className="meta">Nenhuma faixa cadastrada. Sem faixa, o valor de evento fica para digitar.</span></li>}
          </ul>
          <form className="faixa-nova" onSubmit={e => void adicionar(e)}>
            <div className="campo"><label htmlFor="nova-hora">Duração (horas)</label><input id="nova-hora" inputMode="numeric" value={novaHora} onChange={e => setNovaHora(e.target.value)} placeholder="3" /></div>
            <div className="campo"><label htmlFor="novo-valor">Valor (R$)</label><input id="novo-valor" inputMode="decimal" value={novoValor} onChange={e => setNovoValor(e.target.value)} placeholder="0,00" /></div>
            <button className="btn btn-linha">Adicionar faixa</button>
          </form>
          <div className="campo hora-extra">
            <label htmlFor="hora-extra">Hora adicional (R$)</label>
            <input id="hora-extra" inputMode="decimal" value={extra} placeholder="Não definida" onChange={e => setExtra(e.target.value)}
              onBlur={() => void salvarExtra()} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
            <span className="dica">{maior ? `Somada por hora acima de ${maior}h. Vazio: eventos maiores ficam para digitar.` : 'Vale para eventos acima da maior faixa.'}</span>
          </div>
        </div>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && !erro && <p className="aviso-ok" role="status">{ok}</p>}
    </section>
  )
}

function LinhaFaixa({ f, salvar, remover }: { f: Faixa; salvar: (h: number, t: string) => Promise<boolean>; remover: (h: number) => void }) {
  const [texto, setTexto] = useState(valorCampo(f.amount))
  useEffect(() => { setTexto(valorCampo(f.amount)) }, [f.amount])
  const id = `faixa-${f.hours}`
  async function confirmar() {
    const v = lerValor(texto)
    if (v === f.amount) return
    if (!(await salvar(f.hours, texto))) setTexto(valorCampo(f.amount))
  }
  return (
    <li>
      <label htmlFor={id} className="nome">Evento de {f.hours}h</label>
      <div className="acoes">
        <div className="campo-valor">
          <span aria-hidden="true">R$</span>
          <input id={id} inputMode="decimal" value={texto} onChange={e => setTexto(e.target.value)}
            onBlur={() => void confirmar()} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        </div>
        <button className="btn-texto" onClick={() => remover(f.hours)} aria-label={`Remover faixa de ${f.hours}h`}>Remover</button>
      </div>
    </li>
  )
}
