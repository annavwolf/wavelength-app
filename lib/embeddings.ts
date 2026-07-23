// Voyage AI embeddings wrapper (Anthropic has no native embeddings endpoint).
// Used by the Phase 2 clustering step. Deterministic: same text + model → same
// vector, so clustering is reproducible. REST call (Voyage has no first-class
// Node SDK); model is env-overridable.
//
// API: POST https://api.voyageai.com/v1/embeddings
//   headers: Authorization: Bearer <key>
//   body: { model, input: string[] }  (max 1000 inputs/call)
//   resp: { data: [{ embedding: number[], index }], usage }

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5";
const MAX_BATCH = 1000;

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
};

// Embed a list of texts → one vector each, order-aligned with the input.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY not configured");

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH);
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: batch }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Voyage embeddings failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as VoyageResponse;
    // Re-order by index defensively before appending.
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) out.push(d.embedding);
  }
  return out;
}

// ── Vector helpers (cosine similarity on raw vectors) ────────────────────────
export function norm(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot / denom;
}
