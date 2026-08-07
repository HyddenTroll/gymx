-- GYMX — Migration 002 : Activités multi-sports
CREATE TABLE activites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('course', 'padel', 'velo', 'natation', 'autre')),
  duree INT,
  distance NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activites_owner_policy" ON activites
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_activites_user_date ON activites(user_id, date);
