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

// Identity table — email and display_name live here after migration 0020.
// Only the service-role client can access this; RLS is enabled with no policies.
export type MemberIdentity = {
  member_id: string;
  team_id: string;
  email: string | null;
  display_name: string;
}

export type MemberIdentityInsert = {
  member_id: string;
  team_id: string;
  email?: string | null;
  display_name: string;
}

// Combined shape returned by the /api/teams/[team_id]/members roster route —
// merges Member (response data) with MemberIdentity (identity data).
export type MemberWithIdentity = Member & {
  display_name: string;
  email: string | null;
  privacy_acknowledged_at?: string | null;
  privacy_notice_version?: string | null;
  // This is true only when the record matches the currently active notice.
  // Consultants can use it to follow up without seeing a participant's
  // exact-word or voice-input choices.
  privacy_acknowledged_currently?: boolean;
  verbatim_preference?: "summary_only" | "verbatim" | null;
  identity_name_missing?: boolean;
};

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
  beta_participation_ended_at: string | null;
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
  beta_participation_ended_at?: string | null;
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
  // Phase 3 has two independent confidentiality checks (migration 0017):
  // one for the stories they told, one for the behaviors they contributed.
  // Both default true (opt-in verbatim + name).
  phase3_story_verbatim: boolean;
  phase3_behavior_verbatim: boolean;
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
  // Optional interview free-text (migration 0016). Consultant-facing only,
  // never shown to other members. own_role: how the member describes their own
  // role; ps_importance: their take on whether PS matters for the team;
  // team_name_suggestion: a name the member proposes for the team.
  own_role: string | null;
  ps_importance: string | null;
  team_name_suggestion: string | null;
  // The next Phase 1 screen to restore after an interruption. This is stored
  // separately from completion and the privacy acknowledgement.
  phase1_resume_step: string | null;
  phase1_return_to_review: boolean;
  invited_at: string | null;
  completed_at: string | null;
  // Set when the member submits the Results & Team Agreement Activity (migration
  // 0018). NULL = not finished. Distinct from status/completed_at (Phase 1).
  phase3_completed_at: string | null;
  created_at: string;
}

export type MemberInsert = {
  member_id?: string;
  team_id: string;
  private_code: string;
  // display_name and email are omitted on insert post-migration 0020 —
  // they are stored in member_identity instead. Optional here to allow both
  // the old direct-insert path (expand window) and the new identity-split path.
  display_name?: string | null;
  email?: string | null;
  role?: string | null;
  location?: string | null;
  timezone?: string | null;
  tenure_months?: number | null;
  is_point_person?: boolean;
  share_verbatim_with_team?: boolean;
  share_name_with_team?: boolean;
  phase3_story_verbatim?: boolean;
  phase3_behavior_verbatim?: boolean;
  status?: string;
  primary_language?: string | null;
  personal_context?: string | null;
  gender_identity?: string | null;
  ethnicity_cultural?: string | null;
  age?: string | null;
  tenure_start?: string | null;
  own_role?: string | null;
  ps_importance?: string | null;
  team_name_suggestion?: string | null;
  phase1_resume_step?: string | null;
  phase1_return_to_review?: boolean;
  invited_at?: string | null;
  completed_at?: string | null;
  phase3_completed_at?: string | null;
  created_at?: string;
}

export type MemberUpdate = Partial<MemberInsert>;

export type MemberPrivacyAcknowledgement = {
  member_id: string;
  team_id: string;
  privacy_notice_version: string;
  acknowledged_at: string;
  verbatim_preference: "summary_only" | "verbatim";
  preference_updated_at: string;
  voice_input_opt_in: boolean;
  voice_input_opted_in_at: string | null;
}

export type MemberPrivacyAcknowledgementInsert = {
  member_id: string;
  team_id: string;
  privacy_notice_version: string;
  acknowledged_at?: string;
  verbatim_preference: "summary_only" | "verbatim";
  preference_updated_at?: string;
  voice_input_opt_in?: boolean;
  voice_input_opted_in_at?: string | null;
}

