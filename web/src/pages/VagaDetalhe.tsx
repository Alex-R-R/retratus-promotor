import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Etiqueta } from '../components/JobBits'
import { supabase } from '../lib/supabase'
import { dbError, rpc, TIPO_LABEL, type BoardJob } from '../lib/jobs'
import { dataCurta, dataHora, diaSemana, faixa } from '../lib/time'

export default function VagaDetalhe() {
  const { id } = useParams() as { id: string }
  const { profile } = useAuth()
  const [vaga, setVaga] = useState<BoardJob | null | undefined>(undefined)
  const [marcados, setMarcados] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const idAtual = useRef(id)
  useEffect(() => { idAtual.current = id }, [id])

  const carregar = useCallback(async () => {
    const { data, error } = await rpc<BoardJob[]>('job_board')
    if (id !== idAtual.current) return  // resposta de uma vaga que já saiu da tela
    if (error) { setErro(dbError(error, 'Não foi possível carregar a vaga.')); setVaga(null); return }
    const v = (data ?? []).find(x => x.job_id === id) ?? null
    setVaga(v)
    setMarcados(v?.my_application ?? [])
  }, [id])

  // Troca de vaga na mesma rota: limpa a anterior antes de carregar a nova.
  useEffect(() => { setVaga(undefined); setMarcados([]); setErro(null); setAviso(null); void carregar() }, [carregar])

  async function candidatar() {
    if (!profile || !marcados.length) return
    setOcupado(true); setErro(null); setAviso(null)
    // Cria ou atualiza numa só transação: se o prazo vencer, a candidatura anterior fica intacta.
    const atualizando = Boolean(vaga?.my_application)
    const { error } = await rpc('apply_to_job', { p_job_id: id, p_equipment: marcados })
    setOcupado(false)
    if (error) return setErro(dbError(error, 'Não foi possível enviar a candidatura.'))
    setAviso(atualizando ? 'Candidatura atualizada.' : 'Candidatura enviada. Se você for escolhido, o aviso chega no Início.')
    await carregar()
  }

  async function retirar() {
    if (!profile || !confirm('Retirar sua candidatura deste trabalho?')) return
    setOcupado(true); setErro(null); setAviso(null)
    const { error } = await supabase.from('applications').delete().eq('job_id', id).eq('promoter_id', profile.id)
    setOcupado(false)
    if (error) return setErro(dbError(error, 'Não foi possível retirar a candidatura.'))
    setAviso('Candidatura retirada.')
    await carregar()
  }

  if (vaga === undefined || (vaga && vaga.job_id !== id)) return <p className="subtitulo">Carregando vaga…</p>
  if (vaga === null) {
    return (
      <>
        <p className="voltar"><Link to="/vagas">Voltar às vagas</Link></p>
        <div className="vazio"><strong>Esta vaga não está mais aberta.</strong>O prazo de candidatura terminou ou o trabalho foi alterado. Veja as outras vagas abertas.</div>
      </>
    )
  }

  const mudou = vaga.my_application
    ? marcados.length !== vaga.my_application.length || marcados.some(m => !vaga.my_application!.includes(m))
    : marcados.length > 0

  return (
    <>
      <p className="voltar"><Link to="/vagas">Voltar às vagas</Link></p>
      <div className="cabecalho">
        <div>
          {vaga.i_am_selected && <div className="etiquetas" style={{ marginBottom: 10 }}><Etiqueta tom="ok">Você está escalado</Etiqueta></div>}
          <h1 className="titulo">{vaga.title}</h1>
          <p className="subtitulo">{TIPO_LABEL[vaga.type]}. {[vaga.location, vaga.city].filter(Boolean).join(', ')}</p>
        </div>
      </div>

      <section className="secao" aria-labelledby="quando">
        <h2 id="quando">{vaga.days.length === 1 ? 'Quando' : `Quando: ${vaga.days.length} dias`}</h2>
        <ol className="folha-dias">
          {vaga.days.map(d => (
            <li key={d.id}>
              <span className="folha-data">{diaSemana(d.starts_at)}, {dataCurta(d.starts_at)}</span>
              <span className="folha-hora">{faixa(d.starts_at, d.ends_at)}</span>
            </li>
          ))}
        </ol>
        {vaga.type === 'acao' && <p className="dica">Em ações, a gestão pode escalar você em parte dos dias.</p>}
        {vaga.notes && <p className="notas">{vaga.notes}</p>}
      </section>

      <section className="secao" aria-labelledby="candidatura">
        <h2 id="candidatura">{vaga.my_application ? 'Sua candidatura' : 'Candidatar-se'}</h2>
        <p>Marque os equipamentos que você sabe operar. Candidaturas até {dataHora(vaga.application_deadline)}.</p>
        <ul className="escolha-equip">
          {vaga.slots.map(s => {
            const lotado = s.open_days === 0
            return (
              <li key={s.equipment}>
                <label className={lotado ? 'indisponivel' : ''}>
                  <input type="checkbox" disabled={lotado || vaga.i_am_selected} checked={marcados.includes(s.equipment)}
                    onChange={e => setMarcados(e.target.checked ? [...marcados, s.equipment] : marcados.filter(x => x !== s.equipment))} />
                  <strong>{s.equipment}</strong>
                  <span className="meta-pequena">
                    {lotado ? 'Vagas preenchidas' : vaga.days.length > 1 ? `Vagas em ${s.open_days} de ${vaga.days.length} dias` : `${s.capacity} ${s.capacity === 1 ? 'vaga' : 'vagas'}`}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {aviso && <p className="aviso-ok" role="status">{aviso}</p>}
        {!vaga.i_am_selected && (
          <div className="acoes-linha">
            <button className="btn" disabled={ocupado || !marcados.length || !mudou} onClick={() => void candidatar()}>
              {ocupado ? 'Enviando…' : vaga.my_application ? 'Atualizar candidatura' : 'Enviar candidatura'}
            </button>
            {vaga.my_application && <button className="btn btn-linha" disabled={ocupado} onClick={() => void retirar()}>Retirar candidatura</button>}
          </div>
        )}
      </section>
    </>
  )
}
