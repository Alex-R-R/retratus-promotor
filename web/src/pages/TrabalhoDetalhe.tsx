import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Etiqueta, Ocupacao } from '../components/JobBits'
import { supabase } from '../lib/supabase'
import { formatPhone } from '../lib/format'
import { BRIEFING_LABEL, dbError, rpc, STATUS_LABEL, TIPO_LABEL, type Candidate, type JobStatus, type JobType, type Briefing } from '../lib/jobs'
import { dataCurta, dataHora, diaSemana, faixa } from '../lib/time'
import { isStaff, LINK_LABEL } from '../lib/types'

interface Job { id: string; type: JobType; title: string; status: JobStatus; briefing: Briefing; location: string | null; city: string | null; notes: string | null; cancel_reason: string | null; clients: { name: string } | null }
interface Dia { id: string; starts_at: string; ends_at: string }
interface Slot { equipment: string; capacity: number }
interface Promotor { id: string; full_name: string }

interface Escolha { promotor: { id: string; nome: string }; equipamento: string; conflitos: string[] }

export default function TrabalhoDetalhe() {
  const { id } = useParams() as { id: string }
  const { profile } = useAuth()
  const gestao = isStaff(profile)

  const [job, setJob] = useState<Job | null>(null)
  const [dias, setDias] = useState<Dia[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [candidatos, setCandidatos] = useState<Candidate[]>([])
  const [promotores, setPromotores] = useState<Promotor[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [escolha, setEscolha] = useState<Escolha | null>(null)
  const [diasEscolhidos, setDiasEscolhidos] = useState<string[]>([])
  const [motivo, setMotivo] = useState('')
  const dialogo = useRef<HTMLDialogElement>(null)
  const dialogoCancelar = useRef<HTMLDialogElement>(null)
  const idAtual = useRef(id)
  useEffect(() => { idAtual.current = id }, [id])

  const carregar = useCallback(async () => {
    const [j, d, s] = await Promise.all([
      supabase.from('jobs').select('id,type,title,status,briefing,location,city,notes,cancel_reason,clients(name)').eq('id', id).single(),
      supabase.from('job_days').select('id,starts_at,ends_at').eq('job_id', id).order('starts_at'),
      supabase.from('job_slots').select('equipment,capacity').eq('job_id', id).order('equipment'),
    ])
    if (id !== idAtual.current) return  // resposta de um trabalho que já saiu da tela
    if (j.error || !j.data) { setErro('Trabalho não encontrado ou sem acesso.'); return }
    setJob(j.data as unknown as Job); setDias(d.data ?? []); setSlots(s.data ?? [])
    if (gestao) {
      const c = await rpc<Candidate[]>('job_candidates', { p_job_id: id })
      if (id !== idAtual.current) return
      if (c.error) setErro(dbError(c.error, 'Não foi possível carregar os candidatos.'))
      setCandidatos(c.data ?? [])
    }
  }, [id, gestao])

  // Ao trocar de trabalho na mesma rota, nada do anterior pode ficar na tela nem receber ações.
  useEffect(() => {
    setJob(null); setDias([]); setSlots([]); setCandidatos([]); setErro(null); setAviso(null); setEscolha(null)
    dialogo.current?.close(); dialogoCancelar.current?.close()
    void carregar()
  }, [carregar])
  useEffect(() => {
    if (!gestao) return
    supabase.from('profiles').select('id,full_name').eq('role', 'promoter').eq('approved', true).order('full_name')
      .then(({ data }) => setPromotores(data ?? []))
  }, [gestao])

  const agora = Date.now()
  const editavel = job && (job.status === 'rascunho' || job.status === 'publicado')
  const diasFuturos = useMemo(() => dias.filter(d => new Date(d.starts_at).getTime() > agora), [dias, agora])

  /** Quantas pessoas já estão em cada equipamento/dia. */
  const ocupacao = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of candidatos) for (const s of c.selections) for (const dia of s.day_ids) {
      const k = `${s.equipment}|${dia}`; m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [candidatos])

  async function executar(fn: () => PromiseLike<{ error: { message: string; code?: string } | null }>, ok: string, falha: string) {
    setOcupado(true); setErro(null); setAviso(null)
    const { error } = await fn()
    setOcupado(false)
    if (error) { setErro(dbError(error, falha)); return false }
    setAviso(ok); await carregar(); return true
  }

  function abrirEscolha(promotor: { id: string; nome: string }, equipamento: string, conflitos: string[]) {
    const livres = diasFuturos.filter(d => (ocupacao.get(`${equipamento}|${d.id}`) ?? 0) < (slots.find(s => s.equipment === equipamento)?.capacity ?? 0) && !conflitos.includes(d.id))
    if (job?.type === 'evento' && livres.length === 1 && !conflitos.length) {
      void executar(() => rpc('select_promoter', { p_job_id: id, p_promoter_id: promotor.id, p_equipment: equipamento, p_day_ids: [livres[0].id] }),
        `${promotor.nome} está escalado em ${equipamento}. Enviamos o aviso.`, 'Não foi possível escalar.')
      return
    }
    setEscolha({ promotor, equipamento, conflitos })
    setDiasEscolhidos(livres.map(d => d.id))
    dialogo.current?.showModal()
  }

  async function confirmarEscolha() {
    if (!escolha || !diasEscolhidos.length) return
    const ok = await executar(() => rpc('select_promoter', { p_job_id: id, p_promoter_id: escolha.promotor.id, p_equipment: escolha.equipamento, p_day_ids: diasEscolhidos }),
      `${escolha.promotor.nome} está escalado em ${escolha.equipamento} em ${diasEscolhidos.length} ${diasEscolhidos.length === 1 ? 'dia' : 'dias'}. Enviamos o aviso.`, 'Não foi possível escalar.')
    if (ok) dialogo.current?.close()
  }

  if (erro && !job) return <><p className="voltar"><Link to="/trabalhos">Voltar aos trabalhos</Link></p><p className="erro" role="alert">{erro}</p></>
  if (!job || job.id !== id) return <p className="subtitulo">Carregando trabalho…</p>

  const totalVagas = slots.reduce((n, s) => n + s.capacity * dias.length, 0)
  const preenchidas = [...ocupacao.values()].reduce((a, b) => a + b, 0)
  const naoSelecionados = (eq: string) => candidatos.filter(c => c.applied_equipment?.includes(eq) && !c.selections.some(s => s.equipment === eq))
  const selecionados = (eq: string) => candidatos.flatMap(c => c.selections.filter(s => s.equipment === eq).map(s => ({ c, s })))

  return (
    <>
      <p className="voltar"><Link to="/trabalhos">Voltar aos trabalhos</Link></p>
      <div className="cabecalho">
        <div>
          <div className="etiquetas" style={{ marginBottom: 10 }}>
            <Etiqueta tom={job.status === 'cancelado' ? 'alerta' : job.status === 'publicado' ? 'tinta' : 'neutro'}>{STATUS_LABEL[job.status]}</Etiqueta>
            <Etiqueta tom={job.briefing === 'fechado' ? 'ok' : 'ouro'}>{BRIEFING_LABEL[job.briefing]}</Etiqueta>
          </div>
          <h1 className="titulo">{job.title}</h1>
          <p className="subtitulo">
            {TIPO_LABEL[job.type]}{job.clients?.name ? ` para ${job.clients.name}` : ''}. {[job.location, job.city].filter(Boolean).join(', ')}
          </p>
        </div>
        {gestao && editavel && (
          <div className="acoes-cabecalho">
            <Link className="btn btn-linha" to={`/trabalhos/${id}/editar`}>Editar</Link>
            {job.status === 'rascunho' && (
              <button className="btn" disabled={ocupado} onClick={() => void executar(() => rpc('publish_job', { p_job_id: id }), 'Trabalho publicado. Os promotores aprovados receberam o aviso da vaga.', 'Não foi possível publicar.')}>Publicar vagas</button>
            )}
          </div>
        )}
      </div>

      {job.status === 'cancelado' && <div className="faixa-alerta">Cancelado. {job.cancel_reason}</div>}
      {aviso && <p className="aviso-ok" role="status">{aviso}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}

      <section className="secao" aria-labelledby="quando">
        <h2 id="quando">{dias.length === 1 ? 'Quando' : `Quando: ${dias.length} dias`}</h2>
        <ol className="folha-dias">
          {dias.map(d => (
            <li key={d.id} className={new Date(d.ends_at).getTime() < agora ? 'passado' : ''}>
              <span className="folha-data">{diaSemana(d.starts_at)}, {dataCurta(d.starts_at)}</span>
              <span className="folha-hora">{faixa(d.starts_at, d.ends_at)}</span>
            </li>
          ))}
        </ol>
        {job.notes && <p className="notas">{job.notes}</p>}
      </section>

      {gestao && (
        <section className="secao" aria-labelledby="equipe">
          <div className="cabecalho" style={{ marginBottom: 8 }}>
            <h2 id="equipe">Equipe</h2>
            <Ocupacao preenchidas={preenchidas} total={totalVagas} />
          </div>
          {job.status === 'rascunho' && <p className="dica">Publique o trabalho para os promotores verem a vaga e se candidatarem. Você já pode escalar pessoas direto.</p>}

          {slots.map(slot => {
            const cand = naoSelecionados(slot.equipment)
            const sel = selecionados(slot.equipment)
            const cheioTodos = dias.length > 0 && dias.every(d => (ocupacao.get(`${slot.equipment}|${d.id}`) ?? 0) >= slot.capacity)
            const semCandidatura = promotores.filter(p => !candidatos.some(c => c.promoter_id === p.id && (c.applied_equipment?.includes(slot.equipment) || c.selections.some(s => s.equipment === slot.equipment))))
            return (
              <div key={slot.equipment} className="equipamento-bloco">
                <div className="equipamento-cabeca">
                  <h3>{slot.equipment}</h3>
                  <span className="meta-pequena">{slot.capacity} {slot.capacity === 1 ? 'pessoa' : 'pessoas'}{job.type === 'acao' ? ' por dia' : ''}</span>
                  {cheioTodos && <Etiqueta tom="ok">Completo</Etiqueta>}
                </div>

                {sel.length > 0 && (
                  <ul className="pessoas">
                    {sel.map(({ c, s }) => (
                      <li key={s.selection_id} className="escalado">
                        <div>
                          <strong>{c.full_name}</strong>
                          <span className="meta-pequena">{job.type === 'acao' ? `${s.day_ids.length} de ${dias.length} dias` : 'Escalado'}{c.phone ? `, ${formatPhone(c.phone)}` : ''}</span>
                        </div>
                        {editavel && (
                          <button className="btn-texto" disabled={ocupado} onClick={() => {
                            if (confirm(`Tirar ${c.full_name} de ${slot.equipment}? A pessoa recebe um aviso.`))
                              void executar(() => rpc('remove_selection', { p_selection_id: s.selection_id }), `${c.full_name} saiu da escala.`, 'Não foi possível tirar da escala.')
                          }}>Tirar da escala</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {editavel && !cheioTodos && (
                  <>
                    <p className="rotulo-lista">{cand.length ? `Candidatos (${cand.length})` : sel.length ? 'Nenhum outro candidato para este equipamento.' : 'Ninguém se candidatou ainda para este equipamento.'}</p>
                    {cand.length > 0 && (
                      <ul className="pessoas">
                        {cand.map(c => {
                          const conflitos = c.conflict_day_ids ?? []
                          const todosEmConflito = diasFuturos.length > 0 && diasFuturos.every(d => conflitos.includes(d.id))
                          return (
                            <li key={c.promoter_id}>
                              <div>
                                <strong>{c.full_name}</strong>
                                <span className="meta-pequena">
                                  {LINK_LABEL[c.link]}{c.applied_at ? `, candidatura em ${dataHora(c.applied_at)}` : ''}
                                </span>
                                {conflitos.length > 0 && <span className="conflito">{todosEmConflito ? 'Já escalado em outro trabalho no mesmo horário' : `Já escalado em outro trabalho em ${conflitos.length} ${conflitos.length === 1 ? 'dia' : 'dias'}`}</span>}
                              </div>
                              <button className="btn" disabled={ocupado || todosEmConflito} onClick={() => abrirEscolha({ id: c.promoter_id, nome: c.full_name }, slot.equipment, conflitos)}>Escalar</button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {semCandidatura.length > 0 && (
                      <div className="escalar-outro">
                        <label htmlFor={`outro-${slot.equipment}`}>Escalar quem não se candidatou</label>
                        <select id={`outro-${slot.equipment}`} value="" onChange={e => {
                          const p = promotores.find(x => x.id === e.target.value)
                          if (p) abrirEscolha({ id: p.id, nome: p.full_name }, slot.equipment, [])
                        }}>
                          <option value="">Escolher promotor…</option>
                          {semCandidatura.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </section>
      )}

      {gestao && editavel && (
        <section className="secao zona-final" aria-labelledby="gestao-trabalho">
          <h2 id="gestao-trabalho">Situação</h2>
          <div className="acoes-linha">
            <button className="btn btn-linha" disabled={ocupado} onClick={() => void executar(
              () => rpc('set_briefing', { p_job_id: id, p_briefing: job.briefing === 'fechado' ? 'aguardando' : 'fechado' }),
              job.briefing === 'fechado' ? 'Briefing voltou para aguardando.' : 'Briefing marcado como fechado.', 'Não foi possível mudar o briefing.')}>
              {job.briefing === 'fechado' ? 'Voltar para aguardando briefing' : 'Marcar briefing como fechado'}
            </button>
            <button className="btn btn-linha perigo" onClick={() => { setMotivo(''); dialogoCancelar.current?.showModal() }}>Cancelar trabalho</button>
          </div>
        </section>
      )}

      <dialog ref={dialogo} className="dialogo" aria-labelledby="titulo-escolha">
        {escolha && (
          <form method="dialog" onSubmit={e => { e.preventDefault(); void confirmarEscolha() }}>
            <h2 id="titulo-escolha">Escalar {escolha.promotor.nome}</h2>
            <p className="dica">{escolha.equipamento}. Marque os dias em que a pessoa trabalha.</p>
            <ul className="escolha-dias">
              {diasFuturos.map(d => {
                const cheio = (ocupacao.get(`${escolha.equipamento}|${d.id}`) ?? 0) >= (slots.find(s => s.equipment === escolha.equipamento)?.capacity ?? 0)
                const conflito = escolha.conflitos.includes(d.id)
                return (
                  <li key={d.id}>
                    <label className={cheio || conflito ? 'indisponivel' : ''}>
                      <input type="checkbox" disabled={cheio || conflito} checked={diasEscolhidos.includes(d.id)}
                        onChange={e => setDiasEscolhidos(e.target.checked ? [...diasEscolhidos, d.id] : diasEscolhidos.filter(x => x !== d.id))} />
                      <span>{diaSemana(d.starts_at)}, {dataCurta(d.starts_at)}</span>
                      <span className="folha-hora">{faixa(d.starts_at, d.ends_at)}</span>
                      {cheio && <em>completo</em>}
                      {conflito && <em>em outro trabalho</em>}
                    </label>
                  </li>
                )
              })}
            </ul>
            {erro && <p className="erro" role="alert">{erro}</p>}
            <div className="acoes-linha">
              <button className="btn" disabled={ocupado || !diasEscolhidos.length}>{ocupado ? 'Escalando…' : `Escalar em ${diasEscolhidos.length} ${diasEscolhidos.length === 1 ? 'dia' : 'dias'}`}</button>
              <button type="button" className="btn btn-linha" onClick={() => dialogo.current?.close()}>Voltar</button>
            </div>
          </form>
        )}
      </dialog>

      <dialog ref={dialogoCancelar} className="dialogo" aria-labelledby="titulo-cancelar">
        <form method="dialog" onSubmit={async e => {
          e.preventDefault()
          if (!motivo.trim()) return setErro('Informe o motivo do cancelamento.')
          const ok = await executar(() => rpc('cancel_job', { p_job_id: id, p_reason: motivo.trim() }), 'Trabalho cancelado. Os promotores escalados receberam o aviso.', 'Não foi possível cancelar.')
          if (ok) dialogoCancelar.current?.close()
        }}>
          <h2 id="titulo-cancelar">Cancelar {job.title}</h2>
          <p className="dica">Quem estava escalado recebe um aviso. O histórico do trabalho fica guardado.</p>
          <div className="campo">
            <label htmlFor="motivo">Motivo</label>
            <input id="motivo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: contratante adiou o evento" />
          </div>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="acoes-linha">
            <button className="btn perigo-cheio" disabled={ocupado}>Cancelar trabalho</button>
            <button type="button" className="btn btn-linha" onClick={() => dialogoCancelar.current?.close()}>Voltar</button>
          </div>
        </form>
      </dialog>
    </>
  )
}
