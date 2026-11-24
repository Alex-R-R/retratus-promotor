import { useRegisterSW } from 'virtual:pwa-register/react'

/** Aviso de versão nova do app instalado. Só recarrega quando a pessoa pede. */
export default function Atualizacao() {
  const { needRefresh: [nova, setNova], updateServiceWorker } = useRegisterSW({
    // Confere de hora em hora, para quem deixa o app aberto no celular o dia todo.
    onRegisteredSW(_url, reg) { if (reg) setInterval(() => { void reg.update() }, 60 * 60 * 1000) },
  })
  if (!nova) return null
  return (
    <div className="atualizacao" role="status">
      <span>Há uma versão nova do app.</span>
      <button className="btn btn-ouro" onClick={() => void updateServiceWorker(true)}>Atualizar</button>
      <button className="btn-texto" onClick={() => setNova(false)}>Depois</button>
    </div>
  )
}
