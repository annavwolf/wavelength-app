// Database row types for Wavelength.
// Mirrors the Supabase schema exactly — keep in sync with migrations.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VirtualityLevel = "fully_remote" | "hybrid" | "mostly_in_person";
export type Zone = 1 | 2 | 3;
// 5-point agreement scale (replaces the old 3-point green/yellow/red set).
// Stored literally in ps_responses.label; response_value is the unflipped
// 1–5 mapping (see LABEL_VALUE in PsDiagnosticStep). Reverse-scoring is
// applied at READ time only — never flip on write.
export type PsLabel =
  | "strongly_disagree"
  | "disagree"
  | "neutral"
  | "agree"
  | "strongly_agree";
export type CoordinationFrequency =
  | "daily"
  | "weekly"
  | "occasionally"
  | "rarely";
export type SeverityLabel = 1 | 2 | 3 | 4;

export type Team = {
  team_id: string;
  consultant_id: string;
  team_name: string;
  industry: string | null;
  virtuality_level: VirtualityLevel | null;
  timezones: string | null;
  roster_size: number | null;
  known_sensitivities: string | null;
  selected_fish_ids: string[];
  status: string;
  created_at: string;
}

export type TeamInsert = {
  team_id?: string;
  consultant_id?: string;
  team_name: string;
  industry?: string | null;
  virtuality_level?: VirtualityLevel | null;
  timezones?: string | null;
  roster_size?: number | null;
  known_sensitivities?: string | null;
  selected_fish_ids?: string[];
  status?: string;
  created_at?: string;
}

export type TeamUpdate = Partial<TeamInsert>;

export type Member = {
  member_id: string;
  team_id: string;
  private_code: string;
  display_name: string;
  email: string | null;
  role: string | null;
  location: string | null;
  timezone: string | null;
  tenure_months: number | null;
  is_point_person: boolean;
  share_verbatim_with_team: boolean;
  share_name_with_team: boolean;
  status: string;
  // Optional member-volunteered context collected in the interview.
  primary_language: string | null;
  personal_context: string | null;
  // Optional demographics — all voluntary, never shared individually.
  gender_identity: string | null;
  ethnicity_cultural: string | null;
  age: string | null;
  // When the member joined this team (free text, e.g. "January 2024").
  tenure_start: string | null;
  invited_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type MemberInsert = {
  member_id?: string;
  team_id: string;
  private_code: string;
  display_name: string;
  email?: string | null;
  role?: string | null;
  location?: string | null;
  timezone?: string | null;
  tenure_months?: number | null;
  is_point_person?: boolean;
  share_verbatim_with_team?: boolean;
  share_name_with_team?: boolean;
  status?: string;
  primary_language?: string | null;
  personal_context?: string | null;
  gender_identity?: string | null;
  ethnicity_cultural?: string | null;
  age?: string | null;
  tenure_start?: string | null;
  invited_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
}

export type MemberUpdate = Partial<MemberInsert>;

export type Fish = {
  fish_id: string;
  team_id: string | null;
  name: string;
  description: string | null;
  behavioural_examples: string | null;
  more_of: string | null;
  less_of: string | null;
  maps_to_zone: Zone;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export type FishInsert = {
  fish_id?: string;
  team_id?: string | null;
  name: string;
  description?: string | null;
  behavioural_examples?: string | null;
  more_of?: string | null;
  less_of?: string | null;
  maps_to_zone: Zone;
  is_default?: boolean;
  sort_order?: number;
  created_at?: string;
}

export type FishUpdate = Partial<FishInsert>;

export type PsStatement = {
  statement_id: number; // 1-12
  zone: Zone;
  zone_name: string;
  statement_text: string;
  construct: string | null;
  // True for items phrased negatively (e.g. #3). Effective score is
  // computed at read time as (6 - response_value) when this is true —
  // used by item selection and Phase 2. Never flipped on write.
  reverse_scored: boolean;
}

export type PsStatementInsert = {
  statement_id: number;
  zone: Zone;
  zone_name: string;
  statement_text: string;
  construct?: string | null;
  reverse_scored?: boolean;
}

export type PsStatementUpdate = Partial<PsStatementInsert>;

export type PsResponse = {
  id: string;
  member_id: string;
  team_id: string;
  statement_id: number;
  zone: Zone;
  label: PsLabel;
  // 5-point scale, unflipped: strongly_disagree=1, disagree=2, neutral=3,
  // agree=4, strongly_agree=5. Stored as the literal click; reverse-scored
  // items are flipped only at read time (effective = 6 - response_value).
  response_value: number;
  round: number;
  created_at: string;
}

export type PsResponseInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  statement_id: number;
  zone: Zone;
  label: PsLabel;
  response_value: number;
  round?: number;
  created_at?: string;
}

export type PsResponseUpdate = Partial<PsResponseInsert>;

// Whether the member agreed with Otis's zone-level reflection
// (ps_reflect step) — surfaced to the consultant later.
export type PsReflectionCheck = {
  id: string;
  team_id: string;
  member_id: string;
  matches_reflection: boolean;
  created_at: string;
}

export type PsReflectionCheckInsert = {
  id?: string;
  team_id: string;
  member_id: string;
  matches_reflection: boolean;
  created_at?: string;
}

export type PsReflectionCheckUpdate = Partial<PsReflectionCheckInsert>;

export type PurposeResponse = {
  id: string;
  member_id: string;
  team_id: string;
  purpose_text: string;
  created_at: string;
}

export type PurposeResponseInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  purpose_text: string;
  created_at?: string;
}

