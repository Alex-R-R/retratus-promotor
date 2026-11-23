import { useEffect, useMemo, useState } from 'react'
import { DataBloco, Etiqueta } from '../components/JobBits'
import { dbError, rpc, TIPO_LABEL, type MyJob } from '../lib/jobs'
import { addDays, faixa, todayLocal, toRange } from '../lib/time'

export default function MeusTrabalhos() {
  const [itens, setItens] = useState<MyJob[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const hoje = todayLocal()
    rpc<MyJob[]>('my_jobs', { p_from: toRange(addDays(hoje, -1), '00:00', '00:01').starts_at, p_to: toRange(addDays(hoje, 120), '00:00', '00:01').starts_at })
      .then(({ data, error }) => {
        if (error) setErro(dbError(error, 'Não foi possível carregar seus trabalhos.'))
        setItens(data ?? [])
      })
  }, [])

  const ordenados = useMemo(() => [...(itens ?? [])].filter(i => new Date(i.ends_at).getTime() > Date.now())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [itens])

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Meus trabalhos</h1>
          <p className="subtitulo">Onde e quando você trabalha nos próximos meses. Cada linha é um dia de trabalho.</p>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {itens === null && !erro && <p className="subtitulo">Carregando…</p>}
      {itens && ordenados.length === 0 && (
        <div className="vazio"><strong>Você ainda não está escalado.</strong>Candidate-se nas vagas abertas. Quando a gestão escolher você, o trabalho aparece aqui.</div>
      )}
      {ordenados.length > 0 && (
        <ul className="lista lista-trabalhos">
          {ordenados.map(i => (
            <li key={`${i.job_id}-${i.starts_at}`} className={i.status === 'cancelado' ? 'cancelado' : ''}>
              <div className="trabalho-linha">
                <DataBloco iso={i.starts_at} />
                <div className="trabalho-info">
                  <div className="nome">{i.title}</div>
                  <div className="meta">
                    <span className="folha-hora">{faixa(i.starts_at, i.ends_at)}</span>
                    <span>{i.equipment}</span>
                    {(i.location || i.city) && <span>{[i.location, i.city].filter(Boolean).join(', ')}</span>}
                  </div>
                </div>
                <div className="trabalho-estado">
                  {i.status === 'cancelado' ? <Etiqueta tom="alerta">Cancelado</Etiqueta> : <span className="meta-pequena">{TIPO_LABEL[i.type]}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
