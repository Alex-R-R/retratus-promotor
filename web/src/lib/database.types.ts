
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "applications": {
                  Row: {
                    "created_at": string,"equipment": (string)[],"id": string,"job_id": string,"promoter_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"equipment": (string)[],"id"?: string,"job_id": string,"promoter_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"equipment"?: (string)[],"id"?: string,"job_id"?: string,"promoter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_promoter_id_fkey"
      columns: ["promoter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "contact_name": string | null,"created_at": string,"id": string,"name": string,"notes": string | null,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_name"?: string | null,"created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null
                  }
                  Update: {
                    "contact_name"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"event_pay_rates": {
                  Row: {
                    "amount": number,"hours": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"hours": number
                  }
                  Update: {
                    "amount"?: number,"hours"?: number
                  }
                  Relationships: [
                    
                  ]
                },"job_days": {
                  Row: {
                    "ends_at": string,"id": string,"job_id": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_at": string,"id"?: string,"job_id": string,"starts_at": string
                  }
                  Update: {
                    "ends_at"?: string,"id"?: string,"job_id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_days_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_slots": {
                  Row: {
                    "capacity": number,"equipment": string,"id": string,"job_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity": number,"equipment": string,"id"?: string,"job_id": string
                  }
                  Update: {
                    "capacity"?: number,"equipment"?: string,"id"?: string,"job_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_slots_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "briefing": Database["public"]['Enums']["briefing_status"],"cancel_reason": string | null,"city": string | null,"client_id": string | null,"created_at": string,"created_by": string | null,"id": string,"location": string | null,"notes": string | null,"status": Database["public"]['Enums']["job_status"],"title": string,"type": Database["public"]['Enums']["job_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "briefing"?: Database["public"]['Enums']["briefing_status"],"cancel_reason"?: string | null,"city"?: string | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location"?: string | null,"notes"?: string | null,"status"?: Database["public"]['Enums']["job_status"],"title": string,"type": Database["public"]['Enums']["job_type"],"updated_at"?: string
                  }
                  Update: {
                    "briefing"?: Database["public"]['Enums']["briefing_status"],"cancel_reason"?: string | null,"city"?: string | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location"?: string | null,"notes"?: string | null,"status"?: Database["public"]['Enums']["job_status"],"title"?: string,"type"?: Database["public"]['Enums']["job_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"media_items": {
                  Row: {
                    "added_by": string | null,"created_at": string,"id": string,"job_id": string,"kind": Database["public"]['Enums']["media_kind"],"title": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"id"?: string,"job_id": string,"kind": Database["public"]['Enums']["media_kind"],"title": string,"url": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"id"?: string,"job_id"?: string,"kind"?: Database["public"]['Enums']["media_kind"],"title"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_items_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_items_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pay_settings": {
                  Row: {
                    "extra_hour_amount": number | null,"id": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "extra_hour_amount"?: number | null,"id"?: boolean
                  }
                  Update: {
                    "extra_hour_amount"?: number | null,"id"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"paid_at": string | null,"selection_id": string,"source": Database["public"]['Enums']["pay_source"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"paid_at"?: string | null,"selection_id": string,"source"?: Database["public"]['Enums']["pay_source"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"paid_at"?: string | null,"selection_id"?: string,"source"?: Database["public"]['Enums']["pay_source"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_selection_id_fkey"
      columns: ["selection_id"]
isOneToOne: true
      referencedRelation: "selections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "approved": boolean,"created_at": string,"email": string | null,"full_name": string,"id": string,"link": Database["public"]['Enums']["person_link"],"phone": string | null,"role": Database["public"]['Enums']["user_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "approved"?: boolean,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id": string,"link"?: Database["public"]['Enums']["person_link"],"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "approved"?: boolean,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"link"?: Database["public"]['Enums']["person_link"],"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                },"selection_days": {
                  Row: {
                    "job_day_id": string,"selection_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "job_day_id": string,"selection_id": string
                  }
                  Update: {
                    "job_day_id"?: string,"selection_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "selection_days_job_day_id_fkey"
      columns: ["job_day_id"]
isOneToOne: false
      referencedRelation: "job_days"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "selection_days_selection_id_fkey"
      columns: ["selection_id"]
isOneToOne: false
      referencedRelation: "selections"
      referencedColumns: ["id"]
    }
                  ]
                },"selections": {
                  Row: {
                    "created_at": string,"created_by": string | null,"equipment": string,"id": string,"job_id": string,"promoter_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"equipment": string,"id"?: string,"job_id": string,"promoter_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"equipment"?: string,"id"?: string,"job_id"?: string,"promoter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "selections_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "selections_job_id_equipment_fkey"
      columns: ["job_id","equipment"]
isOneToOne: false
      referencedRelation: "job_slots"
      referencedColumns: ["job_id","equipment"]
    },{
      foreignKeyName: "selections_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "selections_promoter_id_fkey"
      columns: ["promoter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "agenda":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "city": string,"ends_at": string,"id": string,"job_id": string,"location": string,"promoters": Json,"starts_at": string,"status": Database["public"]['Enums']["job_status"],"title": string,"type": Database["public"]['Enums']["job_type"]
            }[]
                           },
"apply_to_job":
{ Args: { "p_equipment": (string)[],"p_job_id": string }; Returns: undefined
                           },
"calendar":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "briefing": Database["public"]['Enums']["briefing_status"],"city": string,"client_name": string,"day_id": string,"ends_at": string,"job_id": string,"location": string,"promoters": Json,"slots": Json,"starts_at": string,"status": Database["public"]['Enums']["job_status"],"title": string,"type": Database["public"]['Enums']["job_type"]
            }[]
                           },
"cancel_job":
{ Args: { "p_job_id": string,"p_reason": string }; Returns: undefined
                           },
"current_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"dashboard_counts":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "aguardando_briefing": number,"briefing_fechado": number,"equipe_completa": number,"vagas_abertas": number
            }[]
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"job_board":
{ Args: Record<PropertyKey, never>; Returns: {
              "application_deadline": string,"city": string,"days": Json,"i_am_selected": boolean,"job_id": string,"location": string,"my_application": (string)[],"notes": string,"slots": Json,"title": string,"type": Database["public"]['Enums']["job_type"]
            }[]
                           },
"job_candidates":
{ Args: { "p_job_id": string }; Returns: {
              "applied_at": string,"applied_equipment": (string)[],"conflict_day_ids": (string)[],"full_name": string,"link": Database["public"]['Enums']["person_link"],"phone": string,"promoter_id": string,"selections": Json
            }[]
                           },
"job_media":
{ Args: { "p_job_id": string }; Returns: {
              "added_by": string,"added_by_name": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["media_kind"],"title": string,"url": string
            }[]
                           },
"jobs_overview":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "applications_count": number,"briefing": Database["public"]['Enums']["briefing_status"],"capacity_total": number,"city": string,"client_name": string,"day_count": number,"filled_total": number,"first_start": string,"job_id": string,"last_end": string,"location": string,"staffing": string,"status": Database["public"]['Enums']["job_status"],"title": string,"type": Database["public"]['Enums']["job_type"]
            }[]
                           },
"media_overview":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "city": string,"client_name": string,"day_count": number,"first_start": string,"fotos": number,"job_id": string,"last_added_at": string,"last_end": string,"location": string,"media_count": number,"pastas": number,"status": Database["public"]['Enums']["job_status"],"team_count": number,"title": string,"type": Database["public"]['Enums']["job_type"],"videos": number
            }[]
                           },
"my_jobs":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "city": string,"ends_at": string,"equipment": string,"job_id": string,"location": string,"starts_at": string,"status": Database["public"]['Enums']["job_status"],"title": string,"type": Database["public"]['Enums']["job_type"]
            }[]
                           },
"payments_overview":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "amount": number,"day_count": number,"equipment": string,"first_start": string,"full_name": string,"hours": number,"job_id": string,"paid_at": string,"promoter_id": string,"selection_id": string,"source": Database["public"]['Enums']["pay_source"],"suggested": number,"title": string,"type": Database["public"]['Enums']["job_type"]
            }[]
                           },
"promoter_job_counts":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "dias_acao": number,"eventos": number,"full_name": string,"promoter_id": string,"sem_valor": number,"valor_pago": number,"valor_total": number
            }[]
                           },