export type PurposeResponseUpdate = Partial<PurposeResponseInsert>;

// Note: there is no target_member_id column on the live table — only the
// target's name is stored. Code that needs to track *which* member a rating
// belongs to (e.g. to avoid duplicate inserts) must do so client-side only.
export type CoordinationRating = {
  id: string;
  member_id: string;
  team_id: string;
  target_member_name: string;
  frequency: CoordinationFrequency;
  created_at: string;
}

export type CoordinationRatingInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  target_member_name: string;
  frequency: CoordinationFrequency;
  created_at?: string;
}

export type CoordinationRatingUpdate = Partial<CoordinationRatingInsert>;

export type MissingMemberFlag = {
  id: string;
  team_id: string;
  reported_by_member_id: string;
  missing_name: string;
  missing_role: string | null;
  created_at: string;
}

export type MissingMemberFlagInsert = {
  id?: string;
  team_id: string;
  reported_by_member_id: string;
  missing_name: string;
  missing_role?: string | null;
  created_at?: string;
}

export type MissingMemberFlagUpdate = Partial<MissingMemberFlagInsert>;

// Custom question typed by a member during the FAQ step.
export type MemberQuestion = {
  id: string;
  member_id: string;
  team_id: string;
  question_text: string;
  created_at: string;
}

export type MemberQuestionInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  question_text: string;
  created_at?: string;
}

export type MemberQuestionUpdate = Partial<MemberQuestionInsert>;

export type FishResponse = {
  id: string;
  member_id: string;
  team_id: string;
  fish_id: string | null;
  custom_text: string | null;
  severity_label: SeverityLabel;
  created_at: string;
}

export type FishResponseInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  fish_id?: string | null;
  custom_text?: string | null;
  severity_label: SeverityLabel;
  created_at?: string;
}

export type FishResponseUpdate = Partial<FishResponseInsert>;

// One row per member per probed item, produced by the adaptive ps_interview
// step. The four *_text fields are the distilled buckets Phase 2 codes;
// member_response_label is the member's literal 5-point rating on the item
// (never reverse-flipped). is_all_positive_branch marks rows produced by the
// Section 5 reframed script rather than a negative-score probe.
export type PsInterviewResponse = {
  id: string;
  member_id: string;
  team_id: string;
  statement_id: number;
  member_response_label: PsLabel | null;
  situation_text: string | null;
  out_behavior_text: string | null;
  outcome_text: string | null;
  in_behavior_text: string | null;
  is_all_positive_branch: boolean;
  created_at: string;
  updated_at: string;
}

export type PsInterviewResponseInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  statement_id: number;
  member_response_label?: PsLabel | null;
  situation_text?: string | null;
  out_behavior_text?: string | null;
  outcome_text?: string | null;
  in_behavior_text?: string | null;
  is_all_positive_branch?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type PsInterviewResponseUpdate = Partial<PsInterviewResponseInsert>;

export type Analysis = {
  id: string;
  team_id: string;
  tier1_json: Json | null;
  tier2_json: Json | null;
  assumptions: string | null;
  focus_issue: string | null;
  inout_plan: string | null;
  deferred_for_later: string | null;
  focus_questions: string | null;
  consultant_approved: boolean;
  team_facing_report: string | null;
  report_highlights: string | null;
  integrated_picture: string | null;
  draft_code_of_conduct: string | null;
  leadership_report: string | null;
  leaders_play: string | null;
  report_approved: boolean;
  updated_at: string;
}

export type AnalysisInsert = {
  id?: string;
  team_id: string;
  tier1_json?: Json | null;
  tier2_json?: Json | null;
  assumptions?: string | null;
  focus_issue?: string | null;
  inout_plan?: string | null;
  deferred_for_later?: string | null;
  focus_questions?: string | null;
  consultant_approved?: boolean;
  team_facing_report?: string | null;
  report_highlights?: string | null;
  integrated_picture?: string | null;
  draft_code_of_conduct?: string | null;
  leadership_report?: string | null;
  leaders_play?: string | null;
  report_approved?: boolean;
  updated_at?: string;
}

export type AnalysisUpdate = Partial<AnalysisInsert>;

export type FeedbackResponse = {
  id: string;
  member_id: string;
  team_id: string;
  assumption_resonance: string | null;
  assumption_notes: string | null;
  discussed_before: boolean | null;
  discussed_before_notes: string | null;
  more_of: string[];
  less_of: string[];
  created_at: string;
}

export type FeedbackResponseInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  assumption_resonance?: string | null;
  assumption_notes?: string | null;
  discussed_before?: boolean | null;
  discussed_before_notes?: string | null;
  more_of?: string[];
  less_of?: string[];
  created_at?: string;
}