export type MemberWithdrawal = {
  id: string;
  member_id: string;
  team_id: string;
  scope: string;
  requested_at: string;
  report_was_generated: boolean;
}

export type MemberWithdrawalInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  scope: string;
  requested_at?: string;
  report_was_generated?: boolean;
}

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

// `target_member_id` was added in migration 0024. `target_member_name` remains
// for legacy rows and transitional reporting, but new writes should use the id.
export type CoordinationRating = {
  id: string;
  member_id: string;
  team_id: string;
  target_member_id: string | null;
  target_member_name: string;
  frequency: CoordinationFrequency;
  created_at: string;
}

export type CoordinationRatingInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  target_member_id?: string | null;
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

// Stored in analysis.phase3_report_json (migration 0012).
// The consultant edits these fields before releasing Phase 3 links to members.
// One ranked focus candidate Otis proposes (top 2-3). `why` is the one-line
// justification the consultant sees (and can optionally surface to members).
export type FocusCandidate = {
  statement_id: number;
  statement_text: string;
  zone: number;
  why: string;
};

export type Phase3ReportJson = {
  // Provenance is optional for legacy JSON. Routes treat an absent or
  // mismatched marker as stale and require a fresh compute/read before release.
  privacy_notice_version?: string;
  source_tier1_computed_at?: string;
  ps_read_overall: string;
  ps_read_zone1: string;
  ps_read_zone2: string;
  ps_read_zone3: string;
  shared_purpose_read: string;
  focus_statement_id: number | null;
  focus_narrative: string;
  // Deprecated (workshop intro script removed from the release editor); kept for
  // back-compat with older saved reports.
  workshop_intro: string;
  // Ranked focus picks captured from Otis's read at report time (top 2-3).
  focus_candidates?: FocusCandidate[];
  // Release toggles (Report & Activity Release):
  //   include_shared_purpose — show the shared-purpose results section to members
  //   include_stories        — include the Team Stories section
  //   include_rationalization_in_report — surface the focus "why" to members
  include_shared_purpose?: boolean;
  include_stories?: boolean;
  include_rationalization_in_report?: boolean;
  released_at: string | null;
  sent_member_ids: string[];
};

