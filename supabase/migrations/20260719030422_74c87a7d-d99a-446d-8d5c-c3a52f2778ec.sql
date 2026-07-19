
-- 1. Close the enumeration hole
DROP POLICY IF EXISTS "Anyone can lookup an active code" ON public.loan_application_codes;

-- 2. Secure code verifier - returns row only for exact code match
CREATE OR REPLACE FUNCTION public.verify_loan_code(code_string text)
RETURNS TABLE (code text, approved_amount numeric, product text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.code, c.approved_amount, c.product
  FROM public.loan_application_codes c
  WHERE c.code = code_string
    AND c.used_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_loan_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_loan_code(text) TO anon, authenticated;

-- 3. Admin-only atomic disbursement
CREATE OR REPLACE FUNCTION public.process_loan_disbursement(app_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app RECORD;
  new_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO app FROM public.loan_applications WHERE id = app_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan application not found'; END IF;
  IF app.status = 'approved' OR app.status = 'funded' THEN
    RAISE EXCEPTION 'Application already disbursed';
  END IF;
  IF app.user_id IS NULL THEN
    RAISE EXCEPTION 'Application has no linked customer account';
  END IF;

  UPDATE public.profiles
    SET balance = balance + app.approved_amount
    WHERE id = app.user_id
    RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Customer profile not found';
  END IF;

  INSERT INTO public.transactions (user_id, account, posted_at, description, amount, balance_after)
  VALUES (
    app.user_id,
    'checking',
    now(),
    'Disbursement: Approved Loan Funding — ' || app.product,
    app.approved_amount,
    new_balance
  );

  UPDATE public.loan_applications
    SET status = 'approved', reviewed_at = now()
    WHERE id = app_id;

  IF app.applied_code IS NOT NULL THEN
    UPDATE public.loan_application_codes
      SET used_at = now(), used_by = app.user_id
      WHERE code = app.applied_code AND used_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'application_id', app_id,
    'user_id', app.user_id,
    'amount', app.approved_amount,
    'new_balance', new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_loan_disbursement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_loan_disbursement(uuid) TO authenticated;
