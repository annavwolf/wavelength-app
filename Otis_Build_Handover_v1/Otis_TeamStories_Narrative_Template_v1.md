# Otis Team Stories Narrative Template (v1)
### The assembly spec for turning coded interview buckets into readable narrative sentences
*Companion to the Wavelength dashboard, Team Stories section. This is mechanical assembly, NOT interpretation. Read the fidelity note in Section 4 before building the Phase 2 coding step.*

---

## 0. What this guide is (and what it is deliberately NOT)

By the time this template runs, Otis has already coded each member's interview into four buckets (Situation → Out-Behavior → Outcome → In-Behavior) and clustered the labels. This template does one narrow job: **stitch those already-captured labels into a grammatical sentence.**

It does **not** interpret, summarise, judge, or rephrase. There is nothing left to analyse at this step, the analysis already happened during coding. The template's entire purpose is to present coded data as readable prose without altering its meaning.

**The guiding principle: stay close to the data.** Use the coded content as captured. Add connective grammar only. Never swap in synonyms, never "improve" the wording, never generalise a specific term into a vaguer one. If a member's behavior was coded as "not CC-ing the right people," the sentence says "not CC-ing the right people," not "poor communication."

---

## 1. The base template

> *When members [OBJECTIVE] during [CONTEXT], [OUT-BEHAVIOR(S)], which led to [OUTCOME(S)]. Members felt this could have gone better if the team had [IN-BEHAVIOR(S)].*

Where each slot is filled from the coded buckets for that member + item:
- **[OBJECTIVE]** ← situation bucket, objective sub-label
- **[CONTEXT]** ← situation bucket, context sub-label
- **[OUT-BEHAVIOR(S)]** ← out-behavior bucket label(s)
- **[OUTCOME(S)]** ← outcome bucket label(s)
- **[IN-BEHAVIOR(S)]** ← in-behavior bucket label(s)

Minor grammatical adjustment (articles, verb agreement, joining multiple labels with "and") is allowed. Meaning changes are not.

---

## 2. Reflow variants (for missing buckets)

Not every interview fills every bucket. The sentence must reflow gracefully rather than leave a gap or a blank. Variants:

**All four buckets present:** use the base template.

**No outcome coded:**
> *When members [OBJECTIVE] during [CONTEXT], [OUT-BEHAVIOR(S)]. Members felt this could have gone better if the team had [IN-BEHAVIOR(S)].*

**No in-behavior coded (member didn't offer an alternative):**
> *When members [OBJECTIVE] during [CONTEXT], [OUT-BEHAVIOR(S)], which led to [OUTCOME(S)].*

**No objective coded (only context):**
> *During [CONTEXT], [OUT-BEHAVIOR(S)], which led to [OUTCOME(S)]. Members felt this could have gone better if the team had [IN-BEHAVIOR(S)].*

**All-positive branch (from the reframed interview, D-047):** the framing flips from deficit to "even better." Variant:
> *When members [OBJECTIVE] during [CONTEXT], the team [IN-BEHAVIOR(S)] well. Members felt it could be even stronger with [additional IN-BEHAVIOR(S)].*

If a bucket essential to a coherent sentence is missing (e.g. no out-behavior AND no in-behavior), do not fabricate, output only what exists, or omit the narrative for that member and surface the raw coded labels instead.

---

## 3. Assembly rules

1. **One narrative per member, per item.** If three members told stories about the same PS item, that's three separate sentences, not one merged sentence. Do not blend members' accounts.
2. **Fill from the coded labels, verbatim.** The words in the sentence are the words that were coded. No synonym substitution, no summarising, no softening or sharpening.
3. **No editorialising.** No "this suggests," no adjectives or framing that weren't in the coded data. The template reports; it does not conclude. (Interpretation happens elsewhere, in the zone read and Otis's workshop suggestions, never here.)
4. **Connective grammar only.** Otis may add "when," "during," "which led to," "and," articles, and verb agreement to make a grammatical sentence. Nothing else.
5. **Preserve domain/industry terms exactly.** If a member used field-specific language, it survives into the sentence unchanged. (See fidelity note, Section 4.)

---

## 4. FIDELITY NOTE — read before building the Phase 2 coding step

*This template is safe from meaning-distortion because it runs AFTER coding. But the discipline that protects meaning must be enforced UPSTREAM, at the coding step, not here. This note flags where the real work lives.*

The narrative template cannot distort meaning because it only reassembles labels. But that means **all the fidelity risk sits in the coding step** (Phase 2, where Otis extracts labels from transcripts). The following rules belong to that coding step and must be locked when Phase 2 is speced:

- **No pre-supplied behavior codebook in the pilot.** Consistent with D-039 (emergent-first). Otis generates labels from what members actually said, it is not handed a list of expected behaviors to match against. Pre-supplying examples would cause Otis to pattern-match real input toward the examples, quietly replacing members' words with the anticipated set. This is especially dangerous for a cross-industry tool: no example set can anticipate a nurse's, a soldier's, or a construction PM's vocabulary.
- **Preserve the member's own words and terminology.** When coding a label, stay as close as possible to the member's actual phrasing. Do not normalise domain-specific or industry terms into generic ones. If clustering later groups similar labels, the cluster is *named* separately (Decision 1), but the original member labels are preserved underneath and remain the source for these narratives.
- **Prefer under-coding to over-inferring.** If it's ambiguous whether a behavior was present, don't invent it. Stay close to the ground truth of what was said. (This echoes the existing instruction in the source flow doc; it should be a firm rule, not a soft preference.)
- **Flag, don't normalise, unfamiliar terms.** If a member uses a term Otis doesn't recognise, it preserves it verbatim rather than mapping it to the nearest familiar concept.

The net effect: because coding stays faithful to members' words, the narrative template, which just replays those words, is automatically faithful too. Fidelity is won or lost at coding, not at assembly.

---

## 5. Structure-only examples

*These examples use deliberately GENERIC, bland filler content. Their purpose is to teach the SENTENCE STRUCTURE only. They must NOT teach vocabulary, real member language will be far more specific and varied, and Otis should never pattern-match real content toward these bland examples. Structure is the lesson here; content is not.*

**All buckets present:**
> When members [gave status updates] during [the weekly meeting], [some people talked over others and a few points went unacknowledged], which led to [some updates being missed and repeated later]. Members felt this could have gone better if the team had [made space for each person to finish].

**No outcome:**
> When members [raised a problem] during [a group chat], [the message sat without a reply for a while]. Members felt this could have gone better if the team had [acknowledged the flag sooner].

**All-positive (reframed) branch:**
> When members [shared early ideas] during [a planning session], the team [built on each other's suggestions] well. Members felt it could be even stronger with [inviting quieter members in directly].

*(Note how generic the bracketed content is. Real coded labels will be sharper, more specific, and often domain-flavoured. That is correct and desirable, these examples exist so Otis knows the shape of the sentence, nothing more.)*

---

## 6. Build notes

- Grammar-smoothing is allowed; meaning changes are not. When in doubt, favour the member's literal wording over a smoother sentence.
- If required buckets for a coherent sentence are absent, fall back to displaying the raw coded labels rather than fabricating a narrative.
- These narratives appear under each selected PS item in the Team Stories section, ordered as specified in the dashboard flow (by how many members told stories about that item, then by zone depth).
- The narrative sentences are display only, they do not feed Phase 3.