export type FeedbackResponseUpdate = Partial<FeedbackResponseInsert>;

export type CodeOfConduct = {
  id: string;
  team_id: string;
  version: number;
  agreements: string | null;
  focus_zone: Zone | null;
  agreed_at: string | null;
  is_current: boolean;
  created_at: string;
}

export type CodeOfConductInsert = {
  id?: string;
  team_id: string;
  version?: number;
  agreements?: string | null;
  focus_zone?: Zone | null;
  agreed_at?: string | null;
  is_current?: boolean;
  created_at?: string;
}

export type CodeOfConductUpdate = Partial<CodeOfConductInsert>;

export type Followup = {
  id: string;
  team_id: string;
  scheduled_for: string;
  round: number;
  baseline_summary: string | null;
  retest_summary: string | null;
  movement_narrative: string | null;
  created_at: string;
}

export type FollowupInsert = {
  id?: string;
  team_id: string;
  scheduled_for: string;
  round?: number;
  baseline_summary?: string | null;
  retest_summary?: string | null;
  movement_narrative?: string | null;
  created_at?: string;
}

export type FollowupUpdate = Partial<FollowupInsert>;

// Consultants (the logged-in user). teams.consultant_id has a foreign key
// into this table, so a row here must exist before a consultant can create
// their first team — see the upsert in app/teams/new/page.tsx.
export type Consultant = {
  consultant_id: string;
  email: string | null;
  name: string | null;
  created_at: string;
}

export type ConsultantInsert = {
  consultant_id: string;
  email?: string | null;
  name?: string | null;
  created_at?: string;
}

export type ConsultantUpdate = Partial<ConsultantInsert>;

// Backs passwordless member magic-link login (Stage A). Keyed to email (not a
// single member) so the multi-team chooser can resolve after verify. Only the
// SHA-256 hash of the token is ever stored — never the raw token.
export type MemberLoginToken = {
  id: string;
  email: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export type MemberLoginTokenInsert = {
  id?: string;
  email: string;
  token_hash: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
}

export type MemberLoginTokenUpdate = Partial<MemberLoginTokenInsert>;

export type Database = {
  public: {
    Tables: {
      consultants: {
        Row: Consultant;
        Insert: ConsultantInsert;
        Update: ConsultantUpdate;
        Relationships: [];
      };
      teams: {
        Row: Team;
        Insert: TeamInsert;
        Update: TeamUpdate;
        Relationships: [];
      };
      members: {
        Row: Member;
        Insert: MemberInsert;
        Update: MemberUpdate;
        Relationships: [];
      };
      member_login_tokens: {
        Row: MemberLoginToken;
        Insert: MemberLoginTokenInsert;
        Update: MemberLoginTokenUpdate;
        Relationships: [];
      };
      fish: {
        Row: Fish;
        Insert: FishInsert;
        Update: FishUpdate;
        Relationships: [];
      };
      ps_statements: {
        Row: PsStatement;
        Insert: PsStatementInsert;
        Update: PsStatementUpdate;
        Relationships: [];
      };
      ps_responses: {
        Row: PsResponse;
        Insert: PsResponseInsert;
        Update: PsResponseUpdate;
        Relationships: [];
      };
      ps_reflection_checks: {
        Row: PsReflectionCheck;
        Insert: PsReflectionCheckInsert;
        Update: PsReflectionCheckUpdate;
        Relationships: [];
      };
      member_questions: {
        Row: MemberQuestion;
        Insert: MemberQuestionInsert;
        Update: MemberQuestionUpdate;
        Relationships: [];
      };
      purpose_responses: {
        Row: PurposeResponse;
        Insert: PurposeResponseInsert;
        Update: PurposeResponseUpdate;
        Relationships: [];
      };
      coordination_ratings: {
        Row: CoordinationRating;
        Insert: CoordinationRatingInsert;
        Update: CoordinationRatingUpdate;
        Relationships: [];
      };
      missing_member_flags: {
        Row: MissingMemberFlag;
        Insert: MissingMemberFlagInsert;
        Update: MissingMemberFlagUpdate;
        Relationships: [];
      };
      fish_responses: {
        Row: FishResponse;
        Insert: FishResponseInsert;
        Update: FishResponseUpdate;
        Relationships: [];
      };
      ps_interview_responses: {
        Row: PsInterviewResponse;
        Insert: PsInterviewResponseInsert;
        Update: PsInterviewResponseUpdate;
        Relationships: [];
      };
      analysis: {
        Row: Analysis;
        Insert: AnalysisInsert;
        Update: AnalysisUpdate;
        Relationships: [];
      };
      feedback_responses: {
        Row: FeedbackResponse;
        Insert: FeedbackResponseInsert;
        Update: FeedbackResponseUpdate;
        Relationships: [];
      };
      code_of_conduct: {
        Row: CodeOfConduct;
        Insert: CodeOfConductInsert;
        Update: CodeOfConductUpdate;
        Relationships: [];
      };
      followups: {
        Row: Followup;
        Insert: FollowupInsert;
        Update: FollowupUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
