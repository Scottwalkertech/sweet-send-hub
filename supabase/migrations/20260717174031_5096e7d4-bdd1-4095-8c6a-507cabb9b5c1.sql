
CREATE TABLE public.loan_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product TEXT NOT NULL,
  apr NUMERIC(6,3) NOT NULL,
  requested_amount NUMERIC(14,2) NOT NULL,
  approved_amount NUMERIC(14,2) NOT NULL,
  gross_monthly_income NUMERIC(14,2) NOT NULL,
  monthly_debt NUMERIC(14,2) NOT NULL,
  credit_tier TEXT NOT NULL,
  occupation TEXT,
  ssn_last4 TEXT,
  ssn_encrypted TEXT,
  proof_of_income_name TEXT,
  government_id_name TEXT,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pre_approved',
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.loan_applications TO authenticated;
GRANT INSERT ON public.loan_applications TO anon;
GRANT ALL ON public.loan_applications TO service_role;

ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a loan application"
  ON public.loan_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own loan applications"
  ON public.loan_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own loan applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all loan applications"
  ON public.loan_applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all loan applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER loan_applications_touch_updated
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
