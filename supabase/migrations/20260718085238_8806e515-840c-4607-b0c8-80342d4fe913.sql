
-- 1. Loan applications: tighten INSERT, add doc paths + admin review columns
DROP POLICY IF EXISTS "Anyone can submit a loan application" ON public.loan_applications;
CREATE POLICY "Submit loan app for self or anon"
ON public.loan_applications FOR INSERT TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS proof_of_income_path text,
  ADD COLUMN IF NOT EXISTS government_id_path text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_code text;

-- 2. system_settings: restrict SELECT to admins
DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Anyone authenticated can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "authenticated can read system settings" ON public.system_settings;
CREATE POLICY "Admins read system settings"
ON public.system_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Loan application codes
CREATE TABLE IF NOT EXISTS public.loan_application_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  approved_amount numeric(14,2) NOT NULL,
  product text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loan_application_codes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.loan_application_codes TO authenticated;
GRANT ALL ON public.loan_application_codes TO service_role;

ALTER TABLE public.loan_application_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can lookup an active code"
ON public.loan_application_codes FOR SELECT TO anon, authenticated
USING (used_at IS NULL);

CREATE POLICY "Admins manage codes - select all"
ON public.loan_application_codes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert codes"
ON public.loan_application_codes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update codes"
ON public.loan_application_codes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete codes"
ON public.loan_application_codes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER loan_application_codes_touch
BEFORE UPDATE ON public.loan_application_codes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Storage policies for the private loan-docs bucket
CREATE POLICY "Applicants upload own loan docs"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'loan-docs'
  AND (
    (auth.uid() IS NULL AND (storage.foldername(name))[1] = 'anon')
    OR (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
  )
);

CREATE POLICY "Admins read loan docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'loan-docs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete loan docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'loan-docs' AND public.has_role(auth.uid(), 'admin'));
