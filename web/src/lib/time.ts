// Operação em America/Belem (UTC-3, sem horário de verão).
export const ZONE = 'America/Belem'
const OFFSET = '-03:00'
const DAY_MS = 86_400_000

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** ISO (UTC) → { date: 'YYYY-MM-DD', time: 'HH:MM' } em Belém. */
export function splitLocal(iso: string) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

/** Data e horários locais → intervalo ISO. Se o fim não passa do início, termina no dia seguinte. */
export function toRange(date: string, start: string, end: string) {
  const s = new Date(`${date}T${start}:00${OFFSET}`)
  let e = new Date(`${date}T${end}:00${OFFSET}`)
  if (e <= s) e = new Date(e.getTime() + DAY_MS)
  return { starts_at: s.toISOString(), ends_at: e.toISOString() }
}

export const crossesMidnight = (start: string, end: string) => end <= start

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00${OFFSET}`)
  return splitLocal(new Date(d.getTime() + n * DAY_MS).toISOString()).date
}

export function todayLocal() {
  return splitLocal(new Date().toISOString()).date
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, ...opts })
const fDiaSemana = fmt({ weekday: 'short' })
const fDia = fmt({ day: '2-digit' })
const fMes = fmt({ month: 'short' })
const fDataCurta = fmt({ day: '2-digit', month: 'short' })
const fDataLonga = fmt({ weekday: 'long', day: '2-digit', month: 'long' })
const fHora = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const fDataHora = fmt({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

const limpa = (s: string) => s.replace('.', '')

export const diaSemana = (iso: string) => limpa(fDiaSemana.format(new Date(iso)))
export const dia = (iso: string) => fDia.format(new Date(iso))
export const mes = (iso: string) => limpa(fMes.format(new Date(iso)))
export const dataCurta = (iso: string) => limpa(fDataCurta.format(new Date(iso)))
export const dataLonga = (iso: string) => fDataLonga.format(new Date(iso))
export const hora = (iso: string) => fHora.format(new Date(iso))
export const dataHora = (iso: string) => limpa(fDataHora.format(new Date(iso)))

/** "18:00–22:00" */
export const faixa = (startIso: string, endIso: string) => `${hora(startIso)}–${hora(endIso)}`

/** "12 dez" ou "12 dez – 24 dez" */
export function periodo(firstIso: string | null, lastIso: string | null) {
  if (!firstIso) return 'Sem data definida'
  if (!lastIso || splitLocal(firstIso).date === splitLocal(new Date(new Date(lastIso).getTime() - 1).toISOString()).date) return dataCurta(firstIso)
  return `${dataCurta(firstIso)} – ${dataCurta(new Date(new Date(lastIso).getTime() - 1).toISOString())}`
}

export const horas = (startIso: string, endIso: string) => (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000
