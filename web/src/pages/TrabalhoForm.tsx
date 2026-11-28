import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dbError, EQUIPAMENTOS, rpc, type Briefing, type ClienteTipo, type JobType } from '../lib/jobs'
import { addDays, crossesMidnight, dataLonga, splitLocal, todayLocal, toRange } from '../lib/time'

interface DiaForm { id?: string; date: string; start: string; end: string }
interface Cliente { id: string; name: string; kind: ClienteTipo; listed: boolean }

const PADRAO: readonly string[] = EQUIPAMENTOS

/** Campos de data/hora vazios ou incompletos não podem chegar ao toRange (Date inválida lança erro). */
const diaCompleto = (d: DiaForm) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && /^\d{2}:\d{2}$/.test(d.start) && /^\d{2}:\d{2}$/.test(d.end)

const diaPadrao = (): DiaForm => ({ date: addDays(todayLocal(), 7), start: '18:00', end: '22:00' })

export default function TrabalhoForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()

  const [carregando, setCarregando] = useState(editando)
  const [tipo, setTipo] = useState<JobType>('evento')
  const [titulo, setTitulo] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [novoCliente, setNovoCliente] = useState('')
  const [guardados, setGuardados] = useState<string[]>([])
  const [outroServico, setOutroServico] = useState('')
  const [guardarServico, setGuardarServico] = useState(false)
  const [local, setLocal] = useState('')
  const [cidade, setCidade] = useState('Belém')
  const [briefing, setBriefing] = useState<Briefing>('aguardando')
  const [obs, setObs] = useState('')
  const [dias, setDias] = useState<DiaForm[]>([diaPadrao()])
  const [vagas, setVagas] = useState<Record<string, number>>({})
  const [repetirAte, setRepetirAte] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('clients').select('id,name,kind,listed').order('name').then(({ data }) => setClientes(data ?? []))
    supabase.from('action_services').select('name').order('name').then(({ data }) => setGuardados((data ?? []).map(x => x.name)))
    if (!id) return
    Promise.all([
      supabase.from('jobs').select('*').eq('id', id).single(),
      supabase.from('job_days').select('id,starts_at,ends_at').eq('job_id', id).order('starts_at'),
      supabase.from('job_slots').select('equipment,capacity').eq('job_id', id),
    ]).then(([j, d, s]) => {
      if (j.error || !j.data) { setErro('Trabalho não encontrado.'); setCarregando(false); return }
      const job = j.data
      setTipo(job.type); setTitulo(job.title); setClienteId(job.client_id ?? ''); setLocal(job.location ?? '')
      setCidade(job.city ?? ''); setBriefing(job.briefing); setObs(job.notes ?? '')
      setDias((d.data ?? []).map(x => ({ id: x.id, date: splitLocal(x.starts_at).date, start: splitLocal(x.starts_at).time, end: splitLocal(x.ends_at).time })))
      setVagas(Object.fromEntries((s.data ?? []).map(x => [x.equipment, x.capacity])))
      setCarregando(false)
    })
  }, [id])

  function mudarTipo(t: JobType) {
    setTipo(t)
    if (t === 'evento' && dias.length > 1) setDias([dias[0]])
    // Evento só usa os equipamentos padrão.
    if (t === 'evento') setVagas(v => Object.fromEntries(Object.entries(v).filter(([eq]) => PADRAO.includes(eq))))
  }

  // Lista fixa do tipo do trabalho, mais o contratante já ligado a ele (mesmo que avulso).
  const clientesVisiveis = clientes.filter(c => c.id === clienteId || (c.listed && (c.kind === 'ambos' || c.kind === tipo)))

  const opcoes = tipo === 'evento' ? [...PADRAO] : [...new Set([...PADRAO, ...guardados, ...Object.keys(vagas)])]

  async function adicionarServico() {
    const nome = outroServico.trim().replace(/\s+/g, ' ')
    if (nome.length < 2 || nome.length > 60) return setErro('O nome do serviço deve ter de 2 a 60 letras.')
    const final = opcoes.find(o => o.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')) ?? nome
    if (guardarServico && !guardados.includes(final)) {
      const { error } = await supabase.from('action_services').insert({ name: final })
      if (error && error.code !== '23505') return setErro(dbError(error, 'Não foi possível guardar o serviço.'))
      setGuardados(g => [...g, final].sort((a, b) => a.localeCompare(b, 'pt-BR')))
    }
    setErro(null); setOutroServico(''); setGuardarServico(false)
    setVagas(v => ({ ...v, [final]: Math.max(v[final] ?? 0, 1) }))
  }

  const alterarDia = (i: number, campo: keyof DiaForm, valor: string) => setDias(ds => ds.map((d, k) => k === i ? { ...d, [campo]: valor } : d))

  function adicionarDia() {
    const ultimo = dias[dias.length - 1]
    const base = ultimo && diaCompleto(ultimo) ? ultimo : diaPadrao()
    setDias([...dias, { date: addDays(base.date, 1), start: base.start, end: base.end }])
  }

  function repetir() {
    const ultimo = dias[dias.length - 1]
    if (!ultimo || !diaCompleto(ultimo)) return setErro('Preencha data, início e fim do último dia antes de repetir.')
    if (!repetirAte || repetirAte <= ultimo.date) return setErro('Escolha uma data depois do último dia para repetir o horário.')
    const novos: DiaForm[] = []
    for (let d = addDays(ultimo.date, 1); d <= repetirAte; d = addDays(d, 1)) novos.push({ date: d, start: ultimo.start, end: ultimo.end })
    if (novos.length > 120) return setErro('Repita no máximo 120 dias de cada vez.')
    setErro(null); setDias([...dias, ...novos]); setRepetirAte('')
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (titulo.trim().length < 3) return setErro('Dê um nome ao trabalho.')
    if (!dias.length) return setErro('Informe pelo menos um dia.')
    if (dias.some(d => !diaCompleto(d))) return setErro('Preencha data, início e fim de todos os dias.')
    if (dias.some(d => d.start === d.end)) return setErro('O início e o fim de um dia não podem ser iguais.')
    if (new Set(dias.map(d => d.date)).size !== dias.length) return setErro('Há dias repetidos. Deixe um horário por data.')
    const slots = Object.entries(vagas).filter(([eq, n]) => n > 0 && opcoes.includes(eq)).map(([equipment, capacity]) => ({ equipment, capacity }))
    if (!slots.length) return setErro(tipo === 'evento' ? 'Escolha pelo menos um equipamento e quantas pessoas ele precisa.' : 'Escolha pelo menos um serviço e quantas pessoas ele precisa.')

    setErro(null); setSalvando(true)
    let client_id: string | null = clienteId || null
    if (clienteId === '__novo') {
      if (!novoCliente.trim()) { setSalvando(false); return setErro('Informe o nome do novo contratante.') }
      const { data, error } = await supabase.from('clients').insert({ name: novoCliente.trim(), kind: tipo, listed: false }).select('id').single()
      if (error || !data) { setSalvando(false); return setErro(dbError(error, 'Não foi possível cadastrar o contratante.')) }
      client_id = data.id
      // Se salvar o trabalho falhar, a próxima tentativa usa este contratante em vez de criar outro igual.
      setClientes(cs => [...cs, { id: data.id, name: novoCliente.trim(), kind: tipo, listed: false }].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setClienteId(data.id); setNovoCliente('')
    }
    const { data, error } = await rpc<string>('save_job', {
      p_job_id: id ?? null,
      p_job: { type: tipo, title: titulo.trim(), client_id, location: local.trim() || null, city: cidade.trim() || null, briefing, notes: obs.trim() || null },
      p_days: [...dias].sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...(d.id ? { id: d.id } : {}), ...toRange(d.date, d.start, d.end) })),
      p_slots: slots,
    })
    setSalvando(false)
    if (error) return setErro(dbError(error, 'Não foi possível salvar o trabalho.'))
    navigate(`/trabalhos/${data ?? id}`, { replace: true })
  }

  if (carregando) return <p className="subtitulo">Carregando trabalho…</p>

  return (
    <>
      <div className="cabecalho">
        <div>
          <p className="voltar"><Link to={id ? `/trabalhos/${id}` : '/trabalhos'}>{id ? 'Voltar ao trabalho' : 'Voltar aos trabalhos'}</Link></p>
          <h1 className="titulo">{editando ? 'Editar trabalho' : 'Novo trabalho'}</h1>
          <p className="subtitulo">{editando ? 'Promotores já escalados recebem aviso se o horário mudar.' : 'O trabalho fica como rascunho até você publicar. Só então os promotores veem a vaga.'}</p>
        </div>
      </div>

      <form className="form-trabalho" onSubmit={salvar} noValidate>
        <fieldset className="grupo">
          <legend>O trabalho</legend>
          <div className="escolha-tipo" role="radiogroup" aria-label="Tipo de trabalho">
            {(['evento', 'acao'] as JobType[]).map(t => (
              <label key={t} className={tipo === t ? 'marcado' : ''}>
                <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => mudarTipo(t)} />
                <strong>{t === 'evento' ? 'Evento' : 'Ação'}</strong>
                <span>{t === 'evento' ? 'Um dia, com início e fim. Pode virar a madrugada.' : 'Vários dias, cada um com seu horário.'}</span>
              </label>
            ))}
          </div>
          <div className="campo">
            <label htmlFor="titulo">Nome do trabalho</label>
            <input id="titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Casamento no Espaço Guajará" />
          </div>
          <div className="duas-colunas">
            <div className="campo">
              <label htmlFor="cliente">Contratante</label>
              <select id="cliente" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Sem contratante informado</option>
                {clientesVisiveis.map(c => <option key={c.id} value={c.id}>{c.listed ? c.name : `${c.name} (avulso)`}</option>)}
                <option value="__novo">Outro contratante, só para este trabalho…</option>
              </select>
            </div>
            {clienteId === '__novo' && (
              <div className="campo">
                <label htmlFor="novo-cliente">Nome do contratante</label>
                <input id="novo-cliente" value={novoCliente} onChange={e => setNovoCliente(e.target.value)} />
                <span className="dica">Não entra na lista. Para usar de novo, adicione em Contratantes.</span>
              </div>
            )}
          </div>
          <div className="duas-colunas">
            <div className="campo">
              <label htmlFor="local">Local</label>
              <input id="local" value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Hangar Centro de Convenções" />
            </div>
            <div className="campo">
              <label htmlFor="cidade">Município</label>
              <input id="cidade" value={cidade} onChange={e => setCidade(e.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="briefing">Briefing do contratante</label>
            <select id="briefing" value={briefing} onChange={e => setBriefing(e.target.value as Briefing)}>
              <option value="aguardando">Aguardando briefing: faltam detalhes do contratante</option>
              <option value="fechado">Briefing fechado: o contratante confirmou os detalhes</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="obs">Observações para a equipe</label>
            <textarea id="obs" rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Traje, ponto de encontro, montagem, contato no local." />
            <span className="dica">Os promotores veem este texto na vaga.</span>
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>{tipo === 'evento' ? 'Data e horário' : 'Dias e horários'}</legend>
          <ol className="dias">
            {dias.map((d, i) => (
              <li key={d.id ?? `novo-${i}`}>
                <div className="campo"><label htmlFor={`data-${i}`}>Data</label><input id={`data-${i}`} type="date" value={d.date} onChange={e => alterarDia(i, 'date', e.target.value)} /></div>
                <div className="campo"><label htmlFor={`ini-${i}`}>Início</label><input id={`ini-${i}`} type="time" value={d.start} onChange={e => alterarDia(i, 'start', e.target.value)} /></div>
                <div className="campo"><label htmlFor={`fim-${i}`}>Fim</label><input id={`fim-${i}`} type="time" value={d.end} onChange={e => alterarDia(i, 'end', e.target.value)} /></div>
                <div className="dia-nota">
                  {diaCompleto(d) && <span>{dataLonga(toRange(d.date, d.start, d.end).starts_at)}</span>}
                  {diaCompleto(d) && crossesMidnight(d.start, d.end) && <span className="madrugada">Termina no dia seguinte</span>}
                </div>
                {tipo === 'acao' && dias.length > 1 && (
                  <button type="button" className="btn-texto remover" onClick={() => setDias(dias.filter((_, k) => k !== i))} aria-label={`Remover o dia ${d.date}`}>Remover</button>
                )}
              </li>
            ))}
          </ol>
          {tipo === 'acao' && (
            <div className="dias-acoes">
              <button type="button" className="btn btn-linha" onClick={adicionarDia}>Adicionar dia</button>
              <div className="repetir">
                <div className="campo">
                  <label htmlFor="repetir">Repetir o último horário até</label>
                  <input id="repetir" type="date" value={repetirAte} onChange={e => setRepetirAte(e.target.value)} />
                </div>
                <button type="button" className="btn btn-linha" onClick={repetir} disabled={!repetirAte}>Repetir</button>
              </div>
              <p className="dica">{dias.length} {dias.length === 1 ? 'dia' : 'dias'} no total.</p>
            </div>
          )}
        </fieldset>

        <fieldset className="grupo">
          <legend>{tipo === 'evento' ? 'Vagas por equipamento' : 'Vagas por serviço'}</legend>
          <p className="dica">Quantas pessoas cada equipamento precisa{tipo === 'acao' ? ' em cada dia' : ''}. Deixe zero nos que não vão.</p>
          <ul className="equipamentos">
            {opcoes.map(eq => {
              const n = vagas[eq] ?? 0
              return (
                <li key={eq} className={n > 0 ? 'ativo' : ''}>
                  <span>{eq}</span>
                  <div className="contador-vagas">
                    <button type="button" aria-label={`Menos uma vaga de ${eq}`} disabled={n === 0} onClick={() => setVagas({ ...vagas, [eq]: n - 1 })}>−</button>
                    <output aria-live="polite">{n}</output>
                    <button type="button" aria-label={`Mais uma vaga de ${eq}`} disabled={n >= 30} onClick={() => setVagas({ ...vagas, [eq]: n + 1 })}>+</button>
                  </div>
                </li>
              )
            })}
          </ul>
          {tipo === 'acao' && (
            <div className="outro-servico">
              <div className="campo">
                <label htmlFor="outro-servico">Outro serviço</label>
                <input id="outro-servico" value={outroServico} maxLength={60} placeholder="Ex.: Panfletagem"
                  onChange={e => setOutroServico(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void adicionarServico() } }} />
              </div>
              <label className="check">
                <input type="checkbox" checked={guardarServico} onChange={e => setGuardarServico(e.target.checked)} />
                Guardar para as próximas ações
              </label>
              <button type="button" className="btn btn-linha" onClick={() => void adicionarServico()} disabled={!outroServico.trim()}>Adicionar serviço</button>
            </div>
          )}
        </fieldset>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="form-rodape">
          <button className="btn" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar rascunho'}</button>
          <Link className="btn btn-linha" to={id ? `/trabalhos/${id}` : '/trabalhos'}>Cancelar</Link>
        </div>
      </form>
    </>
  )
}
