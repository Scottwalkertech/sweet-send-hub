
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct TEXT := lpad((floor(random() * 1000000000000))::bigint::text, 12, '0');
  sav  TEXT := lpad((floor(random() * 1000000000000))::bigint::text, 12, '0');
  admin_count INT;
BEGIN
  INSERT INTO public.profiles (id, name, email, account_number, savings_account_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    acct,
    sav
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  -- Bootstrap: first signup ever is promoted to admin so the Operations Console has an operator.
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
