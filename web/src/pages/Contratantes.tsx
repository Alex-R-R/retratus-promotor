import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatPhone } from '../lib/format'
import { CLIENTE_TIPO_LABEL, dbError, type ClienteTipo } from '../lib/jobs'

interface Cliente { id: string; name: string; kind: ClienteTipo; listed: boolean; contact_name: string | null; phone: string | null; notes: string | null }
type Aba = 'lista' | 'avulsos'

const vazio = { name: '', kind: 'ambos' as ClienteTipo, contact_name: '', phone: '', notes: '' }

export default function Contratantes() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [aba, setAba] = useState<Aba>('lista')
  const [form, setForm] = useState(vazio)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('clients').select('id,name,kind,listed,contact_name,phone,notes').order('name')
    if (error) setErro('Não foi possível carregar os contratantes.')
    setClientes(data ?? [])
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  function novo() { setForm(vazio); setEditandoId(null); setAberto(true); setErro(null) }
  function editar(c: Cliente) {
    setForm({ name: c.name, kind: c.kind, contact_name: c.contact_name ?? '', phone: c.phone ?? '', notes: c.notes ?? '' })
    setEditandoId(c.id); setAberto(true); setErro(null)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2) return setErro('Informe o nome do contratante.')
    setSalvando(true); setErro(null)
    const dados = { name: form.name.trim(), kind: form.kind, contact_name: form.contact_name.trim() || null, phone: form.phone.trim() || null, notes: form.notes.trim() || null }
    const { error } = editandoId
      ? await supabase.from('clients').update(dados).eq('id', editandoId)
      : await supabase.from('clients').insert({ ...dados, listed: true })
    setSalvando(false)
    if (error) return setErro(dbError(error, 'Não foi possível salvar o contratante.'))
    setAberto(false); setEditandoId(null)
    void carregar()
  }

  async function mudarLista(c: Cliente, listed: boolean) {
    setErro(null)
    const { error } = await supabase.from('clients').update({ listed }).eq('id', c.id)
    if (error) return setErro(dbError(error, 'Não foi possível mudar o contratante.'))
    setClientes(cs => cs?.map(x => x.id === c.id ? { ...x, listed } : x) ?? null)
  }

  const fixos = clientes?.filter(c => c.listed) ?? []
  const avulsos = clientes?.filter(c => !c.listed) ?? []
  const lista = aba === 'lista' ? fixos : avulsos

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Contratantes</h1>
          <p className="subtitulo">Só os da lista aparecem ao montar um trabalho. Quem é cadastrado na hora fica em Avulsos.</p>
        </div>
        {!aberto && <button className="btn" onClick={novo}>Novo contratante</button>}
      </div>

      {aberto && (
        <form className="grupo form-contratante" onSubmit={salvar} noValidate>
          <div className="duas-colunas">
            <div className="campo">
              <label htmlFor="c-nome">Nome</label>
              <input id="c-nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Shopping Boulevard" />
            </div>
            <div className="campo">
              <label htmlFor="c-tipo">Contrata</label>
              <select id="c-tipo" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as ClienteTipo })}>
                {(Object.keys(CLIENTE_TIPO_LABEL) as ClienteTipo[]).map(k => <option key={k} value={k}>{CLIENTE_TIPO_LABEL[k]}</option>)}
              </select>
              <span className="dica">Define em que tipo de trabalho ele aparece para escolha.</span>
            </div>
          </div>
          <div className="duas-colunas">
            <div className="campo">
              <label htmlFor="c-contato">Pessoa de contato</label>
              <input id="c-contato" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="c-tel">Telefone</label>
              <input id="c-tel" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="c-obs">Observações</label>
            <textarea id="c-obs" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-rodape">
            <button className="btn" disabled={salvando}>{salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Adicionar à lista'}</button>
            <button type="button" className="btn btn-linha" onClick={() => { setAberto(false); setEditandoId(null); setErro(null) }}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="abas" role="group" aria-label="Contratantes">
        <button aria-pressed={aba === 'lista'} onClick={() => setAba('lista')}>Lista ({fixos.length})</button>
        <button aria-pressed={aba === 'avulsos'} onClick={() => setAba('avulsos')}>Avulsos ({avulsos.length})</button>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {clientes === null && <p className="subtitulo">Carregando contratantes…</p>}
      {clientes && lista.length === 0 && (
        <div className="vazio" style={{ marginTop: 16 }}>
          <strong>{aba === 'lista' ? 'Nenhum contratante na lista.' : 'Nenhum contratante avulso.'}</strong>
          {aba === 'lista' ? 'Cadastre os contratantes frequentes para escolher rápido ao montar um trabalho.' : 'Contratantes cadastrados na hora, dentro de um trabalho, aparecem aqui.'}
        </div>
      )}

      {lista.length > 0 && (
        <ul className="lista">
          {lista.map(c => (
            <li key={c.id}>
              <div>
                <div className="nome">{c.name}</div>
                <div className="meta">
                  <span>{CLIENTE_TIPO_LABEL[c.kind]}</span>
                  {c.contact_name && <span>{c.contact_name}</span>}
                  {c.phone && <span>{formatPhone(c.phone)}</span>}
                </div>
              </div>
              <div className="acoes">
                <button className="btn-texto" onClick={() => editar(c)}>Editar</button>
                {c.listed
                  ? <button className="btn-texto" onClick={() => void mudarLista(c, false)}>Tirar da lista</button>
                  : <button className="btn btn-linha" onClick={() => void mudarLista(c, true)}>Adicionar à lista</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
