import type { PostgrestError } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabase } from './supabase'

type RpcFn = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: PostgrestError | null }>

/** Chamada de RPC com o formato de retorno do contrato. */
export async function rpc<T>(fn: string, args?: Record<string, unknown>) {
  const call = supabase.rpc.bind(supabase) as unknown as RpcFn
  const { data, error } = await call(fn, args)
  return { data: data as T, error }
}
import type { PersonLink } from './types'

type Enums = Database['public']['Enums']
export type JobType = Enums['job_type']
export type JobStatus = Enums['job_status']
export type Briefing = Enums['briefing_status']
export type Staffing = 'sem_vagas' | 'vagas_abertas' | 'equipe_completa'

export const EQUIPAMENTOS = ['Totem', 'Self print', 'Totem slim', 'Plataforma 360', 'Túnel de LED', 'Máquina de garra'] as const
export type Equipamento = (typeof EQUIPAMENTOS)[number]

export const TIPO_LABEL: Record<JobType, string> = { evento: 'Evento', acao: 'Ação' }
export const STATUS_LABEL: Record<JobStatus, string> = { rascunho: 'Rascunho', publicado: 'Publicado', realizado: 'Realizado', cancelado: 'Cancelado' }
export const BRIEFING_LABEL: Record<Briefing, string> = { aguardando: 'Aguardando briefing', fechado: 'Briefing fechado' }
export const STAFFING_LABEL: Record<Staffing, string> = { sem_vagas: 'Sem vagas definidas', vagas_abertas: 'Vagas em aberto', equipe_completa: 'Equipe completa' }

// Formatos das RPCs da fase 2 (docs/CONTRATO-DADOS.md).
export interface JobOverview {
  job_id: string; title: string; type: JobType; status: JobStatus; briefing: Briefing
  city: string | null; location: string | null; client_name: string | null
  first_start: string | null; last_end: string | null; day_count: number
  capacity_total: number; filled_total: number; applications_count: number; staffing: Staffing
}

export interface BoardDay { id: string; starts_at: string; ends_at: string }
export interface BoardSlot { equipment: string; capacity: number; open_days: number }
export interface BoardJob {
  job_id: string; title: string; type: JobType; city: string | null; location: string | null; notes: string | null
  application_deadline: string; days: BoardDay[]; slots: BoardSlot[]
  my_application: string[] | null; i_am_selected: boolean
}

export interface CandidateSelection { selection_id: string; equipment: string; day_ids: string[] }
export interface Candidate {
  promoter_id: string; full_name: string; phone: string | null; link: PersonLink
  applied_equipment: string[] | null; applied_at: string | null
  selections: CandidateSelection[]; conflict_day_ids: string[] | null
}

export interface MyJob {
  job_id: string; title: string; type: JobType; city: string | null; location: string | null
  equipment: string; starts_at: string; ends_at: string; status: JobStatus
}

/** Mensagens do banco (raise ... using message) chegam em error.message; erros de permissão viram texto da interface. */
export function dbError(e: { message: string; code?: string } | null, fallback: string) {
  if (!e) return fallback
  if (e.code === '42501') return 'Seu perfil não tem permissão para esta ação.'
  if (e.message?.toLowerCase().includes('failed to fetch')) return 'Sem conexão com o servidor. Tente de novo.'
  return e.message || fallback
}
