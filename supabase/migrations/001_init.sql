-- GYMX — Migration initiale
-- Active RLS sur toutes les tables

-- 1. Profil utilisateur
CREATE TABLE profil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL CHECK (niveau IN ('debutant', 'intermediaire', 'avance')),
  jours_par_semaine INT NOT NULL CHECK (jours_par_semaine BETWEEN 3 AND 6),
  objectif TEXT NOT NULL CHECK (objectif IN ('force', 'muscle', 'recomposition')),
  materiel TEXT NOT NULL CHECK (materiel IN ('salle', 'halteres', 'corps')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profil_owner_policy" ON profil
  FOR ALL USING (auth.uid() = user_id);

-- 2. Exercices (seed depuis free-exercise-db + mapping FR)
CREATE TABLE exercices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_fr TEXT NOT NULL,
  nom_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  groupe TEXT NOT NULL,
  sous_region TEXT NOT NULL,
  equipement TEXT NOT NULL CHECK (equipement IN ('salle', 'halteres', 'corps')),
  compound BOOLEAN DEFAULT false,
  role TEXT NOT NULL DEFAULT 'accessoire' CHECK (role IN ('principal', 'accessoire')),
  assist_inverse BOOLEAN DEFAULT false,
  unite_par_defaut TEXT NOT NULL DEFAULT 'kg' CHECK (unite_par_defaut IN ('kg', 'plaque', 'unite', 'reps')),
  pas_par_defaut NUMERIC NOT NULL DEFAULT 2.5,
  image_url TEXT,
  instructions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE exercices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercices_read_policy" ON exercices
  FOR SELECT USING (true);

-- 3. Pools de substitution (exos équivalents par sous-région)
CREATE TABLE pools_substitution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sous_region TEXT NOT NULL,
  exercice_id UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  ordre INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pools_substitution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pools_substitution_read_policy" ON pools_substitution
  FOR SELECT USING (true);

-- 4. Exercices exclus par l'utilisateur
CREATE TABLE exercices_exclus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercice_id UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  raison TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, exercice_id)
);

ALTER TABLE exercices_exclus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercices_exclus_owner_policy" ON exercices_exclus
  FOR ALL USING (auth.uid() = user_id);

-- 5. Programme actif
CREATE TABLE programme_actif (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type_programme TEXT NOT NULL CHECK (type_programme IN ('template', 'genere')),
  date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
  semaine_courante INT NOT NULL DEFAULT 1,
  cycle_courant INT NOT NULL DEFAULT 1,
  longueur_bloc INT NOT NULL DEFAULT 4,
  jours_par_semaine INT NOT NULL DEFAULT 3,
  termine BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE programme_actif ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programme_actif_owner_policy" ON programme_actif
  FOR ALL USING (auth.uid() = user_id);

-- 6. Structure du programme (template de séances)
CREATE TABLE programme_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_actif_id UUID NOT NULL REFERENCES programme_actif(id) ON DELETE CASCADE,
  jour INT NOT NULL,
  exercice_id UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  ordre INT NOT NULL DEFAULT 0,
  series_cibles INT NOT NULL DEFAULT 3,
  reps_cibles INT NOT NULL DEFAULT 8,
  role TEXT NOT NULL DEFAULT 'accessoire',
  fige BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE programme_structure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programme_structure_owner_policy" ON programme_structure
  FOR ALL USING (
    programme_actif_id IN (
      SELECT id FROM programme_actif WHERE user_id = auth.uid()
    )
  );

-- 7. Charges par exercice
CREATE TABLE charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercice_id UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  charge_actuelle NUMERIC NOT NULL DEFAULT 0,
  unite TEXT NOT NULL DEFAULT 'kg' CHECK (unite IN ('kg', 'plaque', 'unite', 'reps')),
  pas NUMERIC NOT NULL DEFAULT 2.5,
  sens TEXT NOT NULL DEFAULT 'normal' CHECK (sens IN ('normal', 'inverse')),
  compteur_echecs INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, exercice_id)
);

ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charges_owner_policy" ON charges
  FOR ALL USING (auth.uid() = user_id);

-- 8. Séances
CREATE TABLE seances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  jour_du_programme INT NOT NULL DEFAULT 1,
  duree INT, -- en secondes
  terminee BOOLEAN DEFAULT false,
  annulee BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE seances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seances_owner_policy" ON seances
  FOR ALL USING (auth.uid() = user_id);

-- 9. Séries
CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seance_id UUID NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  exercice_id UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  reps INT NOT NULL DEFAULT 0,
  charge NUMERIC NOT NULL DEFAULT 0,
  unite TEXT NOT NULL DEFAULT 'kg',
  validee BOOLEAN DEFAULT false,
  ordre INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "series_owner_policy" ON series
  FOR ALL USING (
    seance_id IN (
      SELECT id FROM seances WHERE user_id = auth.uid()
    )
  );

-- 10. Effort (RPE slider) par exercice et séance
CREATE TABLE effort (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seance_id UUID NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  exercice_id UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  valeur INT NOT NULL CHECK (valeur BETWEEN 1 AND 10),
  cran TEXT NOT NULL CHECK (cran IN ('facile', 'ca_passe', 'dur', 'a_la_limite', 'impossible')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, seance_id, exercice_id)
);

ALTER TABLE effort ENABLE ROW LEVEL SECURITY;

CREATE POLICY "effort_owner_policy" ON effort
  FOR ALL USING (auth.uid() = user_id);

-- 11. Poids du corps
CREATE TABLE poids_corps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  poids NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE poids_corps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poids_corps_owner_policy" ON poids_corps
  FOR ALL USING (auth.uid() = user_id);

-- 12. Gamification
CREATE TABLE gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INT NOT NULL DEFAULT 0,
  niveau INT NOT NULL DEFAULT 1,
  streak INT NOT NULL DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  quetes_en_cours JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamification_owner_policy" ON gamification
  FOR ALL USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_exercices_groupe ON exercices(groupe);
CREATE INDEX idx_exercices_sous_region ON exercices(sous_region);
CREATE INDEX idx_exercices_equipement ON exercices(equipement);
CREATE INDEX idx_charges_user_exercice ON charges(user_id, exercice_id);
CREATE INDEX idx_seances_user_date ON seances(user_id, date);
CREATE INDEX idx_series_seance ON series(seance_id);
CREATE INDEX idx_effort_seance ON effort(seance_id);
CREATE INDEX idx_pools_substitution_region ON pools_substitution(sous_region);
