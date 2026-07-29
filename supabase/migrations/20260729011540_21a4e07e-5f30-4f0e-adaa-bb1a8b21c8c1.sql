ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  acct TEXT := lpad((floor(random() * 1000000000000))::bigint::text, 12, '0');
  sav  TEXT := lpad((floor(random() * 1000000000000))::bigint::text, 12, '0');
  admin_count INT;
  meta_country TEXT := COALESCE(NEW.raw_user_meta_data->>'country', 'US');
  meta_currency TEXT := COALESCE(NEW.raw_user_meta_data->>'currency', 'USD');
BEGIN
  INSERT INTO public.profiles (id, name, email, account_number, savings_account_number, country, currency)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    acct,
    sav,
    meta_country,
    meta_currency
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;