"publish_job":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"remove_selection":
{ Args: { "p_selection_id": string }; Returns: undefined
                           },
"save_job":
{ Args: { "p_days": Json,"p_job": Json,"p_job_id": string,"p_slots": Json }; Returns: string
                           },
"select_promoter":
{ Args: { "p_day_ids": (string)[],"p_equipment": string,"p_job_id": string,"p_promoter_id": string }; Returns: string
                           },
"set_briefing":
{ Args: { "p_briefing": Database["public"]['Enums']["briefing_status"],"p_job_id": string }; Returns: undefined
                           },
"set_paid":
{ Args: { "p_paid": boolean,"p_selection_ids": (string)[] }; Returns: number
                           },
"set_payment":
{ Args: { "p_amount": number,"p_selection_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "briefing_status": "aguardando"|"fechado","job_status": "rascunho"|"publicado"|"realizado"|"cancelado","job_type": "evento"|"acao","media_kind": "foto"|"video"|"pasta","pay_source": "tabela"|"manual","person_link": "freelancer"|"employee"|"provider"|"unclassified","user_role": "owner"|"manager"|"media"|"promoter"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "briefing_status": ["aguardando", "fechado"],"job_status": ["rascunho", "publicado", "realizado", "cancelado"],"job_type": ["evento", "acao"],"media_kind": ["foto", "video", "pasta"],"pay_source": ["tabela", "manual"],"person_link": ["freelancer", "employee", "provider", "unclassified"],"user_role": ["owner", "manager", "media", "promoter"]
          }
        }
} as const
