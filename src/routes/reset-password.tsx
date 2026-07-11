import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/external-supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Dynamic Bank of West" },
      { name: "description", content: "Set a new password for your Dynamic Bank of West account." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase recovery links land here with a session already established
    // (either via URL hash detected by the client, or via the PASSWORD_RECOVERY event).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setInfo("");
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== confirm) return setErr("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    setInfo("Password updated. Redirecting to sign in…");
    setTimeout(() => nav({ to: "/" }), 1200);
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-[#0f1420] p-6 shadow-2xl">
        <h1 className="text-lg font-semibold text-white">Reset password</h1>
        <p className="mt-1 text-xs text-slate-400">
          {ready
            ? "Choose a new password for your account."
            : "Open this page from the reset link in your email. Waiting for a recovery session…"}
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">New password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={!ready}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none disabled:opacity-40" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!ready}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none disabled:opacity-40" />
          </div>
          {err && <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
          {info && <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{info}</div>}
          <button disabled={!ready || busy || !pw || !confirm}
            className="w-full rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40">
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
