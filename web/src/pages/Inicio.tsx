import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { isStaff } from '../lib/types'
import Painel from '../components/Painel'
import { rpc, type MediaOverview } from '../lib/jobs'
import { inicioDoMes, meiaNoite, proximoMes, todayLocal } from '../lib/time'

interface Aviso { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Belem', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export default function Inicio() {
  const { profile } = useAuth()
  const staff = isStaff(profile)
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendentes, setPendentes] = useState(0)
  const midia = profile?.role === 'media' && profile.approved
  const [semMidia, setSemMidia] = useState(0)

  // Social media: quantos trabalhos deste mês já terminaram sem nenhum link (mesma conta da tela Mídias).
  useEffect(() => {
    if (!midia) return
    const mes = inicioDoMes(todayLocal())
    rpc<MediaOverview[]>('media_overview', { p_from: meiaNoite(mes), p_to: meiaNoite(proximoMes(mes)) }).then(({ data }) => {
      const agora = Date.now()
      setSemMidia((data ?? []).filter(m => !Number(m.media_count) && new Date(m.last_end).getTime() <= agora).length)
    })
  }, [midia])

  useEffect(() => {
    if (!profile) return
    supabase.from('notifications').select('id,title,body,link,read_at,created_at').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => { if (error) setErro('Não foi possível carregar seus avisos.'); setAvisos((data as Aviso[]) ?? []) })
    if (staff) supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approved', false).then(({ count }) => setPendentes(count ?? 0))

    // Avisos novos chegam em tempo real enquanto o app está aberto.
    const canal = supabase.channel(`avisos-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        payload => setAvisos(a => [payload.new as Aviso, ...(a ?? [])]))
      .subscribe()
    return () => { void supabase.removeChannel(canal) }
  }, [profile, staff])

  async function marcarLidos() {
    if (!profile) return
    const agora = new Date().toISOString()
    await supabase.from('notifications').update({ read_at: agora }).eq('user_id', profile.id).is('read_at', null)
    setAvisos(a => a?.map(x => x.read_at ? x : { ...x, read_at: agora }) ?? null)
  }

  const naoLidos = avisos?.filter(a => !a.read_at).length ?? 0
  const primeiroNome = profile?.full_name.split(' ')[0]

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Olá, {primeiroNome}</h1>
          <p className="subtitulo">{staff ? 'Como estão os trabalhos do período, quem está trabalhando e os avisos da operação.' : midia ? 'Os trabalhos que precisam de fotos e vídeos e os avisos da operação.' : 'Seus avisos de vagas e de seleção para trabalhos.'}</p>
        </div>
      </div>

      {staff && pendentes > 0 && (
        <div className="pendencia">
          <p><strong>{pendentes}</strong>{pendentes === 1 ? 'cadastro aguarda aprovação' : 'cadastros aguardam aprovação'}</p>
          <Link className="btn" to="/equipe">Ver cadastros</Link>
        </div>
      )}

      {midia && semMidia > 0 && (
        <div className="pendencia">
          <p><strong>{semMidia}</strong>{semMidia === 1 ? 'trabalho deste mês já aconteceu e está sem mídia' : 'trabalhos deste mês já aconteceram e estão sem mídia'}</p>
          <Link className="btn" to="/midias?f=sem">Ver trabalhos</Link>
        </div>
      )}

      {staff && <Painel dono={profile?.role === 'owner'} />}

      <section className="secao" aria-labelledby="avisos">
        <div className="cabecalho" style={{ marginBottom: 12 }}>
          <h2 id="avisos">Avisos</h2>
          {naoLidos > 0 && <button className="btn btn-linha" onClick={() => void marcarLidos()}>Marcar todos como lidos</button>}
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {avisos === null && !erro && <p className="subtitulo">Carregando avisos…</p>}
        {avisos?.length === 0 && (
          <div className="vazio">
            <strong>Nenhum aviso por enquanto.</strong>
            {staff ? 'Quando alguém se cadastrar ou se candidatar, o aviso aparece aqui.' : midia ? 'Quando houver um aviso para você, ele aparece aqui.' : 'Quando a Retratus abrir vagas ou selecionar você para um trabalho, o aviso aparece aqui.'}
          </div>
        )}
        {!!avisos?.length && (
          <ul className="lista">
            {avisos.map(a => (
              <li key={a.id} className={a.read_at ? '' : 'aviso-nao-lido'}>
                <div>
                  <div className="nome">{a.title}</div>
                  {a.body && <div className="meta">{a.body}</div>}
                </div>
                <div className="acoes">
                  <span className="meta">{quando(a.created_at)}</span>
                  {a.link && <Link className="btn btn-linha" to={a.link}>Abrir</Link>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
