// Deterministic single-linkage grouping over embedding vectors. Union-find:
// same data + same threshold → same clusters, order-independent. Now used only
// by the Phase 4 single-stream behaviour grouping (lib/behaviourGrouping) after
// the 5-stream interview coding/clustering pipeline was retired (Phase 2 is
// quantitative-only). Keep this helper lean — it is the sole surviving export.

import { cosineSim } from "@/lib/embeddings";

// Union-find over vectors: edge between i,j when cosine(vec_i, vec_j) >= threshold.
// Order-independent (unlike greedy assignment), so clusters are deterministic.
export function clusterIndices(vectors: number[][], threshold: number): number[][] {
  const n = vectors.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosineSim(vectors[i], vectors[j]) >= threshold) union(i, j);
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  // Stable order: by first-member index.
  return Array.from(groups.values()).sort((a, b) => a[0] - b[0]);
}
