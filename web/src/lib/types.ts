import type { Database } from './database.types'

// Derivados do schema gerado (docs/CONTRATO-DADOS.md).
export type UserRole = Database['public']['Enums']['user_role']
export type PersonLink = Database['public']['Enums']['person_link']
export type Profile = Database['public']['Tables']['profiles']['Row']

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Dono',
  manager: 'Gestão',
  media: 'Social media',
  promoter: 'Promotor',
}

export const LINK_LABEL: Record<PersonLink, string> = {
  freelancer: 'Freelancer',
  employee: 'Funcionário',
  provider: 'Prestador',
  unclassified: 'Sem vínculo definido',
}

export const isStaff = (p: Profile | null) => !!p && p.approved && (p.role === 'owner' || p.role === 'manager')
