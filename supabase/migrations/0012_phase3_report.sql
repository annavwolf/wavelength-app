-- Phase 3 §3.6: consultant-reviewed and edited report content.
-- Stored alongside tier2_json on the analysis row. Null until the consultant
-- has opened the Report & Release tab and saved edits.
-- released_at (inside the JSON) tracks whether Phase 3 links have been sent.
alter table analysis
  add column if not exists phase3_report_json jsonb;
