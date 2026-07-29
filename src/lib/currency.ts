// Global currency layer. Reads the signed-in user's preferred currency from
// their profile row, subscribes to realtime updates, and exposes a `format`
// helper that every user-facing balance/amount component uses so a currency
// change propagates instantly across the entire app.

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/external-supabase";

export type CurrencyCode = "USD" | "GBP" | "EUR" | "CAD" | "AUD" | "JPY" | "CNY";

export const CURRENCIES: Record<CurrencyCode, { label: string; symbol: string; locale: string }> = {
  USD: { label: "US Dollar",          symbol: "$",   locale: "en-US" },
  GBP: { label: "British Pound",      symbol: "£",   locale: "en-GB" },
  EUR: { label: "Euro",               symbol: "€",   locale: "en-IE" },
  CAD: { label: "Canadian Dollar",    symbol: "CA$", locale: "en-CA" },
  AUD: { label: "Australian Dollar",  symbol: "A$",  locale: "en-AU" },
  JPY: { label: "Japanese Yen",       symbol: "¥",   locale: "ja-JP" },
  CNY: { label: "Chinese Yuan",       symbol: "¥",   locale: "zh-CN" },
};

export const COUNTRIES: { code: string; name: string; currency: CurrencyCode }[] = [
  { code: "US", name: "United States",   currency: "USD" },
  { code: "GB", name: "United Kingdom",  currency: "GBP" },
  { code: "DE", name: "Germany",         currency: "EUR" },
  { code: "FR", name: "France",          currency: "EUR" },
  { code: "IT", name: "Italy",           currency: "EUR" },
  { code: "ES", name: "Spain",           currency: "EUR" },
  { code: "IE", name: "Ireland",         currency: "EUR" },
  { code: "CA", name: "Canada",          currency: "CAD" },
  { code: "AU", name: "Australia",       currency: "AUD" },
  { code: "JP", name: "Japan",           currency: "JPY" },
  { code: "CN", name: "China",           currency: "CNY" },
];

export function currencyForCountry(countryCode: string): CurrencyCode {
  return COUNTRIES.find((c) => c.code === countryCode)?.currency ?? "USD";
}

export function formatMoney(amount: number, code: CurrencyCode = "USD"): string {
  const meta = CURRENCIES[code] ?? CURRENCIES.USD;
  try {
    return new Intl.NumberFormat(meta.locale, { style: "currency", currency: code }).format(Number(amount) || 0);
  } catch {
    return `${meta.symbol}${(Number(amount) || 0).toFixed(2)}`;
  }
}

type MoneyContextValue = {
  code: CurrencyCode;
  symbol: string;
  format: (n: number) => string;
  setCurrency: (code: CurrencyCode) => Promise<void>;
};

const MoneyContext = createContext<MoneyContextValue>({
  code: "USD",
  symbol: "$",
  format: (n) => formatMoney(n, "USD"),
  setCurrency: async () => {},
});

export function MoneyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>("USD");
  const [userId, setUserId] = useState<string | null>(null);

  // Track signed-in user identity
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "INITIAL_SESSION") return;
      setUserId(session?.user?.id ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Load currency + subscribe to profile updates
  useEffect(() => {
    if (!userId) { setCode("USD"); return; }
    let cancelled = false;
    supabase.from("profiles").select("currency").eq("id", userId).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      const c = (data?.currency as CurrencyCode) || "USD";
      if (CURRENCIES[c]) setCode(c);
    });
    const channel = supabase
      .channel(`money:${userId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { currency?: string })?.currency as CurrencyCode | undefined;
          if (next && CURRENCIES[next]) setCode(next);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);

  const setCurrency = useCallback(async (next: CurrencyCode) => {
    if (!CURRENCIES[next]) return;
    setCode(next); // optimistic
    if (userId) {
      await supabase.from("profiles").update({ currency: next }).eq("id", userId);
    }
  }, [userId]);

  const value = useMemo<MoneyContextValue>(() => ({
    code,
    symbol: CURRENCIES[code].symbol,
    format: (n: number) => formatMoney(n, code),
    setCurrency,
  }), [code, setCurrency]);

  return createElement(MoneyContext.Provider, { value }, children);
}

export function useMoney(): MoneyContextValue {
  return useContext(MoneyContext);
}
