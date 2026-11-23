import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { DataBloco, Etiqueta, Ocupacao } from '../components/JobBits'
import { BRIEFING_LABEL, dbError, rpc, STATUS_LABEL, STAFFING_LABEL, TIPO_LABEL, type JobOverview } from '../lib/jobs'
import { addDays, periodo, todayLocal, toRange } from '../lib/time'
import { isStaff } from '../lib/types'

type Filtro = 'proximos' | 'rascunhos' | 'vagas' | 'briefing' | 'passados'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'proximos', label: 'Próximos' },
  { id: 'vagas', label: 'Vagas em aberto' },
  { id: 'briefing', label: 'Aguardando briefing' },
  { id: 'rascunhos', label: 'Rascunhos' },
  { id: 'passados', label: 'Passados' },
]

export default function Trabalhos() {
  const { profile } = useAuth()
  const gestao = isStaff(profile)
  const [filtro, setFiltro] = useState<Filtro>('proximos')
  const [lista, setLista] = useState<JobOverview[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const passados = filtro === 'passados'

  useEffect(() => {
    const hoje = todayLocal()
    const de = passados ? toRange(addDays(hoje, -120), '00:00', '00:01').starts_at : toRange(hoje, '00:00', '00:01').starts_at
    const ate = passados ? new Date().toISOString() :toRange(addDays(hoje, 365), '00:00', '00:01').starts_at
    setLista(null); setErro(null)
    let atual = true  // descarta a resposta de um filtro que já foi trocado
    rpc<JobOverview[]>('jobs_overview', { p_from: de, p_to: ate }).then(({ data, error }) => {
      if (!atual) return
      if (error) setErro(dbError(error, 'Não foi possível carregar os trabalhos.'))
      setLista(data ?? [])
    })
    return () => { atual = false }
  }, [passados])

  const visiveis = useMemo(() => {
    const agora = Date.now()
    // Terminou = o último dia já acabou. Um evento das 22h às 2h continua em "Próximos" até as 2h.
    const terminou = (j: JobOverview) => !!j.last_end && new Date(j.last_end).getTime() <= agora
    const ordenada = [...(lista ?? [])].sort((a, b) => (a.first_start ?? '9').localeCompare(b.first_start ?? '9'))
    if (filtro === 'passados') return ordenada.filter(terminou).reverse()
    const futuros = ordenada.filter(j => !terminou(j))
    switch (filtro) {
      case 'rascunhos': return futuros.filter(j => j.status === 'rascunho')
      case 'vagas': return futuros.filter(j => j.status === 'publicado' && j.staffing === 'vagas_abertas')
      case 'briefing': return futuros.filter(j => j.status !== 'cancelado' && j.briefing === 'aguardando')
      default: return futuros.filter(j => j.status !== 'rascunho')
    }
  }, [lista, filtro])

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Trabalhos</h1>
          <p className="subtitulo">Eventos e ações com as vagas por equipamento. Abra um trabalho para publicar, ver candidatos e escolher a equipe.</p>
        </div>
        {gestao && <Link className="btn" to="/trabalhos/novo">Novo trabalho</Link>}
      </div>

      <div className="abas" role="tablist" aria-label="Filtrar trabalhos">
        {FILTROS.map(f => <button key={f.id} role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label}</button>)}
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {lista === null && !erro && <p className="subtitulo">Carregando trabalhos…</p>}
      {lista && visiveis.length === 0 && (
        <div className="vazio" style={{ marginTop: 16 }}>
          <strong>Nada por aqui.</strong>
          {filtro === 'proximos' && gestao ? 'Crie um trabalho e publique para os promotores se candidatarem.' : 'Nenhum trabalho neste filtro.'}
        </div>
      )}

      {visiveis.length > 0 && (
        <ul className="lista lista-trabalhos">
          {visiveis.map(j => (
            <li key={j.job_id}>
              <Link to={`/trabalhos/${j.job_id}`} className="trabalho-linha">
                <DataBloco iso={j.first_start} />
                <div className="trabalho-info">
                  <div className="nome">{j.title}</div>
                  <div className="meta">
                    <span>{TIPO_LABEL[j.type]}{j.type === 'acao' && j.day_count > 1 ? `, ${j.day_count} dias` : ''}</span>
                    <span>{periodo(j.first_start, j.last_end)}</span>
                    {(j.location || j.city) && <span>{[j.location, j.city].filter(Boolean).join(', ')}</span>}
                    {j.client_name && <span>{j.client_name}</span>}
                  </div>
                </div>
                <div className="trabalho-estado">
                  <div className="etiquetas">
                    {j.status !== 'publicado' && <Etiqueta tom={j.status === 'cancelado' ? 'alerta' : 'neutro'}>{STATUS_LABEL[j.status]}</Etiqueta>}
                    {j.status !== 'cancelado' && <Etiqueta tom={j.briefing === 'fechado' ? 'ok' : 'ouro'}>{BRIEFING_LABEL[j.briefing]}</Etiqueta>}
                  </div>
                  {j.status !== 'cancelado' && (
                    <div className="estado-equipe">
                      <Ocupacao preenchidas={j.filled_total} total={j.capacity_total} />
                      {j.status === 'publicado' && <span className="meta-pequena">{STAFFING_LABEL[j.staffing]}</span>}
                      {j.applications_count > 0 && <span className="meta-pequena">{j.applications_count} {j.applications_count === 1 ? 'candidatura' : 'candidaturas'}</span>}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
