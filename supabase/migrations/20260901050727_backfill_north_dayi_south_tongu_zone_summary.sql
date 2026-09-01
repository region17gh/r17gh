-- Fix: north-dayi and south-tongu had null zone/summary, silently dropping
-- both from every zone-grouped view (region_payload zones[] summed to 16 of
-- 18). Zone assignment confirmed against the pre-existing zone counts
-- (southern-coastal:6, capital-central:9, highland-border:3), which already
-- anticipated both districts landing in capital-central alongside their
-- Tongu/Dayi siblings. Capital and reference_source were already correct
-- (Sourced, IMCCOD) — only zone and summary were missing.

update places
set zone = 'capital-central',
    summary = 'Cocoa, oil palm, food crops; western shore of Lake Volta near Kpando'
where slug = 'north-dayi';

update places
set zone = 'capital-central',
    summary = 'Agriculture, fishing, Volta River tourism near Sogakope'
where slug = 'south-tongu';
