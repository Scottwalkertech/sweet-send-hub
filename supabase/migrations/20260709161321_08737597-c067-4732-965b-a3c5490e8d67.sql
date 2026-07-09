
-- 1. Lock down system_settings: only authenticated users can read, admins write.
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
REVOKE ALL ON public.system_settings FROM anon;
CREATE POLICY "Authenticated can read system settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- 2. Create public_settings for anon-visible values (e.g. site banner).
CREATE TABLE IF NOT EXISTS public.public_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.public_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.public_settings TO authenticated;
GRANT ALL ON public.public_settings TO service_role;
ALTER TABLE public.public_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read public settings" ON public.public_settings;
CREATE POLICY "Anyone can read public settings"
  ON public.public_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins insert public settings" ON public.public_settings;
CREATE POLICY "Admins insert public settings"
  ON public.public_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update public settings" ON public.public_settings;
CREATE POLICY "Admins update public settings"
  ON public.public_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Migrate existing banner value if any
INSERT INTO public.public_settings (key, value)
SELECT key, value FROM public.system_settings WHERE key = 'banner'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

DELETE FROM public.system_settings WHERE key = 'banner';

-- 3. Lock down has_role EXECUTE.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Enable realtime on new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_settings;
