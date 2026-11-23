import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DataBloco, Etiqueta } from '../components/JobBits'
import { dbError, rpc, TIPO_LABEL, type BoardJob } from '../lib/jobs'
import { dataHora, faixa, periodo } from '../lib/time'

export default function Vagas() {
  const [vagas, setVagas] = useState<BoardJob[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    rpc<BoardJob[]>('job_board').then(({ data, error }) => {
      if (error) setErro(dbError(error, 'Não foi possível carregar as vagas.'))
      setVagas((data ?? []).sort((a, b) => (a.days[0]?.starts_at ?? '').localeCompare(b.days[0]?.starts_at ?? '')))
    })
  }, [])

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Vagas abertas</h1>
          <p className="subtitulo">Escolha os equipamentos que você opera e se candidate. A candidatura fecha 24 horas antes do início. Se for escolhido, você recebe um aviso.</p>
        </div>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {vagas === null && !erro && <p className="subtitulo">Carregando vagas…</p>}
      {vagas?.length === 0 && (
        <div className="vazio">
          <strong>Nenhuma vaga aberta agora.</strong>
          Quando a Retratus publicar um trabalho, o aviso aparece no Início.
        </div>
      )}

      {!!vagas?.length && (
        <ul className="lista lista-trabalhos">
          {vagas.map(v => {
            const primeiro = v.days[0]
            const ultimo = v.days[v.days.length - 1]
            const abertos = v.slots.filter(s => s.open_days > 0)
            return (
              <li key={v.job_id}>
                <Link to={`/vagas/${v.job_id}`} className="trabalho-linha">
                  <DataBloco iso={primeiro?.starts_at ?? null} />
                  <div className="trabalho-info">
                    <div className="nome">{v.title}</div>
                    <div className="meta">
                      <span>{TIPO_LABEL[v.type]}{v.days.length > 1 ? `, ${v.days.length} dias` : ''}</span>
                      {primeiro && <span>{v.days.length > 1 ? periodo(primeiro.starts_at, ultimo.ends_at) : faixa(primeiro.starts_at, primeiro.ends_at)}</span>}
                      {(v.location || v.city) && <span>{[v.location, v.city].filter(Boolean).join(', ')}</span>}
                    </div>
                    <div className="meta">
                      <span>{abertos.length ? abertos.map(s => s.equipment).join(', ') : 'Vagas preenchidas'}</span>
                    </div>
                  </div>
                  <div className="trabalho-estado">
                    {v.i_am_selected ? <Etiqueta tom="ok">Você está escalado</Etiqueta>
                      : v.my_application ? <Etiqueta tom="tinta">Candidatura enviada</Etiqueta>
                      : <span className="meta-pequena">Candidaturas até {dataHora(v.application_deadline)}</span>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
