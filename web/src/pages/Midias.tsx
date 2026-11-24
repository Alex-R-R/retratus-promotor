import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DataBloco, Etiqueta } from '../components/JobBits'
import { BarraPeriodo } from '../components/Periodo'
import { dbError, resumoMidias, rpc, TIPO_LABEL, type MediaOverview } from '../lib/jobs'
import { usePeriodo } from '../lib/periodo'
import { dataCurta, periodo as textoPeriodo } from '../lib/time'

type Filtro = 'todos' | 'sem' | 'com'

/** Cobertura de mídia: quais trabalhos do período já têm fotos e vídeos no Drive. */
export default function Midias() {
  const periodo = usePeriodo('mes')
  const { de, ate } = periodo
  const [params, setParams] = useSearchParams()
  const filtro: Filtro = (['sem', 'com'] as const).find(f => f === params.get('f')) ?? 'todos'
  const setFiltro = (f: Filtro) => {
    const p = new URLSearchParams(params)
    if (f === 'todos') p.delete('f'); else p.set('f', f)
    setParams(p, { replace: true })
  }

  const [lista, setLista] = useState<MediaOverview[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let atual = true
    setLista(null); setErro(null)
    rpc<MediaOverview[]>('media_overview', { p_from: de, p_to: ate }).then(({ data, error }) => {
      if (!atual) return
      if (error) setErro(dbError(error, 'Não foi possível carregar as mídias.'))
      setLista(data ?? [])
    })
    return () => { atual = false }
  }, [de, ate])

  const { visiveis, semMidia } = useMemo(() => {
    const agora = Date.now()
    const todos = lista ?? []
    // Pendente = já terminou e ainda não tem nenhum link.
    const pendente = (m: MediaOverview) => !Number(m.media_count) && new Date(m.last_end).getTime() <= agora
    const visiveis = filtro === 'sem' ? todos.filter(pendente) : filtro === 'com' ? todos.filter(m => Number(m.media_count) > 0) : todos
    return { visiveis, semMidia: todos.filter(pendente).length }
  }, [lista, filtro])

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Mídias</h1>
          <p className="subtitulo">Fotos e vídeos de cada trabalho ficam no Google Drive da Retratus. Aqui você guarda os links e vê quais trabalhos ainda estão sem cobertura.</p>
        </div>
      </div>

      <BarraPeriodo periodo={periodo} />

      <div className="abas" role="group" aria-label="Filtrar trabalhos">
        <button aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</button>
        <button aria-pressed={filtro === 'sem'} onClick={() => setFiltro('sem')}>
          Sem mídia{lista && semMidia > 0 && <span className="aba-n">{semMidia}</span>}
        </button>
        <button aria-pressed={filtro === 'com'} onClick={() => setFiltro('com')}>Com mídia</button>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {lista === null && !erro && <p className="subtitulo">Carregando trabalhos…</p>}
      {lista && visiveis.length === 0 && !erro && (
        <div className="vazio" style={{ marginTop: 16 }}>
          <strong>{filtro === 'sem' ? 'Nenhum trabalho encerrado sem mídia.' : 'Nada por aqui.'}</strong>
          {filtro === 'sem' ? 'Todo trabalho que já aconteceu neste período tem pelo menos um link.' : 'Nenhum trabalho publicado neste período.'}
        </div>
      )}

      {visiveis.length > 0 && (
        <ul className="lista lista-trabalhos">
          {visiveis.map(m => <Linha key={m.job_id} m={m} />)}
        </ul>
      )}
    </>
  )
}

function Linha({ m }: { m: MediaOverview }) {
  const n = Number(m.media_count)
  const terminou = new Date(m.last_end).getTime() <= Date.now()
  return (
    <li>
      <Link to={`/midias/${m.job_id}`} className="trabalho-linha">
        <DataBloco iso={m.first_start} />
        <div className="trabalho-info">
          <div className="nome">{m.title}</div>
          <div className="meta">
            <span>{TIPO_LABEL[m.type]}{m.type === 'acao' && Number(m.day_count) > 1 ? `, ${Number(m.day_count)} dias` : ''}</span>
            <span>{textoPeriodo(m.first_start, m.last_end)}</span>
            {(m.location || m.city) && <span>{[m.location, m.city].filter(Boolean).join(', ')}</span>}
            {m.client_name && <span>{m.client_name}</span>}
            <span>{!Number(m.team_count) ? 'Sem equipe escalada' : Number(m.team_count) === 1 ? '1 promotor' : `${Number(m.team_count)} promotores`}</span>
          </div>
        </div>
        <div className="trabalho-estado">
          {n > 0 ? (
            <>
              <span className="ocupacao-texto">{resumoMidias(m)}</span>
              {m.last_added_at && <span className="meta-pequena">Último link em {dataCurta(m.last_added_at)}</span>}
            </>
          ) : terminou
            ? <Etiqueta tom="ouro">Sem mídia</Etiqueta>
            : <Etiqueta tom="neutro">Ainda não aconteceu</Etiqueta>}
        </div>
      </Link>
    </li>
  )
}
