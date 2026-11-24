import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Etiqueta } from '../components/JobBits'
import { supabase } from '../lib/supabase'
import { dbError, linkDrive, MIDIA_LABEL, rpc, STATUS_LABEL, tipoPeloLink, TIPO_LABEL, type JobStatus, type JobType, type MediaItem, type MediaKind } from '../lib/jobs'
import { dataCurta, dataHora, diaSemana, faixa } from '../lib/time'

interface Job { id: string; type: JobType; title: string; status: JobStatus; location: string | null; city: string | null; clients: { name: string } | null }
interface Dia { id: string; starts_at: string; ends_at: string }
interface Rascunho { url: string; title: string; kind: MediaKind | '' }

const TIPOS: MediaKind[] = ['pasta', 'foto', 'video']
const vazio: Rascunho = { url: '', title: '', kind: '' }

/** Problema do rascunho em linguagem da operação, ou null se dá para salvar. */
function problema(r: Rascunho) {
  const url = r.url.trim()
  if (!url) return 'Cole o link do Google Drive.'
  if (!linkDrive(url)) return 'Use um link do Google Drive (começa com https://drive.google.com ou https://docs.google.com).'
  if (!r.title.trim()) return 'Dê um nome ao link.'
  if (r.title.trim().length > 120) return 'O nome pode ter até 120 caracteres.'
  if (!r.kind) return 'Escolha se é pasta, foto ou vídeo.'
  return null
}

