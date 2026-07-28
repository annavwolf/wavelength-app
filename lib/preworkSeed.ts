// preworkSeed.ts — Phase 3 pivot: PreworkReview now reads member_behaviors
// directly from the DB. This file is retained only for any legacy import
// references; the functions are no-ops. See PreworkReview.tsx for the real logic.
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { SeedBehaviour } from "@/types/database";
import type { Tier1Result, Tier2Result } from "@/components/dashboard/types";

export function deriveBehaviours(_tier1: Tier1Result, _statementId: number): SeedBehaviour[] {
  return [];
}

export function deriveSituation(_tier1: Tier1Result, _statementId: number): { objective: string; context: string } {
  return { objective: "", context: "" };
}

export function crossItemLibrary(_tier1: Tier1Result, _excludeStatementId: number): SeedBehaviour[] {
  return [];
}

export function focusAlternatives(
  _tier2: Tier2Result | null, _currentStatementId: number | null,
): Array<{ statement_id: number; statement_text: string; zone: number }> {
  return [];
}

export function makeConsultantBehaviour(text: string, kind: "never" | "always"): SeedBehaviour {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b_${Math.random().toString(36).slice(2)}`;
  return { id, text, kind, provenance: "consultant", source_statement_id: null, original_text: null };
}
