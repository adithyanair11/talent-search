
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
            "candidates": {
                  Row: {
                    "avatar_url": string,"city": string,"city_key": string | null,"companies_key": (string)[] | null,"company_types": (string)[] | null,"country": string,"created_at": string,"current_company": string,"current_company_logo_url": string,"current_company_type": string | null,"current_title": string,"degrees": (string)[] | null,"education": NonNullable<Json>,"experiences": NonNullable<Json>,"fields_key": (string)[] | null,"full_name": string,"headline": string,"id": string,"open_to_work": boolean,"role": string,"schools_key": (string)[] | null,"seniority": string,"skills": (string)[],"skills_key": (string)[] | null,"state": string,"state_key": string | null,"title_key": string | null,"years_experience": number
                  }
                  Insert: {
                    "avatar_url": string,"city": string,"city_key"?: never,"companies_key"?: never,"company_types"?: never,"country": string,"created_at"?: string,"current_company": string,"current_company_logo_url": string,"current_company_type"?: never,"current_title": string,"degrees"?: never,"education"?: NonNullable<Json>,"experiences"?: NonNullable<Json>,"fields_key"?: never,"full_name": string,"headline": string,"id": string,"open_to_work": boolean,"role": string,"schools_key"?: never,"seniority": string,"skills"?: (string)[],"skills_key"?: never,"state": string,"state_key"?: never,"title_key"?: never,"years_experience": number
                  }
                  Update: {
                    "avatar_url"?: string,"city"?: string,"city_key"?: never,"companies_key"?: never,"company_types"?: never,"country"?: string,"created_at"?: string,"current_company"?: string,"current_company_logo_url"?: string,"current_company_type"?: never,"current_title"?: string,"degrees"?: never,"education"?: NonNullable<Json>,"experiences"?: NonNullable<Json>,"fields_key"?: never,"full_name"?: string,"headline"?: string,"id"?: string,"open_to_work"?: boolean,"role"?: string,"schools_key"?: never,"seniority"?: string,"skills"?: (string)[],"skills_key"?: never,"state"?: string,"state_key"?: never,"title_key"?: never,"years_experience"?: number
                  }
                  Relationships: [
                    
                  ]
                },"companies": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"searches_used": number,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"searches_used"?: number,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"searches_used"?: number,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recruiters": {
                  Row: {
                    "company_id": string,"created_at": string,"user_id": string
                  }
                  Insert: {
                    "company_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recruiters_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_briefs": {
                  Row: {
                    "brief": string,"company_id": string,"created_at": string,"filters": NonNullable<Json>,"id": string
                  }
                  Insert: {
                    "brief": string,"company_id"?: string,"created_at"?: string,"filters"?: NonNullable<Json>,"id"?: string
                  }
                  Update: {
                    "brief"?: string,"company_id"?: string,"created_at"?: string,"filters"?: NonNullable<Json>,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_briefs_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"searches": {
                  Row: {
                    "brief": string,"company_id": string,"created_at": string,"filters": NonNullable<Json>,"id": string,"recruiter_id": string | null,"result_ids": (string)[],"total": number
                  }
                  Insert: {
                    "brief": string,"company_id": string,"created_at"?: string,"filters"?: NonNullable<Json>,"id"?: string,"recruiter_id"?: string | null,"result_ids"?: (string)[],"total"?: number
                  }
                  Update: {
                    "brief"?: string,"company_id"?: string,"created_at"?: string,"filters"?: NonNullable<Json>,"id"?: string,"recruiter_id"?: string | null,"result_ids"?: (string)[],"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "searches_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "searches_recruiter_id_fkey"
      columns: ["recruiter_id"]
isOneToOne: false
      referencedRelation: "recruiters"
      referencedColumns: ["user_id"]
    }
                  ]
                },"shortlist_people": {
                  Row: {
                    "added_at": string,"company_id": string,"person_id": string,"shortlist_id": string
                  }
                  Insert: {
                    "added_at"?: string,"company_id"?: string,"person_id": string,"shortlist_id": string
                  }
                  Update: {
                    "added_at"?: string,"company_id"?: string,"person_id"?: string,"shortlist_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shortlist_people_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shortlist_people_shortlist_id_company_id_fkey"
      columns: ["shortlist_id","company_id"]
isOneToOne: false
      referencedRelation: "shortlists"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"shortlists": {
                  Row: {
                    "company_id": string,"created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "company_id"?: string,"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shortlists_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "created": number,"event_id": string,"received_at": string,"type": string
                  }
                  Insert: {
                    "created": number,"event_id": string,"received_at"?: string,"type": string
                  }
                  Update: {
                    "created"?: number,"event_id"?: string,"received_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "company_id": string,"last_event_created": number,"last_event_id": string,"status": string,"stripe_subscription_id": string,"updated_at": string
                  }
                  Insert: {
                    "company_id": string,"last_event_created": number,"last_event_id": string,"status": string,"stripe_subscription_id": string,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"last_event_created"?: number,"last_event_id"?: string,"status"?: string,"stripe_subscription_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
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
            
          }
        }
} as const
