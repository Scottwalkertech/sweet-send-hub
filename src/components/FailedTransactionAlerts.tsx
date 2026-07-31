// Customer-facing alert: fires the moment an admin declines (marks Failed) one
// of the signed-in user's pending transactions. Listens on Supabase Realtime
// and shows a toast + a dismissible banner. Already-seen failures are tracked
// in localStorage so the alert doesn't repeat on every page load.

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/external-supabase";
import { useMoney } from "@/lib/currency";

type FailedTx = {
  id: string;
  reference: string;
  method: string;
  amount: number;
  memo: string | null;
  recipient: string | null;
};

const SEEN_KEY = "dbw.failed-tx.seen";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function markSeen(id: string) {
  if (typeof window === "undefined") return;
  const next = Array.from(new Set([...readSeen(), id])).slice(-200);
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
}

export function FailedTransactionAlerts() {
  const { format } = useMoney();
  const [userId, setUserId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<FailedTx[]>([]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const announce = useCallback((row: FailedTx) => {
    if (readSeen().includes(row.id)) return;
    markSeen(row.id);
    setAlerts((prev) => (prev.some((a) => a.id === row.id) ? prev : [row, ...prev]));
    toast.error("Transaction failed", {
      description: `${row.method} ${format(Number(row.amount) || 0)}${
        row.recipient ? ` to ${row.recipient}` : ""
      } could not be completed. Ref ${row.reference}.`,
      duration: 12000,
    });
  }, [format]);

  useEffect(() => {
    if (!userId) { setAlerts([]); return; }
    let cancelled = false;

    // Catch failures that landed while the user was away.
    supabase
      .from("pending_transactions")
      .select("id,reference,method,amount,memo,recipient,resolved_at")
      .eq("user_id", userId)
      .eq("status", "Failed")
      .order("resolved_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled || !data) return;
        [...data].reverse().forEach((r) => announce(r as unknown as FailedTx));
      });

    const channel = supabase
      .channel(`failed-tx:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pending_transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as unknown as FailedTx & { status?: string };
          const prevStatus = (payload.old as { status?: string } | null)?.status;
          if (row?.status === "Failed" && prevStatus !== "Failed") announce(row);
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId, announce]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          role="alert"
          className="rounded-xl border border-red-200 bg-white shadow-lg ring-1 ring-red-100 px-4 py-3 flex gap-3"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Transaction failed</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Your {a.method} of{" "}
              <span className="font-semibold text-slate-900">{format(Number(a.amount) || 0)}</span>
              {a.recipient ? ` to ${a.recipient}` : ""} was not completed. No funds have left your
              account. Reference {a.reference}.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss alert"
            onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))}
            className="h-6 w-6 shrink-0 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
