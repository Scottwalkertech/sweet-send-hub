ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enrollments jsonb NOT NULL DEFAULT '{"smallBusiness":false,"commercial":false,"wire":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS service_balances jsonb NOT NULL DEFAULT '{"smallBusiness":0,"commercial":0,"wire":0}'::jsonb;

-- Restrict profile self-editing to admins only. Users can still SELECT their own profile;
-- write-access is limited to admins via has_role().
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile') THEN
    DROP POLICY "Users can update their own profile" ON public.profiles;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can update any profile') THEN
    CREATE POLICY "Admins can update any profile" ON public.profiles
      FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;