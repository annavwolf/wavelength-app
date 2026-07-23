// Central model config for the Phase 2 LLM steps. Cost-tuned per request: the
// mechanical extraction / labeling / cluster-naming steps run on Sonnet (cheaper
// than Opus); interpretation defaults to Sonnet too and can be upgraded to Opus
// if the written reads need more nuance.
//
// NOTE: "Claude 3.5 Sonnet" (claude-3-5-sonnet-*) is RETIRED (returns 404). The
// current cheaper-than-Opus Sonnet is claude-sonnet-4-6 ($3/$15 per MTok vs Opus
// 4.8 $5/$25). claude-haiku-4-5 ($1/$5) is the cheapest option for the most
// mechanical steps (e.g. cluster naming) if further savings are wanted.
//
// Each is env-overridable so models can be tuned without a code change.
export const MODELS = {
  coding: process.env.OTIS_MODEL_CODING ?? "claude-sonnet-4-6",
  clusterNaming: process.env.OTIS_MODEL_NAMING ?? "claude-sonnet-4-6",
  interpret: process.env.OTIS_MODEL_INTERPRET ?? "claude-sonnet-4-6", // "claude-opus-4-8" for richer reads
} as const;
