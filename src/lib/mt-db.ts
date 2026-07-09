// Supabase-backed data layer for admin + client. Everything the Operations
// Console can edit lives here and is broadcast via postgres_changes so client
// dashboards update live without a refresh.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useSystemSetting<K extends keyof SettingsMap>(key: K) {
  const [value, setValue] = useState<SettingsMap[K] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("system_settings").select("value").eq("key", key).maybeSingle();
    if (data) setValue(data.value as unknown as SettingsMap[K]);
  }, [key]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`settings:${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings", filter: `key=eq.${key}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { value: unknown } | undefined;
          if (row && payload.eventType !== "DELETE") setValue(row.value as SettingsMap[K]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [key, load]);

  return value;
}

export async function updateSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("system_settings").upsert({ key, value: value as any }, { onConflict: "key" });
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
