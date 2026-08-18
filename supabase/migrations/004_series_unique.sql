-- GYMX — Contrainte UNIQUE sur les séries
-- Empêche la duplication des séries (upsert fiable sur seance/exercice/ordre)

-- Nettoyage des doublons existants (garde la ligne la plus ancienne par groupe)
DELETE FROM series a
USING series b
WHERE a.id > b.id
  AND a.seance_id = b.seance_id
  AND a.exercice_id = b.exercice_id
  AND a.ordre = b.ordre;

-- Contrainte UNIQUE pour rendre les upserts idempotents
ALTER TABLE series
  ADD CONSTRAINT series_seance_exercice_ordre_unique
  UNIQUE (seance_id, exercice_id, ordre);
