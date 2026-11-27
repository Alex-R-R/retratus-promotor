export const ZONE = 'America/Belem'

export function onlyDigits(v: string) {
  return v.replace(/\D/g, '')
}

export function formatPhone(v: string | null) {
  const d = onlyDigits(v ?? '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v ?? ''
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

// Mensagens do Supabase Auth em português, na voz da interface.
export function authErrorMessage(message: string) {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha não conferem. Confira e tente de novo.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (m.includes('already registered')) return 'Este e-mail já tem cadastro. Entre ou recupere a senha.'
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (m.includes('rate limit')) return 'Muitas tentativas seguidas. Aguarde alguns minutos.'
  if (m.includes('failed to fetch')) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  return message
}
