// Supabase-backed data layer for admin + client. Everything the Operations
// Console can edit lives here and is broadcast via postgres_changes so client
// dashboards update live without a refresh.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ServiceEnrollments = { smallBusiness?: boolean; commercial?: boolean; wire?: boolean };
export type ServiceBalances = { smallBusiness?: number; commercial?: number; wire?: number };

export type DbProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  tier: "Standard" | "Premier" | "Private" | "Business" | string;
  status: "Active" | "Frozen" | "Review" | string;
  verified: boolean;
  debit_frozen: boolean;
  daily_limit: number;
  balance: number;
  savings_balance: number;
  account_number: string;
  savings_account_number: string;
  profile_picture: string | null;
  created_at: string;
  enrollments: ServiceEnrollments;
  service_balances: ServiceBalances;
};

export type DepositSettingsDb = {
  bankName: string;
  routing: string;
  beneficiary: string;
  accountNumber: string;
  swift: string;
  bankAddress: string;
  btcAddress: string;
  btcQrDataUrl: string;
};

export type RatesSettings = { checkingApy: number; savingsApy: number };
export type LimitsSettings = { defaultDailyLimit: number; wireCutoffHour: number };
export type BannerSettings = { enabled: boolean; tone: "info" | "warning" | "success" | "danger"; message: string };

export type SettingsMap = {
  deposit: DepositSettingsDb;
  rates: RatesSettings;
  limits: LimitsSettings;
  banner: BannerSettings;
};

// ------- profiles ------------------------------------------------------------

export function useCurrentProfile() {
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) setProfile(data as unknown as DbProfile);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) load(uid);
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      const uid = sess?.user?.id ?? null;
      setUserId(uid);
      if (uid) load(uid);
      else setProfile(null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => setProfile(payload.new as unknown as DbProfile),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return { profile, loading, userId };
}

export function useAllProfiles(enabled: boolean) {
  const [profiles, setProfiles] = useState<DbProfile[]>([]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) setProfiles(data as unknown as DbProfile[]);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const channel = supabase
      .channel("profiles-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, refresh]);

  return { profiles, refresh };
}

export async function updateProfile(id: string, patch: Partial<DbProfile>) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// ------- system settings -----------------------------------------------------

// `banner` lives in the anon-readable public_settings table so logged-out
// visitors can still see the site-wide notice. Everything else stays in
// system_settings, which now requires an authenticated session to read.
const PUBLIC_KEYS = new Set(["banner"]);
function tableFor(key: keyof SettingsMap): "public_settings" | "system_settings" {
  return PUBLIC_KEYS.has(key as string) ? "public_settings" : "system_settings";
}

export function useSystemSetting<K extends keyof SettingsMap>(key: K) {
  const [value, setValue] = useState<SettingsMap[K] | null>(null);
  const table = tableFor(key);

  const load = useCallback(async () => {
    const { data } = await supabase.from(table).select("value").eq("key", key).maybeSingle();
    if (data) setValue(data.value as unknown as SettingsMap[K]);
  }, [key, table]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`settings:${table}:${key}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `key=eq.${key}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { value: unknown } | undefined;
          if (row && payload.eventType !== "DELETE") setValue(row.value as SettingsMap[K]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [key, table, load]);

  return value;
}

export async function updateSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]) {
  const table = tableFor(key);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from(table).upsert({ key, value: value as any }, { onConflict: "key" });
  if (error) throw error;
}

// ------- role check ----------------------------------------------------------

export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.error("[checkIsAdmin] user_roles read failed:", error);
    return false;
  }
  return !!data;
}

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null | undefined>(undefined);

  // Track identity only. Ignore TOKEN_REFRESHED / INITIAL_SESSION churn
  // so the admin check doesn't thrash on token refresh.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUid(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setCurrentUid(session?.user?.id ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Re-check role only when the user identity actually changes.
  useEffect(() => {
    if (currentUid === undefined) return; // still hydrating session
    if (currentUid === null) { setIsAdmin(false); return; }
    let mounted = true;
    setIsAdmin(null);
    checkIsAdmin(currentUid).then((ok) => { if (mounted) setIsAdmin(ok); });
    return () => { mounted = false; };
  }, [currentUid]);

  return isAdmin;
}

// ------- transactions (posted ledger) ---------------------------------------

export type DbTransaction = {
  id: string;
  user_id: string;
  account: "checking" | "savings";
  posted_at: string;
  description: string;
  amount: number;
  balance_after: number;
  created_at: string;
};

export function useUserLedger(userId: string | null | undefined, account: "checking" | "savings") {
  const [entries, setEntries] = useState<DbTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setEntries([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("transactions").select("*")
      .eq("user_id", userId).eq("account", account)
      .order("posted_at", { ascending: false });
    if (!error && data) setEntries(data as unknown as DbTransaction[]);
    setLoading(false);
  }, [userId, account]);

  useEffect(() => {
    load();
    if (!userId) return;
    const channel = supabase
      .channel(`ledger:${userId}:${account}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, account, load]);

  return { entries, loading, refresh: load };
}

export async function insertTransaction(row: Omit<DbTransaction, "id" | "created_at">) {
  const { error } = await supabase.from("transactions").insert(row);
  if (error) throw error;
}

// ------- pending transactions (queue) ---------------------------------------

export type DbPending = {
  id: string;
  reference: string;
  user_id: string;
  user_name: string;
  method: "Wire" | "ACH" | "Check" | "Crypto" | "Transfer" | string;
  direction: "credit" | "debit";
  amount: number;
  status: "Pending" | "Approved" | "Failed";
  submitted_at: string;
  resolved_at: string | null;
  memo: string | null;
  recipient: string | null;
  recipient_bank: string | null;
  recipient_acct: string | null;
  routing: string | null;
};

export function usePendingQueue(scope: { adminAll?: boolean; userId?: string | null }) {
  const [queue, setQueue] = useState<DbPending[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let q = supabase.from("pending_transactions").select("*").order("submitted_at", { ascending: false });
    if (!scope.adminAll) {
      if (!scope.userId) { setQueue([]); setLoading(false); return; }
      q = q.eq("user_id", scope.userId);
    }
    const { data, error } = await q;
    if (!error && data) setQueue(data as unknown as DbPending[]);
    setLoading(false);
  }, [scope.adminAll, scope.userId]);

  useEffect(() => {
    load();
    const suffix = scope.adminAll ? "all" : (scope.userId ?? "none");
    const channel = supabase
      .channel(`pending_tx:${suffix}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pending_transactions" },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scope.adminAll, scope.userId, load]);

  return { queue, loading, refresh: load };
}

export async function insertPending(row: Omit<DbPending, "id" | "submitted_at" | "resolved_at" | "status"> & { status?: DbPending["status"] }) {
  const { data, error } = await supabase.from("pending_transactions").insert(row).select().single();
  if (error) throw error;
  return data as unknown as DbPending;
}

export async function updatePendingStatus(id: string, status: "Approved" | "Failed") {
  const { error } = await supabase.from("pending_transactions")
    .update({ status, resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

