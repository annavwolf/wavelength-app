// Single source of truth for the fixed (locked) Phase 3 copy that both the
// member flow and the dashboard release-preview render — so the preview is
// truthful about what Otis will actually say.

// Extra intro page shown ONLY when the Shared Purpose section is included.
// Sits at the end of the introduction, before the assessment results.
export const SHARED_PURPOSE_INTRO =
  "Before we look at psychological safety, I want to share what I noticed about your team's shared purpose — how aligned you are on what the team is really for. We'll start there, then move into the safety results.";

// Shared Purpose results screen (mirrors the zone review: a read + accuracy
// pulse). The classification-specific heading gives the member a plain label.
export const SHARED_PURPOSE_HEADING = "Your shared purpose";

export function sharedPurposeClassificationLabel(classification?: string): string {
  switch (classification) {
    case "aligned": return "Strongly aligned";
    case "broadly_aligned": return "Broadly aligned";
    case "fuzzy": return "Still taking shape";
    case "bifurcated": return "A few different directions";
    case "fragmented": return "Not yet shared";
    default: return "Your shared purpose";
  }
}

// A one-line, member-safe framing of the classification for the results visual.
export function sharedPurposeClassificationBlurb(classification?: string): string {
  switch (classification) {
    case "aligned": return "Your team describes a strikingly consistent sense of what you're here to do.";
    case "broadly_aligned": return "There's a clear common thread in how your team sees its purpose, with some variation at the edges.";
    case "fuzzy": return "Your team's sense of shared purpose is still taking shape — a conversation to name it clearly would help.";
    case "bifurcated": return "Your team seems to hold a few different views of its purpose — worth reconciling so effort points the same way.";
    case "fragmented": return "Each person describes the purpose differently — an opportunity to build a shared one together.";
    default: return "Here's how aligned your team seems to be on its shared purpose.";
  }
}