/** Links do Drive de um trabalho: a social media adiciona, donos e gestão conferem. */
export default function MidiaTrabalho() {
  const { id } = useParams() as { id: string }
  const [job, setJob] = useState<Job | null>(null)
  const [dias, setDias] = useState<Dia[]>([])
  const [itens, setItens] = useState<MediaItem[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [novo, setNovo] = useState<Rascunho>(vazio)
  const [tentou, setTentou] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const idAtual = useRef(id)
  useEffect(() => { idAtual.current = id }, [id])

  const carregarItens = useCallback(async () => {
    const m = await rpc<MediaItem[]>('job_media', { p_job_id: id })
    if (id !== idAtual.current) return
    if (m.error) setErro(dbError(m.error, 'Não foi possível carregar os links.'))
    setItens(m.data ?? [])
  }, [id])

  useEffect(() => {
    setJob(null); setDias([]); setItens(null); setErro(null); setAviso(null); setNovo(vazio); setTentou(false)
    Promise.all([
      supabase.from('jobs').select('id,type,title,status,location,city,clients(name)').eq('id', id).single(),
      supabase.from('job_days').select('id,starts_at,ends_at').eq('job_id', id).order('starts_at'),
    ]).then(([j, d]) => {
      if (id !== idAtual.current) return
      if (j.error || !j.data) { setErro('Trabalho não encontrado ou sem acesso.'); return }
      setJob(j.data as unknown as Job); setDias(d.data ?? [])
    })
    void carregarItens()
  }, [id, carregarItens])

  /** Executa uma escrita, mostra o resultado e recarrega a lista. */
  async function escrever(pedido: () => PromiseLike<{ error: { message: string; code?: string } | null }>, ok: string, falha: string) {
    setOcupado(true); setErro(null); setAviso(null)
    const { error } = await pedido()
    setOcupado(false)
    if (error) { setErro(dbError(error, falha)); return false }
    setAviso(ok); await carregarItens(); return true
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (problema(novo)) return
    const salvo = await escrever(
      () => supabase.from('media_items').insert({ job_id: id, url: novo.url.trim(), title: novo.title.trim(), kind: novo.kind as MediaKind }),
      'Link adicionado.', 'Não foi possível adicionar o link.')
    if (salvo) { setNovo(vazio); setTentou(false) }
  }

  if (erro && !job) return <><p className="voltar"><Link to="/midias">Voltar às mídias</Link></p><p className="erro" role="alert">{erro}</p></>
  if (!job || job.id !== id) return <p className="subtitulo">Carregando trabalho…</p>

  const aceita = job.status === 'publicado' || job.status === 'realizado'
  const falta = tentou ? problema(novo) : null

  return (
    <>
      <p className="voltar"><Link to="/midias">Voltar às mídias</Link></p>
      <div className="cabecalho">
        <div>
          {job.status !== 'publicado' && <div className="etiquetas" style={{ marginBottom: 10 }}><Etiqueta tom={job.status === 'cancelado' ? 'alerta' : 'neutro'}>{STATUS_LABEL[job.status]}</Etiqueta></div>}
          <h1 className="titulo">{job.title}</h1>
          <p className="subtitulo">
            {TIPO_LABEL[job.type]}{job.clients?.name ? ` para ${job.clients.name}` : ''}. {[job.location, job.city].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      <ol className="folha-dias">
        {dias.map(d => (
          <li key={d.id}>
            <span className="folha-data">{diaSemana(d.starts_at)}, {dataCurta(d.starts_at)}</span>
            <span className="folha-hora">{faixa(d.starts_at, d.ends_at)}</span>
          </li>
        ))}
      </ol>

      {aviso && <p className="aviso-ok" role="status" style={{ marginTop: 16 }}>{aviso}</p>}
      {erro && <p className="erro" role="alert" style={{ marginTop: 16 }}>{erro}</p>}

      <section className="secao" aria-labelledby="links">
        <h2 id="links">Links do Drive</h2>
        <p>Abra o link para ver o arquivo no Google Drive. Quem não tiver acesso à pasta precisa pedir à Retratus.</p>
        {itens === null && <p className="subtitulo">Carregando links…</p>}
        {itens?.length === 0 && (
          <div className="vazio">
            <strong>Nenhum link ainda.</strong>
            {aceita ? 'Quando as fotos e vídeos estiverem no Drive, cole o link da pasta abaixo.' : 'Este trabalho não recebe mídias.'}
          </div>
        )}
        {!!itens?.length && (
          <ul className="lista lista-midias">
            {itens.map(m => <ItemMidia key={m.id} m={m} editavel={aceita} ocupado={ocupado} escrever={escrever} />)}
          </ul>
        )}
      </section>

      {aceita && (
        <section className="secao" aria-labelledby="novo-link">
          <h2 id="novo-link">Adicionar link</h2>
          <p>Prefira o link da pasta do trabalho, com todas as fotos e vídeos dentro. No Drive: botão direito na pasta, Compartilhar, Copiar link.</p>
          <form className="form-midia" onSubmit={e => void adicionar(e)} noValidate>
            <Campos r={novo} muda={r => setNovo(r)} prefixo="novo" invalido={!!falta} />
            {falta && <p className="erro" role="alert">{falta}</p>}
            <div><button className="btn" disabled={ocupado}>Adicionar link</button></div>
          </form>
        </section>
      )}
    </>
  )
}

/** Campos de link, nome e tipo; o tipo vira "Pasta" sozinho quando o link é de pasta. */
function Campos({ r, muda, prefixo, invalido }: { r: Rascunho; muda: (r: Rascunho) => void; prefixo: string; invalido: boolean }) {
  return (
    <>
      <div className="campo">
        <label htmlFor={`${prefixo}-url`}>Link do Google Drive</label>
        <input id={`${prefixo}-url`} type="url" inputMode="url" autoComplete="off" placeholder="https://drive.google.com/drive/folders/…" value={r.url}
          aria-invalid={invalido && !linkDrive(r.url.trim())}
          onChange={e => { const url = e.target.value; muda({ ...r, url, kind: tipoPeloLink(url.trim()) ?? r.kind }) }} />
      </div>
      <div className="duas-colunas">
        <div className="campo">
          <label htmlFor={`${prefixo}-titulo`}>Nome</label>
          <input id={`${prefixo}-titulo`} maxLength={120} placeholder="Ex.: Fotos do Totem, sábado" value={r.title}
            aria-invalid={invalido && !r.title.trim()} onChange={e => muda({ ...r, title: e.target.value })} />
        </div>
        <fieldset className="campo tipo-midia">
          <legend>Tipo</legend>
          <div className="segmentado" role="group" aria-label="Tipo de mídia">
            {TIPOS.map(t => <button type="button" key={t} aria-pressed={r.kind === t} onClick={() => muda({ ...r, kind: t })}>{MIDIA_LABEL[t]}</button>)}
          </div>
        </fieldset>
      </div>
    </>
  )
}

type Escrever = (pedido: () => PromiseLike<{ error: { message: string; code?: string } | null }>, ok: string, falha: string) => Promise<boolean>

function ItemMidia({ m, editavel, ocupado, escrever }: { m: MediaItem; editavel: boolean; ocupado: boolean; escrever: Escrever }) {
  const [modo, setModo] = useState<'ver' | 'editar' | 'remover'>('ver')
  const [r, setR] = useState<Rascunho>({ url: m.url, title: m.title, kind: m.kind })
  const [tentou, setTentou] = useState(false)
  const falta = tentou ? problema(r) : null

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (problema(r)) return
    const ok = await escrever(() => supabase.from('media_items').update({ url: r.url.trim(), title: r.title.trim(), kind: r.kind as MediaKind }).eq('id', m.id),
      'Link atualizado.', 'Não foi possível salvar o link.')
    if (ok) { setModo('ver'); setTentou(false) }
  }

  if (modo === 'editar') {
    return (
      <li className="midia-editando">
        <form className="form-midia" onSubmit={e => void salvar(e)} noValidate>
          <Campos r={r} muda={setR} prefixo={`m-${m.id}`} invalido={!!falta} />
          {falta && <p className="erro" role="alert">{falta}</p>}
          <div className="acoes-cabecalho">
            <button className="btn" disabled={ocupado}>Salvar</button>
            <button type="button" className="btn btn-linha" onClick={() => { setModo('ver'); setR({ url: m.url, title: m.title, kind: m.kind }); setTentou(false) }}>Cancelar</button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li>
      <div className="midia-info">
        <div className="nome">
          <span className={`tipo-marca tipo-${m.kind}`}>{MIDIA_LABEL[m.kind]}</span>
          <a href={m.url} target="_blank" rel="noopener noreferrer">{m.title}<span className="sr"> (abre o Google Drive em outra aba)</span></a>
        </div>
        <div className="meta">
          <span>{m.added_by_name ? `Adicionado por ${m.added_by_name}` : 'Adicionado'} em {dataHora(m.created_at)}</span>
        </div>
      </div>
      {editavel && (
        <div className="acoes">
          {modo === 'remover' ? (
            <>
              <span className="meta-pequena">Remover o link do app? O arquivo continua no Drive.</span>
              <button className="btn perigo-cheio" disabled={ocupado}
                onClick={() => void escrever(() => supabase.from('media_items').delete().eq('id', m.id), 'Link removido do app.', 'Não foi possível remover o link.')}>Remover</button>
              <button className="btn btn-linha" onClick={() => setModo('ver')}>Manter</button>
            </>
          ) : (
            <>
              <button className="btn btn-linha" onClick={() => setModo('editar')}>Editar</button>
              <button className="btn btn-linha perigo" onClick={() => setModo('remover')}>Remover</button>
            </>
          )}
        </div>
      )}
    </li>
  )
}
