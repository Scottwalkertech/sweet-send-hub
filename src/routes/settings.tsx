import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/external-supabase";
import { CURRENCIES, useMoney, type CurrencyCode } from "@/lib/currency";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — Dynamic Bank of West" },
      { name: "description", content: "Manage your preferred currency, country and profile preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { code, setCurrency, format } = useMoney();
  const [session, setSession] = useState<{ email: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<CurrencyCode>(code);

  useEffect(() => { setSelected(code); }, [code]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      const uid = data.user?.id;
      if (!uid) { navigate({ to: "/" }); return; }
      const { data: prof } = await supabase.from("profiles").select("name,email").eq("id", uid).maybeSingle();
      if (prof && mounted) setSession({ email: prof.email, name: prof.name });
    });
    return () => { mounted = false; };
  }, [navigate]);

  async function save() {
    setSaving(true); setSaved(false);
    await setCurrency(selected);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 py-3">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 text-white">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-b from-amber-300 to-amber-600 text-slate-900 font-bold text-[10px] flex items-center justify-center tracking-wide">DBW</div>
            <div>
              <div className="text-sm font-semibold tracking-wide">DYNAMIC BANK OF WEST</div>
              <div className="text-[11px] text-white/60">Account Settings</div>
            </div>
          </Link>
          <Link to="/" className="text-xs text-white/70 hover:text-amber-300">← Back to dashboard</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100">
            <h1 className="text-xl font-semibold text-slate-900">Account Settings</h1>
            <p className="text-sm text-slate-500 mt-1">
              {session ? <>Signed in as <span className="font-medium text-slate-900">{session.name}</span> · {session.email}</> : "Loading profile…"}
            </p>
          </div>

          <div className="px-8 py-6 space-y-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-semibold">Preferences</div>
              <h2 className="text-lg font-semibold text-slate-900 mt-1">Preferred Currency</h2>
              <p className="text-sm text-slate-500 mt-1">
                All balances, transfers and transaction history across your account will display in this currency instantly.
              </p>
            </div>

            <div className="grid sm:grid-cols-[280px_1fr] gap-4 items-start">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value as CurrencyCode)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
                  <option key={c} value={c}>{CURRENCIES[c].symbol}  {c} — {CURRENCIES[c].label}</option>
                ))}
              </select>
              <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Sample</div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
                  {new Intl.NumberFormat(CURRENCIES[selected].locale, { style: "currency", currency: selected }).format(12480.50)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Currently active: <span className="font-semibold text-slate-900">{format(12480.50)}</span> ({code})</div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={save}
                disabled={saving || selected === code}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-md"
              >
                {saving ? "Saving…" : "Save preferences"}
              </button>
              {saved && <span className="text-sm text-emerald-600 font-medium">✓ Currency updated</span>}
              {selected === code && !saved && <span className="text-xs text-slate-500">No changes to save.</span>}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-8 py-6 text-sm text-slate-600">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Note</div>
          <p className="mt-1">
            Changing currency updates the display symbol and formatting across the app. Balances are stored as numeric values and are not converted — this is a display preference.
          </p>
        </div>
      </div>
    </div>
  );
}
