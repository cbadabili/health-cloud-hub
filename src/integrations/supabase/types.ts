export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_type: string
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          practice_id: string
          provider_id: string
          reason_for_visit: string | null
          room_id: string | null
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_type: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          practice_id: string
          provider_id: string
          reason_for_visit?: string | null
          room_id?: string | null
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          practice_id?: string
          provider_id?: string
          reason_for_visit?: string | null
          room_id?: string | null
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          id: number
          metadata: Json
          occurred_at: string
          outcome: string
          practice_id: string | null
          target_id: string | null
          target_table: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          id?: number
          metadata?: Json
          occurred_at?: string
          outcome?: string
          practice_id?: string | null
          target_id?: string | null
          target_table?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          id?: number
          metadata?: Json
          occurred_at?: string
          outcome?: string
          practice_id?: string | null
          target_id?: string | null
          target_table?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      doctor_profiles: {
        Row: {
          available_hours: Json | null
          consultation_fee: number | null
          created_at: string
          experience_years: number | null
          id: string
          license_number: string | null
          qualifications: string | null
          specialization: string | null
          telehealth_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_hours?: Json | null
          consultation_fee?: number | null
          created_at?: string
          experience_years?: number | null
          id?: string
          license_number?: string | null
          qualifications?: string | null
          specialization?: string | null
          telehealth_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_hours?: Json | null
          consultation_fee?: number | null
          created_at?: string
          experience_years?: number | null
          id?: string
          license_number?: string | null
          qualifications?: string | null
          specialization?: string | null
          telehealth_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doctor_verifications: {
        Row: {
          certificate_path: string | null
          council: Database["public"]["Enums"]["registration_council"] | null
          created_at: string
          doctor_id: string
          registration_number: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          certificate_path?: string | null
          council?: Database["public"]["Enums"]["registration_council"] | null
          created_at?: string
          doctor_id: string
          registration_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          certificate_path?: string | null
          council?: Database["public"]["Enums"]["registration_council"] | null
          created_at?: string
          doctor_id?: string
          registration_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"] | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          paid_date: string | null
          patient_id: string
          practice_id: string
          provider_id: string
          site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_date?: string | null
          patient_id: string
          practice_id: string
          provider_id: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_date?: string | null
          patient_id?: string
          practice_id?: string
          provider_id?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          consultation_notes: string | null
          created_at: string
          diagnosis: string | null
          id: string
          patient_id: string
          practice_id: string
          provider_id: string
          site_id: string | null
          treatment_plan: string | null
          updated_at: string
          vital_signs: Json | null
        }
        Insert: {
          appointment_id?: string | null
          consultation_notes?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          patient_id: string
          practice_id: string
          provider_id: string
          site_id?: string | null
          treatment_plan?: string | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Update: {
          appointment_id?: string | null
          consultation_notes?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          patient_id?: string
          practice_id?: string
          provider_id?: string
          site_id?: string | null
          treatment_plan?: string | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Relationships: []
      }
      membership_sites: {
        Row: {
          membership_id: string
          practice_id: string
          site_id: string
        }
        Insert: {
          membership_id: string
          practice_id: string
          site_id: string
        }
        Update: {
          membership_id?: string
          practice_id?: string
          site_id?: string
        }
        Relationships: []
      }
      patient_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_authorized_rep: boolean
          is_responsible_party: boolean
          name: string
          patient_id: string
          phone_e164: string | null
          practice_id: string
          relationship: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_authorized_rep?: boolean
          is_responsible_party?: boolean
          name: string
          patient_id: string
          phone_e164?: string | null
          practice_id: string
          relationship: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_authorized_rep?: boolean
          is_responsible_party?: boolean
          name?: string
          patient_id?: string
          phone_e164?: string | null
          practice_id?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_portal_links: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          practice_id: string
          status: Database["public"]["Enums"]["portal_link_status"]
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          practice_id: string
          status?: Database["public"]["Enums"]["portal_link_status"]
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          practice_id?: string
          status?: Database["public"]["Enums"]["portal_link_status"]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      patient_profiles: {
        Row: {
          allergies: string | null
          blood_type: string | null
          created_at: string
          current_medications: string | null
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          gender: string | null
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          medical_history: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string | null
          blood_type?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          gender?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          medical_history?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string | null
          blood_type?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          gender?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          medical_history?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          id_number: string | null
          id_type: Database["public"]["Enums"]["national_id_type"]
          last_name: string
          merged_into: string | null
          phone_e164: string | null
          practice_id: string
          preferred_language: string
          sex: string | null
          source: Database["public"]["Enums"]["patient_source"]
          status: Database["public"]["Enums"]["patient_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["national_id_type"]
          last_name: string
          merged_into?: string | null
          phone_e164?: string | null
          practice_id: string
          preferred_language?: string
          sex?: string | null
          source?: Database["public"]["Enums"]["patient_source"]
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["national_id_type"]
          last_name?: string
          merged_into?: string | null
          phone_e164?: string | null
          practice_id?: string
          preferred_language?: string
          sex?: string | null
          source?: Database["public"]["Enums"]["patient_source"]
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Relationships: []
      }
      practices: {
        Row: {
          country: Database["public"]["Enums"]["country_code"]
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          legal_name: string | null
          name: string
          registration_no: string | null
          require_mfa: boolean
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          country: Database["public"]["Enums"]["country_code"]
          created_at?: string
          created_by?: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          legal_name?: string | null
          name: string
          registration_no?: string | null
          require_mfa?: boolean
          tenant_id: string
          timezone: string
          updated_at?: string
        }
        Update: {
          country?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          legal_name?: string | null
          name?: string
          registration_no?: string | null
          require_mfa?: boolean
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          created_at: string
          dosage: string
          duration: string
          frequency: string
          id: string
          instructions: string | null
          medical_record_id: string | null
          medication_name: string
          patient_id: string
          practice_id: string
          provider_id: string
          site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage: string
          duration: string
          frequency: string
          id?: string
          instructions?: string | null
          medical_record_id?: string | null
          medication_name: string
          patient_id: string
          practice_id: string
          provider_id: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage?: string
          duration?: string
          frequency?: string
          id?: string
          instructions?: string | null
          medical_record_id?: string | null
          medication_name?: string
          patient_id?: string
          practice_id?: string
          provider_id?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          profile_photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          membership_id: string
          practice_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id?: string
          membership_id: string
          practice_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          membership_id?: string
          practice_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          active: boolean
          created_at: string
          exclusive: boolean
          id: string
          name: string
          practice_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          exclusive?: boolean
          id?: string
          name: string
          practice_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          exclusive?: boolean
          id?: string
          name?: string
          practice_id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
          phone_e164: string | null
          practice_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
          phone_e164?: string | null
          practice_id: string
          timezone: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          phone_e164?: string | null
          practice_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          all_sites: boolean
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          practice_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["practice_role"]
          site_ids: string[]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          all_sites?: boolean
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          practice_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["practice_role"]
          site_ids?: string[]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          all_sites?: boolean
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          practice_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["practice_role"]
          site_ids?: string[]
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_memberships: {
        Row: {
          active: boolean
          all_sites: boolean
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          id: string
          practice_id: string
          role: Database["public"]["Enums"]["practice_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          all_sites?: boolean
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          practice_id: string
          role: Database["public"]["Enums"]["practice_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          all_sites?: boolean
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          practice_id?: string
          role?: Database["public"]["Enums"]["practice_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          country: Database["public"]["Enums"]["country_code"]
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          country: Database["public"]["Enums"]["country_code"]
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          country?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_verified_doctor: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
      my_practices: {
        Args: Record<PropertyKey, never>
        Returns: {
          practice_id: string
          name: string
          country: Database["public"]["Enums"]["country_code"]
          currency: Database["public"]["Enums"]["currency_code"]
          timezone: string
          require_mfa: boolean
          roles: Database["public"]["Enums"]["practice_role"][]
          all_sites: boolean
          provider_id: string | null
        }[]
      }
      practice_staff_directory: {
        Args: {
          _practice_id: string
        }
        Returns: {
          membership_id: string
          user_id: string
          role: Database["public"]["Enums"]["practice_role"]
          active: boolean
          all_sites: boolean
          site_ids: string[]
          first_name: string | null
          last_name: string | null
          email: string | null
          provider_id: string | null
          created_at: string
        }[]
      }
      create_practice: {
        Args: {
          _name: string
          _country: Database["public"]["Enums"]["country_code"]
          _site_name?: string
        }
        Returns: string
      }
      invite_staff: {
        Args: {
          _practice_id: string
          _email: string
          _role: Database["public"]["Enums"]["practice_role"]
          _all_sites?: boolean
          _site_ids?: string[]
        }
        Returns: string
      }
      revoke_invitation: {
        Args: {
          _invitation_id: string
        }
        Returns: undefined
      }
      accept_invitation: {
        Args: {
          _token: string
        }
        Returns: string
      }
      invitation_preview: {
        Args: {
          _token: string
        }
        Returns: {
          practice_name: string
          country: Database["public"]["Enums"]["country_code"]
          role: Database["public"]["Enums"]["practice_role"]
          email: string
          status: string
        }[]
      }
      deactivate_staff: {
        Args: {
          _membership_id: string
        }
        Returns: undefined
      }
      set_staff_sites: {
        Args: {
          _membership_id: string
          _all_sites: boolean
          _site_ids?: string[]
        }
        Returns: undefined
      }
      find_patient_duplicates: {
        Args: {
          _practice_id: string
          _first_name: string
          _last_name: string
          _date_of_birth: string | null
          _id_type: Database["public"]["Enums"]["national_id_type"]
          _id_number: string | null
          _phone_e164: string | null
          _exclude?: string
        }
        Returns: {
          patient_id: string
          first_name: string
          last_name: string
          date_of_birth: string | null
          phone_e164: string | null
          reason: string
        }[]
      }
      register_patient: {
        Args: {
          _practice_id: string
          _first_name: string
          _last_name: string
          _date_of_birth?: string | null
          _sex?: string | null
          _id_type?: Database["public"]["Enums"]["national_id_type"]
          _id_number?: string | null
          _phone_e164?: string | null
          _email?: string | null
          _address?: string | null
          _confirm_new?: boolean
        }
        Returns: Json
      }
      merge_patients: {
        Args: {
          _keep_id: string
          _merge_id: string
          _reason: string
        }
        Returns: undefined
      }
      verify_portal_link: {
        Args: {
          _link_id: string
        }
        Returns: undefined
      }
      log_patient_view: {
        Args: {
          _patient_id: string
        }
        Returns: undefined
      }
      list_bookable_providers: {
        Args: Record<PropertyKey, never>
        Returns: {
          provider_id: string
          practice_id: string
          practice_name: string
          country: Database["public"]["Enums"]["country_code"]
          currency: Database["public"]["Enums"]["currency_code"]
          timezone: string
          display_name: string
          specialization: string | null
          consultation_fee: number | null
          telehealth_enabled: boolean | null
        }[]
      }
      provider_booked_slots: {
        Args: {
          _provider_id: string
          _from: string
          _to: string
        }
        Returns: string[]
      }
      book_appointment: {
        Args: {
          _provider_id: string
          _starts_at: string
          _reason: string
        }
        Returns: string
      }
      cancel_my_appointment: {
        Args: {
          _appointment_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "doctor" | "patient"
      country_code: "BW" | "ZA"
      currency_code: "BWP" | "ZAR"
      national_id_type: "omang" | "sa_id" | "passport" | "other" | "none"
      patient_source: "staff" | "portal" | "import"
      patient_status: "active" | "merged"
      portal_link_status: "pending" | "verified"
      practice_role: "owner" | "manager" | "receptionist" | "nurse" | "clinician" | "biller"
      registration_council: "HPCSA" | "BHPC"
      verification_status: "not_submitted" | "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "doctor", "patient"],
      country_code: ["BW", "ZA"],
      currency_code: ["BWP", "ZAR"],
      national_id_type: ["omang", "sa_id", "passport", "other", "none"],
      patient_source: ["staff", "portal", "import"],
      patient_status: ["active", "merged"],
      portal_link_status: ["pending", "verified"],
      practice_role: ["owner", "manager", "receptionist", "nurse", "clinician", "biller"],
      registration_council: ["HPCSA", "BHPC"],
      verification_status: ["not_submitted", "pending", "approved", "rejected"],
    },
  },
} as const
