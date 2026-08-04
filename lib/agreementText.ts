// Pure, dependency-free agreement helpers. Kept separate from lib/phase4Insights
// (which imports the server-only Anthropic SDK) so client components can render
// the agreement sentence without pulling node built-ins into the browser bundle.

import type { Phase4Agreement } from "@/types/database";

export function renderAgreementSentence(a: Phase4Agreement): string {
  const join = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  const situations = a.situations.length ? `, especially during ${join(a.situations)}` : "";
  return `In order to make this team a place where ${a.ps_item}${situations}, members will aim to ALWAYS ${join(a.always)} and NEVER ${join(a.never)}.`;
}