export type Analysis = {
  id: string;
  team_id: string;
  tier1_json: Json | null;
  tier2_json: Json | null;
  phase3_report_json: Json | null;
  phase4_selfserve_json: Json | null;
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
  phase3_report_json?: Json | null;
  phase4_selfserve_json?: Json | null;
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

// ── Phase 3 §2.5: Per-zone pulse checks ──────────────────────────────────────
export type PulseCheckRating =
  | "Not at all accurate"
  | "Somewhat accurate"
  | "Very accurate"
  | "Don't know"
  | "Decline to answer";

export type PulseCheckKey = "zone1" | "zone2" | "zone3" | "purpose";

export type PulseCheck = {
  id: string;
  member_id: string;
  team_id: string;
  read_key: PulseCheckKey;
  accuracy_rating: PulseCheckRating;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type PulseCheckInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  read_key: PulseCheckKey;
  accuracy_rating: PulseCheckRating;
  comment?: string | null;
  updated_at?: string;
};

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

// ── Phase 4: Live Workshop ──────────────────────────────────────────────────
// Spec: Otis_Build_Handover_v1/Otis_Phase4_Workshop_Spec_v1.md.
// Design principle: Otis prepares and scribes; the facilitator conducts; the
// team decides. Everything is submit-then-display; the only live mechanic is the
// phase broadcast below. No real-time collaborative editing.

// Broadcast phase. 'setup' = room not opened. The five movements are orient →
// pairs → whole_team → reinforcement → agreement; 'closed' once locked.
export type WorkshopPhase =
  | "setup" | "orient" | "pairs" | "whole_team" | "reinforcement" | "agreement" | "closed";

// A chosen behaviour plus the observability line ("we'd know because someone
// would see or hear…") written by the pair in M2 and carried into M5.
export type BehaviourItem = { behaviour: string; observability: string };

// The focus frame shown in M1, pre-filled from the analysis focus hypothesis.
export type FocusFrame = {
  item: string;         // the PS statement in focus
  objective: string;    // the situation objective ("when we want to …")
  context: string;      // the situation context ("during …")
  why: string;          // one line of why this surfaced
  zone: Zone | null;
};

// M4 capture sheet — the facilitator types; the team corrects live.
export type CaptureSheet = {
  when_someone_slips?: string;
  check_trigger?: string;
  when_done_well?: string;
  anything_else?: string;
};

export type WorkshopSession = {
  id: string;
  team_id: string;
  phase: WorkshopPhase;
  focus_frame: FocusFrame | null;
  pairs: string[][] | null;
  selected_always: BehaviourItem[];
  selected_never: BehaviourItem[];
  capture_sheet: CaptureSheet;
  revisit_date: string | null;
  started_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkshopSessionInsert = {
  id?: string;
  team_id: string;
  phase?: WorkshopPhase;
  focus_frame?: FocusFrame | null;
  pairs?: string[][] | null;
  selected_always?: BehaviourItem[];
  selected_never?: BehaviourItem[];
  capture_sheet?: CaptureSheet;
  revisit_date?: string | null;
  started_at?: string | null;
  locked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type WorkshopSessionUpdate = Partial<WorkshopSessionInsert>;

export type PairSubmission = {
  id: string;
  session_id: string;
  team_id: string;
  pair_index: number;
  member_ids: string[];
  always_items: BehaviourItem[];
  never_items: BehaviourItem[];
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PairSubmissionInsert = {
  id?: string;
  session_id: string;
  team_id: string;
  pair_index: number;
  member_ids?: string[];
  always_items?: BehaviourItem[];
  never_items?: BehaviourItem[];
  submitted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PairSubmissionUpdate = Partial<PairSubmissionInsert>;

export type WorkshopVote = {
  id: string;
  session_id: string;
  team_id: string;
  member_id: string;
  kind: "always" | "never";
  behaviour: string;
  round: number;
  created_at: string;
}

export type WorkshopVoteInsert = {
  id?: string;
  session_id: string;
  team_id: string;
  member_id: string;
  kind: "always" | "never";
  behaviour: string;
  round?: number;
  created_at?: string;
}

export type WorkshopVoteUpdate = Partial<WorkshopVoteInsert>;

// ── Phase 3 storage (migration 0011) ────────────────────────────────────────

export type SituationTag = "meeting" | "async_chat" | "email" | "document" | "project_task" | "other";

export type MemberStory = {
  id: string;
  member_id: string;
  team_id: string;
  statement_id: number | null;
  story_text: string;
  story_order: number;
  situation_tag: SituationTag | null;
  created_at: string;
  updated_at: string;
};

export type MemberStoryInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  statement_id?: number | null;
  story_text: string;
  story_order?: number;
  situation_tag?: SituationTag | null;
  created_at?: string;
  updated_at?: string;
};

export type BehaviorBucket = "never" | "sometimes" | "always";
export type BehaviorSource = "member" | "consultant";

export type MemberBehavior = {
  id: string;
  member_id: string;
  team_id: string;
  statement_id: number | null;
  bucket: BehaviorBucket;
  text: string;
  source: BehaviorSource;
  flagged: boolean;
  // Persisted coaching warning (migration 0017). Non-null = Otis is asking the
  // member to make this entry more specific; cleared once they resolve it.
  nudge_text: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberBehaviorInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  statement_id?: number | null;
  bucket: BehaviorBucket;
  text: string;
  source?: BehaviorSource;
  flagged?: boolean;
  nudge_text?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MemberBehaviorUpdate = Partial<MemberBehaviorInsert>;

// ── Phase 4 self-serve: new Phase 3 questions (spec §1, migration 0015) ──────

export type ContextFrequency =
  | "Several times a day"
  | "Several times a week"
  | "Several times a month"
  | "Several times a year";

export type ContextCommitment = "Yes" | "It depends" | "I don't think so";

export type ContextSynchronicity =
  | "Easily, we do it regularly"
  | "Pretty easily, we do it occasionally"
  | "Not so easy, we do it sometimes"
  | "Difficult, we rarely meet all together"
  | "It's easier with some people but not others";

export type Phase3ContextResponse = {
  id: string;
  member_id: string;
  team_id: string;
  impact_text: string | null;
  frequency: ContextFrequency | null;
  commitment: ContextCommitment | null;
  commitment_comment: string | null;
  // "What do you think the result would be?" — free text after the 30-day
  // commitment question (migration 0017).
  commitment_result: string | null;
  synchronicity: ContextSynchronicity | null;
  created_at: string;
  updated_at: string;
};

export type Phase3ContextResponseInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  impact_text?: string | null;
  frequency?: ContextFrequency | null;
  commitment?: ContextCommitment | null;
  commitment_comment?: string | null;
  commitment_result?: string | null;
  synchronicity?: ContextSynchronicity | null;
  created_at?: string;
  updated_at?: string;
};

export type Phase3ContextResponseUpdate = Partial<Phase3ContextResponseInsert>;

// ── Phase 3 durable chat transcripts (migration 0017) ────────────────────────
// One row per member/team/kind. Lets members leave and resume the story chat
// and the impact chat exactly where they left off.
export type Phase3ConversationKind = "story" | "impact";

export type Phase3ConversationMessage = {
  id: string;
  member_id: string;
  team_id: string;
  kind: Phase3ConversationKind;
  messages: Json;
  state: Json | null;
  created_at: string;
  updated_at: string;
};

export type Phase3ConversationMessageInsert = {
  id?: string;
  member_id: string;
  team_id: string;
  kind: Phase3ConversationKind;
  messages?: Json;
  state?: Json | null;
  created_at?: string;
  updated_at?: string;
};

// ── Phase 4 self-serve: generated output (spec §6/§7, analysis.phase4_selfserve_json) ──
// The consultant edits the exit-interview text before releasing. Everything a
// member sees (agreement, script, roadmap) plus the per-team filled artifacts.

export type Phase4ClarityState = "clear" | "mixed" | "unclear";

// One grouped behaviour on the board — member links removed, convergence count kept.
// SubmissionClassification is the per-submission record produced by the two-pass
// bucket classifier (lib/behaviourClassification.ts). Stored inside each
// Phase4BehaviourGroup (contributing_submissions) and in the unbucketed panel.
export type SubmissionClassification = {
  submission_id: string;
  text: string;
  valence: BehaviorBucket;
  // The consultant-facing JSON never contains a roster-linked member id. This
  // flag is enough for the UI to decide whether an exact excerpt may be shown.
  verbatim_allowed?: boolean;
  member_id: string;
  pass1_bucket_id: string | null;
  pass1_confidence: "high" | "medium" | "low";
  pass1_reason: string;
  final_bucket_id: string | null;
  pass2_action: "confirmed" | "moved" | "demoted" | "rescued";
  pass2_reason: string;
};

export type Phase4BehaviourGroup = {
  name: string;               // bucket label (§4.8 authored phrasing)
  representative: string;     // same as name; kept for backward compat
  bucket: BehaviorBucket;     // dominant bucket valence
  member_count: number;       // distinct members (convergence)
  never_members: number;
  sometimes_members: number;
  always_members: number;
  bucket_split: boolean;      // members placed submissions in different valences
  contributing_submissions?: SubmissionClassification[]; // consultant-only
};

export type Phase4Distribution = {
  counts: Record<string, number>;
  summary: string;
};

export type Phase4Agreement = {
  ps_item: string;            // focus item text
  situations: string[];       // max 2
  always: string[];           // top 2-3 representative behaviours
  never: string[];            // top 2-3 representative behaviours
};

export type Phase4Clarity = {
  state: Phase4ClarityState;
  message: string;            // what Otis tells the team
  split_behaviours: string[]; // specific behaviours that split buckets
  scattered_situations: boolean;
};

// A per-team filled artifact (content is markdown; wording locked, fields filled).
export type Phase4Artifact = {
  slug: "game_plan" | "meeting_agenda" | "check_in";
  title: string;
  content: string;            // filled markdown
};

export type Phase4SelfServeJson = {
  // Provenance is optional for legacy JSON. Routes treat an absent or
  // mismatched marker as stale and require a fresh compute before release.
  privacy_notice_version?: string;
  source_tier1_computed_at?: string;
  behaviour_board: Phase4BehaviourGroup[];
  agreement: Phase4Agreement;
  clarity: Phase4Clarity;
  commitment_distribution: Phase4Distribution;
  touchpoint_distribution: Phase4Distribution;
  low_commitment_note: string | null;   // consultant-only
  touchpoint_note: string | null;        // consultant-only (timezone realism)
  roadmap: string;                       // recommendation text
  // Editable exit-interview text (member-facing). Otis originals preserved.
  agreement_text: string;                // rendered agreement sentence
  what_to_do_next: string;               // §6.2 script
  closing_note: string;                  // §6.5
  otis_original: {
    agreement_text: string;
    what_to_do_next: string;
    closing_note: string;
  };
  // Async tailoring flag (§7.1) derived from synchronicity answers.
  async_skew: boolean;
  // Two-pass classification outputs (§2.6 / §2.7).
  unbucketed_submissions?: SubmissionClassification[]; // submissions that didn't fit any bucket
  // Roadmap visibility toggle (consultant controls whether members see the roadmap text).
  roadmap_shown_to_members?: boolean;
  artifacts: Phase4Artifact[];           // filled at release time
  released_at: string | null;
  sent_member_ids: string[];
};

// ── Phase 3 §3.5: Consultant pre-release review (D-052) ─────────────────────
// The "approved workshop seed" — the consultant-reviewed focus item, situation,
// and behaviour set the member sort (§4.2) reads instead of raw tier2_json.

export type SeedProvenance = "otis" | "member" | "consultant";

// Anonymised source label stored with each workshop-form behaviour for the
// expander in PreworkReview. member_id is present for consultant-only view
// but is rendered as "Member A / B / …" in the UI, never shown raw.
export type SeedSourceLabel = {
  secondary_label: string;
  member_id: string;
  statement_id: number;
  sensitive_specific?: boolean;
};

export type SeedBehaviour = {
  id: string;
  text: string;
  kind: "never" | "always";
  provenance: SeedProvenance;
  // Set when pulled from the cross-item library — the item it came from.
  source_statement_id: number | null;
  // Otis's original wording, preserved when a consultant edits (D-052).
  original_text: string | null;
  // Raw cluster source labels — shown in the "see specific incidents" expander.
  // Absent on old rows and on consultant-added items (provenance === "consultant").
  source_labels?: SeedSourceLabel[];
};

export type WorkshopSeed = {
  id: string;
  team_id: string;
  statement_id: number | null;
  zone: number | null;
  objective: string | null;
  context: string | null;
  focus_hypothesis: string | null;
  behaviours: SeedBehaviour[];
  version: number;
  is_current: boolean;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkshopSeedInsert = {
  id?: string;
  team_id: string;
  statement_id?: number | null;
  zone?: number | null;
  objective?: string | null;
  context?: string | null;
  focus_hypothesis?: string | null;
  behaviours?: SeedBehaviour[];
  version?: number;
  is_current?: boolean;
  released_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type WorkshopSeedUpdate = Partial<WorkshopSeedInsert>;

// Consultants (the logged-in user). teams.consultant_id has a foreign key
// into this table, so a row here must exist before a consultant can create
// their first team — see the upsert in app/teams/new/page.tsx.
export type Consultant = {
  consultant_id: string;
  email: string | null;
  name: string | null;
  // The entitlement is granted after an authenticated consultant redeems a
  // server-validated early-access code (migration 0027), never by the client.
  early_access_granted_at: string | null;
  early_access_grant_source: "code" | "manual" | null;
  created_at: string;
}

export type ConsultantInsert = {
  consultant_id: string;
  email?: string | null;
  name?: string | null;
  early_access_granted_at?: string | null;
  early_access_grant_source?: "code" | "manual" | null;
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

// Short-lived, opaque counters for passwordless member sign-in abuse control.
// key_hash is an HMAC generated server-side from an email and optionally a
// client address; this table intentionally never stores either raw value.
export type MemberLoginRequestRateWindow = {
  scope: "combination_15m" | "email_1h";
  key_hash: string;
  window_started_at: string;
  request_count: number;
  created_at: string;
  updated_at: string;
};

export type MemberLoginRequestRateWindowInsert = {
  scope: "combination_15m" | "email_1h";
  key_hash: string;
  window_started_at: string;
  request_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type MemberLoginRequestRateWindowUpdate =
  Partial<MemberLoginRequestRateWindowInsert>;

// A long-lived, revocable capability for one participant's Phase 1 interview.
// Like member_login_tokens, the database contains only a SHA-256 hash; the raw
// bearer token exists only in the invite URL and is never returned by an API.
export type MemberInterviewToken = {
  id: string;
  member_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type MemberInterviewTokenInsert = {
  id?: string;
  member_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_at?: string;
};

export type MemberInterviewTokenUpdate = Partial<MemberInterviewTokenInsert>;

// Short-lived operational counters for the optional hosted-audio service.
// This intentionally carries no recording, transcript, or spoken text.
export type MemberAudioUsageWindow = {
  member_id: string;
  window_started_at: string;
  synthesis_requests: number;
  synthesis_characters: number;
  transcription_requests: number;
  transcription_duration_ms: number;
  transcription_bytes: number;
  created_at: string;
};

export type MemberAudioUsageWindowInsert = {
  member_id: string;
  window_started_at: string;
  synthesis_requests?: number;
  synthesis_characters?: number;
  transcription_requests?: number;
  transcription_duration_ms?: number;
  transcription_bytes?: number;
  created_at?: string;
};

export type MemberAudioUsageWindowUpdate = Partial<MemberAudioUsageWindowInsert>;

// One coded label from the Phase 2 coding pass (Coding Spec §4). Input to
// clustering; carries member_id + statement_id so clustering can count member
// convergence and stay item-anchored. Embeddings are computed in-request, not
// stored here.
export type PrimaryCode = "situation" | "out_behavior" | "outcome" | "in_behavior";
export type LabelSubType = "context" | "objective";
export type SourceField =
  | "situation_text"
  | "out_behavior_text"
  | "outcome_text"
  | "in_behavior_text";

export type InterviewLabel = {
  id: string;
  team_id: string;
  member_id: string;
  statement_id: number;
  primary_code: PrimaryCode;
  secondary_label: string;
  sub_type: LabelSubType | null;
  multi_member_flag: boolean;
  source_field: SourceField | null;
  sensitive_specific: boolean;
  created_at: string;
}

export type InterviewLabelInsert = {
  id?: string;
  team_id: string;
  member_id: string;
  statement_id: number;
  primary_code: PrimaryCode;
  secondary_label: string;
  sub_type?: LabelSubType | null;
  multi_member_flag?: boolean;
  source_field?: SourceField | null;
  sensitive_specific?: boolean;
  created_at?: string;
}

export type InterviewLabelUpdate = Partial<InterviewLabelInsert>;

export type Database = {
  public: {
    Tables: {
      member_identity: {
        Row: MemberIdentity;
        Insert: MemberIdentityInsert;
        Update: Partial<MemberIdentityInsert>;
        Relationships: [];
      };
      identity_lookup_log: {
        Row: { id: string; member_id: string; looked_up_by: string; purpose: string | null; created_at: string };
        Insert: { id?: string; member_id: string; looked_up_by: string; purpose?: string | null; created_at?: string };
        Update: never;
        Relationships: [];
      };
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
      member_privacy_acknowledgements: {
        Row: MemberPrivacyAcknowledgement;
        Insert: MemberPrivacyAcknowledgementInsert;
        Update: Partial<MemberPrivacyAcknowledgementInsert>;
        Relationships: [];
      };
      member_withdrawals: {
        Row: MemberWithdrawal;
        Insert: MemberWithdrawalInsert;
        Update: Partial<MemberWithdrawalInsert>;
        Relationships: [];
      };
      member_login_tokens: {
        Row: MemberLoginToken;
        Insert: MemberLoginTokenInsert;
        Update: MemberLoginTokenUpdate;
        Relationships: [];
      };
      member_login_request_rate_windows: {
        Row: MemberLoginRequestRateWindow;
        Insert: MemberLoginRequestRateWindowInsert;
        Update: MemberLoginRequestRateWindowUpdate;
        Relationships: [];
      };
      member_interview_tokens: {
        Row: MemberInterviewToken;
        Insert: MemberInterviewTokenInsert;
        Update: MemberInterviewTokenUpdate;
        Relationships: [];
      };
      member_audio_usage_windows: {
        Row: MemberAudioUsageWindow;
        Insert: MemberAudioUsageWindowInsert;
        Update: MemberAudioUsageWindowUpdate;
        Relationships: [];
      };
      interview_labels: {
        Row: InterviewLabel;
        Insert: InterviewLabelInsert;
        Update: InterviewLabelUpdate;
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
      workshop_sessions: {
        Row: WorkshopSession;
        Insert: WorkshopSessionInsert;
        Update: WorkshopSessionUpdate;
        Relationships: [];
      };
      pair_submissions: {
        Row: PairSubmission;
        Insert: PairSubmissionInsert;
        Update: PairSubmissionUpdate;
        Relationships: [];
      };
      workshop_votes: {
        Row: WorkshopVote;
        Insert: WorkshopVoteInsert;
        Update: WorkshopVoteUpdate;
        Relationships: [];
      };
      workshop_seed: {
        Row: WorkshopSeed;
        Insert: WorkshopSeedInsert;
        Update: WorkshopSeedUpdate;
        Relationships: [];
      };
      member_stories: {
        Row: MemberStory;
        Insert: MemberStoryInsert;
        Update: Partial<MemberStoryInsert>;
        Relationships: [];
      };
      member_behaviors: {
        Row: MemberBehavior;
        Insert: MemberBehaviorInsert;
        Update: MemberBehaviorUpdate;
        Relationships: [];
      };
      phase3_pulse_checks: {
        Row: PulseCheck;
        Insert: PulseCheckInsert;
        Update: Partial<PulseCheckInsert>;
        Relationships: [];
      };
      phase3_context_responses: {
        Row: Phase3ContextResponse;
        Insert: Phase3ContextResponseInsert;
        Update: Phase3ContextResponseUpdate;
        Relationships: [];
      };
      phase3_conversation_messages: {
        Row: Phase3ConversationMessage;
        Insert: Phase3ConversationMessageInsert;
        Update: Partial<Phase3ConversationMessageInsert>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_member_audio_quota: {
        Args: {
          p_member_id: string;
          p_capability: string;
          p_tts_characters?: number;
          p_stt_duration_ms?: number;
          p_stt_bytes?: number;
          p_tts_request_limit?: number;
          p_tts_character_limit?: number;
          p_stt_request_limit?: number;
          p_stt_duration_limit_ms?: number;
          p_stt_byte_limit?: number;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };
      consume_member_login_request_rate_limit: {
        Args: {
          p_combination_key_hash: string;
          p_email_key_hash: string;
          p_combination_limit?: number;
          p_email_limit?: number;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
