-- Añadir columnas de estadísticas a la tabla profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS draws INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS total_earned INTEGER DEFAULT 0 NOT NULL;

-- Crear un bucket de storage para los avatares si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de seguridad para el bucket avatars
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid() = owner
);

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid() = owner
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid() = owner
);

-- Trigger para automatizar victorias y derrotas cuando una batalla termina
CREATE OR REPLACE FUNCTION update_battle_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    IF NEW.score_a > NEW.score_b THEN
      UPDATE public.profiles SET wins = wins + 1, total_earned = total_earned + NEW.score_a WHERE id = NEW.player_a_id;
      UPDATE public.profiles SET losses = losses + 1, total_earned = total_earned + NEW.score_b WHERE id = NEW.player_b_id;
    ELSIF NEW.score_b > NEW.score_a THEN
      UPDATE public.profiles SET wins = wins + 1, total_earned = total_earned + NEW.score_b WHERE id = NEW.player_b_id;
      UPDATE public.profiles SET losses = losses + 1, total_earned = total_earned + NEW.score_a WHERE id = NEW.player_a_id;
    ELSE
      UPDATE public.profiles SET draws = draws + 1, total_earned = total_earned + NEW.score_a WHERE id = NEW.player_a_id;
      UPDATE public.profiles SET draws = draws + 1, total_earned = total_earned + NEW.score_b WHERE id = NEW.player_b_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_battle_finish ON public.battles;
CREATE TRIGGER on_battle_finish
AFTER UPDATE ON public.battles
FOR EACH ROW
EXECUTE FUNCTION update_battle_stats();
