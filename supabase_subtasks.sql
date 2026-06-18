CREATE TABLE subtasks (
    id          SERIAL PRIMARY KEY,
    task_id     INTEGER REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    text        TEXT NOT NULL,
    done        BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver propias subtareas"
  ON subtasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "crear propia subtarea"
  ON subtasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "editar propia subtarea"
  ON subtasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "borrar propia subtarea"
  ON subtasks FOR DELETE
  USING (auth.uid() = user_id);
