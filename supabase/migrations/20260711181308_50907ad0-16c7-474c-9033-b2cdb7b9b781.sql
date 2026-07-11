
-- Transactions ledger (posted account activity)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account TEXT NOT NULL CHECK (account IN ('checking','savings')),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update transactions" ON public.transactions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete transactions" ON public.transactions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX transactions_user_account_idx ON public.transactions(user_id, account, posted_at DESC);

-- Pending transaction queue (deposit/wire/transfer requests)
CREATE TABLE public.pending_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Failed')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  memo TEXT,
  recipient TEXT,
  recipient_bank TEXT,
  recipient_acct TEXT,
  routing TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_transactions TO authenticated;
GRANT ALL ON public.pending_transactions TO service_role;
ALTER TABLE public.pending_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pending" ON public.pending_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pending" ON public.pending_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all pending" ON public.pending_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update pending" ON public.pending_transactions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert pending" ON public.pending_transactions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete pending" ON public.pending_transactions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX pending_user_idx ON public.pending_transactions(user_id, submitted_at DESC);
CREATE INDEX pending_status_idx ON public.pending_transactions(status, submitted_at DESC);

CREATE TRIGGER pending_touch BEFORE UPDATE ON public.pending_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_transactions;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.pending_transactions REPLICA IDENTITY FULL;
