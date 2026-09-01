type ContextSnapshot = {
  frequency?: string | null;
  commitment?: string | null;
  synchronicity?: string | null;
} | null;

type ConversationSnapshot = { kind: string; state: unknown };

export type Phase3SubmissionSnapshot = {
  includeStories: boolean;
  includePurpose: boolean;
  behaviorBuckets: string[];
  context: ContextSnapshot;
  conversations: ConversationSnapshot[];
  pulseKeys: string[];
};

function stateRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** One canonical definition of a complete Phase 3 submission. */
export function missingPhase3SubmissionFields(snapshot: Phase3SubmissionSnapshot): string[] {
  const missing: string[] = [];
  const alwaysCount = snapshot.behaviorBuckets.filter((bucket) => bucket === "always").length;
  const neverCount = snapshot.behaviorBuckets.filter((bucket) => bucket === "never").length;
  if (alwaysCount < 2 || neverCount < 2) {
    missing.push("at least two ALWAYS and two NEVER behaviours");
  }

  if (snapshot.includeStories && !snapshot.context?.frequency) missing.push("the frequency answer");
  if (!snapshot.context?.commitment) missing.push("the 30-day commitment answer");
  if (!snapshot.context?.synchronicity) missing.push("the meeting-together answer");

  const conversations = new Map(snapshot.conversations.map((row) => [row.kind, stateRecord(row.state)]));
  if (snapshot.includeStories && conversations.get("story")?.story_complete !== true) {
    missing.push("the team-story conversation");
  }
  if (snapshot.includeStories && conversations.get("impact")?.impact_complete !== true) {
    missing.push("the impact conversation");
  }

  const pulseKeys = new Set(snapshot.pulseKeys);
  const requiredPulseKeys = snapshot.includePurpose
    ? ["purpose", "zone1", "zone2", "zone3"]
    : ["zone1", "zone2", "zone3"];
  const missingPulseCount = requiredPulseKeys.filter((key) => !pulseKeys.has(key)).length;
  if (missingPulseCount > 0) {
    missing.push(`${missingPulseCount} results accuracy rating${missingPulseCount === 1 ? "" : "s"}`);
  }

  return missing;
}
