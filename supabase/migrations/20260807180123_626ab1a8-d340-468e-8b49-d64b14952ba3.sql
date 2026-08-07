-- 1) profiles: block self-service edits of financial/privileged columns
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and privileged/server contexts may change anything.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.savings_balance IS DISTINCT FROM OLD.savings_balance
     OR NEW.service_balances IS DISTINCT FROM OLD.service_balances
     OR NEW.enrollments IS DISTINCT FROM OLD.enrollments
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.debit_frozen IS DISTINCT FROM OLD.debit_frozen
     OR NEW.daily_limit IS DISTINCT FROM OLD.daily_limit
     OR NEW.account_number IS DISTINCT FROM OLD.account_number
     OR NEW.savings_account_number IS DISTINCT FROM OLD.savings_account_number
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Not authorized to modify protected account fields' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_self_update ON public.profiles;
CREATE TRIGGER profiles_guard_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

-- 2) loan_applications: applicants cannot touch underwriting-controlled columns
CREATE OR REPLACE FUNCTION public.guard_loan_application_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.approved_amount IS DISTINCT FROM OLD.approved_amount
     OR NEW.apr IS DISTINCT FROM OLD.apr
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.applied_code IS DISTINCT FROM OLD.applied_code
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Not authorized to modify underwriting fields' USING ERRCODE = '42501';
  END IF;

  -- Applicants may only advance their own application through the intake states.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('kyc_submitted', 'pending')
  THEN
    RAISE EXCEPTION 'Not authorized to set application status' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loan_applications_guard_self_update ON public.loan_applications;
CREATE TRIGGER loan_applications_guard_self_update
BEFORE UPDATE ON public.loan_applications
FOR EACH ROW EXECUTE FUNCTION public.guard_loan_application_self_update();

-- 3) SSN: stop storing reversible "encrypted" full SSNs
UPDATE public.loan_applications SET ssn_encrypted = NULL WHERE ssn_encrypted IS NOT NULL;
ALTER TABLE public.loan_applications DROP COLUMN IF EXISTS ssn_encrypted;

-- 4) transactions: customers may no longer fabricate ledger rows
DROP POLICY IF EXISTS "Users insert own transactions" ON public.transactions;

CREATE OR REPLACE FUNCTION public.internal_transfer(
  p_from text,
  p_to text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof RECORD;
  new_checking numeric;
  new_savings numeric;
  now_ts timestamptz := now();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_from NOT IN ('checking', 'savings') OR p_to NOT IN ('checking', 'savings') OR p_from = p_to THEN
    RAISE EXCEPTION 'Invalid transfer accounts';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF prof.status <> 'Active' THEN RAISE EXCEPTION 'Account is not active'; END IF;

  IF p_from = 'checking' THEN
    IF prof.balance < p_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
    new_checking := prof.balance - p_amount;
    new_savings := prof.savings_balance + p_amount;
  ELSE
    IF prof.savings_balance < p_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
    new_savings := prof.savings_balance - p_amount;
    new_checking := prof.balance + p_amount;
  END IF;

  UPDATE public.profiles
    SET balance = new_checking, savings_balance = new_savings
    WHERE id = uid;

  INSERT INTO public.transactions (user_id, account, posted_at, description, amount, balance_after)
  VALUES (
    uid, p_from, now_ts,
    'Internal transfer to ' || CASE WHEN p_to = 'checking' THEN 'Everyday Checking' ELSE 'Way2Save Savings' END,
    -p_amount,
    CASE WHEN p_from = 'checking' THEN new_checking ELSE new_savings END
  );

  INSERT INTO public.transactions (user_id, account, posted_at, description, amount, balance_after)
  VALUES (
    uid, p_to, now_ts,
    'Internal transfer from ' || CASE WHEN p_from = 'checking' THEN 'Everyday Checking' ELSE 'Way2Save Savings' END,
    p_amount,
    CASE WHEN p_to = 'checking' THEN new_checking ELSE new_savings END
  );

  RETURN jsonb_build_object('ok', true, 'balance', new_checking, 'savings_balance', new_savings);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_transfer(text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_transfer(text, text, numeric) TO authenticated;

-- 5) SECURITY DEFINER exposure: revoke API execute rights where not needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_loan_application_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_loan_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_loan_disbursement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_loan_disbursement(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 6) system_settings: admin-only reads, and stop live broadcasting to all users
DROP POLICY IF EXISTS "Authenticated can read system settings" ON public.system_settings;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.system_settings;
EXCEPTION WHEN undefined_object OR undefined_table THEN NULL;
END $$;

-- 7) loan-docs storage: authenticated applicants with a real application only
DROP POLICY IF EXISTS "Applicants upload own loan docs" ON storage.objects;
CREATE POLICY "Applicants upload own loan docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'loan-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.loan_applications la WHERE la.user_id = auth.uid()
  )
);
