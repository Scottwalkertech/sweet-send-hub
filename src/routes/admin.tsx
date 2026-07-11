import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useAllProfiles, useSystemSetting, useIsAdmin, updateProfile, updateSetting,
  usePendingQueue, insertTransaction, updatePendingStatus, insertPending,
  type DbProfile, type DepositSettingsDb, type RatesSettings, type LimitsSettings, type BannerSettings,
  type DbPending,
} from "@/lib/mt-db";
import { fmtCurrency, readFileAsDataUrl, type AccountKey } from "@/lib/mt-store";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Treasury Management Console — Dynamic Bank of West" },
      { name: "description", content: "Internal Treasury Management & Operations Console." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<{ email: string; userId: string } | null>(null);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setSession({ email: data.user.email ?? "", userId: data.user.id });
      setBooted(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) setSession({ email: s.user.email ?? "", userId: s.user.id });
      else setSession(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.replace("/");
  }

  if (!booted) return null;
  // Signed-out visitors see the sign-in card (which also hides the console
  // behind operator credentials). Session presence + admin role are the only
  // gates — no sessionStorage flag required.
  if (!session) return <OperatorSignIn />;
  if (isAdmin === null) return <BootingConsole />;
  if (!isAdmin) return <Forbidden email={session.email} />;
  return <AdminConsole email={session.email} userId={session.userId} onLogout={handleLogout} />;
}


function BootingConsole() {
  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex items-center justify-center">
      <div className="text-sm text-slate-400">Verifying operator credentials…</div>
    </div>
  );
}

function Forbidden({ email }: { email: string }) {
  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/");
  }
  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-white">Access denied</h1>
        <p className="mt-2 text-sm text-slate-400">
          The account <span className="text-amber-300">{email}</span> is not authorized for the Operations Console.
        </p>
        <button onClick={signOut} className="mt-6 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
          Sign out
        </button>
      </div>
    </div>
  );
}

function OperatorSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [bootBusy, setBootBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setInfo(""); setShowReset(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) {
      setErr("Invalid credentials or unauthorized account.");
      setShowReset(true);
      return;
    }
    nav({ to: "/admin" });
  }

  async function sendReset() {
    const target = email.trim().toLowerCase();
    if (!target) { setErr("Enter the operator email above, then try reset again."); return; }
    setResetBusy(true); setErr(""); setInfo("");
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetBusy(false);
    if (error) { setErr(error.message); return; }
    setInfo(`Password reset link sent to ${target}. Check your inbox.`);
    setShowReset(false);
  }

  async function bootstrap() {
    setBootBusy(true); setErr(""); setInfo("");
    try {
      const res = await fetch("/api/public/bootstrap-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email && password ? { email: email.trim().toLowerCase(), password } : {}),
      });
      const raw = await res.text();
      let data: { ok?: boolean; error?: string; email?: string; alreadyBootstrapped?: boolean } = {};
      try { data = JSON.parse(raw); } catch {
        setErr(res.status === 404
          ? "Bootstrap endpoint not deployed yet — publish the app, then try again."
          : `Unexpected response (HTTP ${res.status}). Try again in a moment.`);
        return;
      }
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Bootstrap failed. An admin may already exist.");
      } else if (data.alreadyBootstrapped) {
        setInfo("Admin already exists — sign in below.");
      } else {
        setInfo(`Admin created: ${data.email}. Sign in below.`);
        setEmail(data.email ?? "");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bootstrap request failed.");
    } finally {
      setBootBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black">A</div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Restricted Access</div>
            <div className="text-sm font-semibold text-white">Treasury Operator Sign-in</div>
          </div>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-amber-400/20 bg-[#0f1420] p-6 space-y-4 shadow-2xl">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Operator email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username"
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password"
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none tracking-widest" />
          </div>
          {err && <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
          {showReset && (
            <button type="button" onClick={sendReset} disabled={resetBusy || !email}
              className="w-full rounded border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 disabled:opacity-40">
              {resetBusy ? "Sending reset email…" : `Email a password reset link${email ? ` to ${email.trim().toLowerCase()}` : ""}`}
            </button>
          )}
          {info && <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{info}</div>}
          <button disabled={busy || !email || !password}
            className="w-full rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40">
            {busy ? "Verifying…" : "Enter console"}
          </button>
          <div className="pt-2 border-t border-white/5">
            <button type="button" onClick={bootstrap} disabled={bootBusy}
              className="w-full rounded border border-amber-400/30 bg-black/30 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40">
              {bootBusy ? "Bootstrapping…" : "One-click bootstrap admin"}
            </button>
            <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
              Creates the master admin account (defaults to gerhardjames1@gmail.com) and grants the admin role.
              Fill in email + password above to override the defaults. Disabled once an admin exists.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------

function AdminConsole({ email, userId, onLogout }: { email: string; userId: string; onLogout: () => void }) {
  const { profiles } = useAllProfiles(true);
  const deposit = useSystemSetting("deposit");
  const rates = useSystemSetting("rates");
  const limits = useSystemSetting("limits");
  const banner = useSystemSetting("banner");
  const { queue } = usePendingQueue({ adminAll: true });
  const [editing, setEditing] = useState<DbProfile | null>(null);
  const [toast, setToast] = useState("");

  function flash(m: string) { setToast(m); setTimeout(() => setToast(""), 2600); }

  async function approve(tx: DbPending) {
    if (tx.status !== "Pending") return;
    try {
      const p = profiles.find((x) => x.id === tx.user_id);
      if (p) {
        const delta = tx.direction === "credit" ? Number(tx.amount) : -Number(tx.amount);
        const newBal = Math.max(0, Number(p.balance) + delta);
        await updateProfile(p.id, { balance: newBal });
        await insertTransaction({
          user_id: p.id, account: "checking",
          posted_at: new Date().toISOString(),
          description: `${tx.method} ${tx.direction === "credit" ? "deposit" : "debit"} · ${tx.reference}`,
          amount: delta, balance_after: newBal,
        });
      }
      await updatePendingStatus(tx.id, "Approved");
      flash(`Approved ${fmtCurrency(Number(tx.amount))} for ${tx.user_name}`);
    } catch (e) {
      flash(`Approve failed: ${(e as Error).message}`);
    }
  }
  async function fail(tx: DbPending) {
    if (tx.status !== "Pending") return;
    try {
      await updatePendingStatus(tx.id, "Failed");
      flash(`Marked ${tx.reference} as failed`);
    } catch (e) {
      flash(`Mark-failed failed: ${(e as Error).message}`);
    }
  }

  const pendingCount = queue.filter((q) => q.status === "Pending").length;
  const totalAum = profiles.reduce((s, p) => s + Number(p.balance) + Number(p.savings_balance), 0);


  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100">
      <header className="border-b border-amber-500/20 bg-[#0f1420]">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black">A</div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Restricted Console · Live-synced</div>
              <div className="text-sm font-semibold">Dynamic Bank of West · Treasury Management</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-medium text-white">Treasury Operator</span>
              <span className="text-[10px] text-slate-500">{email}</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />SuperAdmin
            </span>
            <Link to="/" className="text-xs text-slate-400 hover:text-amber-400">Portal</Link>
            <button onClick={onLogout} className="rounded border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total Customers" value={String(profiles.length)} accent="text-amber-400" />
        <Stat label="Assets Under Management" value={fmtCurrency(totalAum)} accent="text-emerald-400" />
        <Stat label="Pending Requests" value={String(pendingCount)} accent="text-cyan-400" />
      </div>

      <section className="mx-auto max-w-7xl px-4 mt-8">
        <SectionHeader title="System Controls" subtitle="Interest rates, default limits, and the global banner. Every change broadcasts live to signed-in customers." />
        <SystemControlsPanel rates={rates} limits={limits} banner={banner} onFlash={flash} />
      </section>

      <section className="mx-auto max-w-7xl px-4 mt-8">
        <SectionHeader title="Global Deposit Settings" subtitle="Edit the wire instructions and Bitcoin deposit address shown to every customer." />
        <DepositSettingsPanel settings={deposit} onSaved={() => flash("Deposit settings saved.")} />
      </section>

      <section className="mx-auto max-w-7xl px-4 mt-10">
        <SectionHeader title="User Management" subtitle="Full override control over every customer profile. Edits push to the database and stream to customers in real time." />
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0f1420]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <Th>Customer</Th><Th>Account</Th><Th>Tier</Th><Th>Status</Th>
                  <Th>Debit</Th><Th className="text-right">Balance</Th><Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <Td>
                      <div className="flex items-center gap-3">
                        {u.profile_picture
                          ? <img src={u.profile_picture} alt="" className="h-9 w-9 rounded-full object-cover border border-white/10" />
                          : <div className="h-9 w-9 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center">{u.name.slice(0, 1).toUpperCase() || "?"}</div>}
                        <div>
                          <div className="font-medium text-white">{u.name || "(no name)"}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-mono text-xs text-slate-300">•••• {u.account_number.slice(-4)}</Td>
                    <Td><TierPill tier={u.tier} /></Td>
                    <Td><StatusPill status={u.status} /></Td>
                    <Td>{u.debit_frozen ? <span className="text-red-300 text-xs">Frozen</span> : <span className="text-emerald-300 text-xs">OK</span>}</Td>
                    <Td className="text-right font-mono text-white">{fmtCurrency(Number(u.balance))}</Td>
                    <Td className="text-right">
                      <button onClick={() => setEditing(u)}
                        className="rounded border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300 hover:bg-amber-400/20">
                        Edit
                      </button>
                    </Td>
                  </tr>
                ))}
                {profiles.length === 0 && <tr><Td className="text-center text-slate-500 py-8">No customer profiles yet — new signups appear here automatically.</Td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 mt-10">
        <TemplateRepositoryPanel profiles={profiles} flash={flash} />
      </section>

      <section className="mx-auto max-w-7xl px-4 mt-10 pb-16">
        <SectionHeader title="Transaction Queue" subtitle="All customer deposit and transfer requests awaiting review." />
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0f1420]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <Th>Reference</Th><Th>Customer</Th><Th>Method</Th><Th>Direction</Th>
                  <Th>Submitted</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((tx) => (
                  <tr key={tx.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <Td className="font-mono text-xs text-amber-300">{tx.reference}</Td>
                    <Td className="text-white">{tx.user_name}</Td>
                    <Td><MethodPill method={tx.method} /></Td>
                    <Td className="text-xs text-slate-400">{tx.direction === "credit" ? "Credit ↓" : "Debit ↑"}</Td>
                    <Td className="text-slate-400 text-xs">{tx.submitted_at.slice(0, 10)}</Td>
                    <Td className={`text-right font-mono ${tx.direction === "credit" ? "text-emerald-300" : "text-red-300"}`}>{tx.direction === "credit" ? "+" : "-"}{fmtCurrency(Number(tx.amount))}</Td>

                    <Td><TxStatus status={tx.status} /></Td>
                    <Td className="text-right">
                      <div className="inline-flex gap-2">
                        <button disabled={tx.status !== "Pending"} onClick={() => approve(tx)} className="rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-30">Approve</button>
                        <button disabled={tx.status !== "Pending"} onClick={() => fail(tx)} className="rounded border border-red-400/40 bg-red-400/10 px-3 py-1 text-xs text-red-300 hover:bg-red-400/20 disabled:opacity-30">Fail</button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {queue.length === 0 && <tr><Td className="text-center text-slate-500 py-8">No transactions in queue.</Td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {editing && (
        <EditProfileModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); flash("Profile updated. Changes are live for this customer."); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 shadow-lg backdrop-blur">{toast}</div>
      )}
    </div>
  );
}

// -- System Controls ---------------------------------------------------------

function SystemControlsPanel({
  rates, limits, banner, onFlash,
}: {
  rates: RatesSettings | null;
  limits: LimitsSettings | null;
  banner: BannerSettings | null;
  onFlash: (m: string) => void;
}) {
  const [checkingApy, setCheckingApy] = useState("");
  const [savingsApy, setSavingsApy] = useState("");
  const [defaultLimit, setDefaultLimit] = useState("");
  const [wireCutoff, setWireCutoff] = useState("");
  const [bnEnabled, setBnEnabled] = useState(false);
  const [bnTone, setBnTone] = useState<BannerSettings["tone"]>("info");
  const [bnMessage, setBnMessage] = useState("");

  useEffect(() => {
    if (rates) { setCheckingApy(String(rates.checkingApy)); setSavingsApy(String(rates.savingsApy)); }
  }, [rates]);
  useEffect(() => {
    if (limits) { setDefaultLimit(String(limits.defaultDailyLimit)); setWireCutoff(String(limits.wireCutoffHour)); }
  }, [limits]);
  useEffect(() => {
    if (banner) { setBnEnabled(banner.enabled); setBnTone(banner.tone); setBnMessage(banner.message); }
  }, [banner]);

  async function saveRates() {
    await updateSetting("rates", { checkingApy: Number(checkingApy) || 0, savingsApy: Number(savingsApy) || 0 });
    onFlash("Interest rates broadcast to all customers.");
  }
  async function saveLimits() {
    await updateSetting("limits", { defaultDailyLimit: Number(defaultLimit) || 0, wireCutoffHour: Number(wireCutoff) || 16 });
    onFlash("Transaction limits saved.");
  }
  async function saveBanner() {
    await updateSetting("banner", { enabled: bnEnabled, tone: bnTone, message: bnMessage });
    onFlash("Banner updated — visible everywhere immediately.");
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-[#0f1420] p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Interest Rates (APY %)</div>
        <div className="mt-4 space-y-3">
          <DarkField label="Everyday Checking APY"><input value={checkingApy} onChange={(e) => setCheckingApy(e.target.value)} type="number" step="0.01" className={`${inputDark} font-mono`} /></DarkField>
          <DarkField label="Way2Save Savings APY"><input value={savingsApy} onChange={(e) => setSavingsApy(e.target.value)} type="number" step="0.01" className={`${inputDark} font-mono`} /></DarkField>
          <button onClick={saveRates} className="w-full rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-xs font-semibold text-black hover:brightness-110">Publish rates</button>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0f1420] p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Transaction Parameters</div>
        <div className="mt-4 space-y-3">
          <DarkField label="Default daily transfer limit ($)"><input value={defaultLimit} onChange={(e) => setDefaultLimit(e.target.value)} type="number" className={`${inputDark} font-mono`} /></DarkField>
          <DarkField label="Wire cutoff hour (0–23)"><input value={wireCutoff} onChange={(e) => setWireCutoff(e.target.value)} type="number" min="0" max="23" className={`${inputDark} font-mono`} /></DarkField>
          <button onClick={saveLimits} className="w-full rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-xs font-semibold text-black hover:brightness-110">Publish limits</button>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0f1420] p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Global Banner</div>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={bnEnabled} onChange={(e) => setBnEnabled(e.target.checked)} className="h-3.5 w-3.5 accent-amber-500" /> Enabled
          </label>
        </div>
        <div className="mt-4 space-y-3">
          <DarkField label="Tone">
            <select value={bnTone} onChange={(e) => setBnTone(e.target.value as BannerSettings["tone"])} className={inputDark}>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </DarkField>
          <DarkField label="Message">
            <textarea value={bnMessage} onChange={(e) => setBnMessage(e.target.value)} rows={2} className={inputDark} placeholder="e.g. Scheduled maintenance Sunday 3am ET." />
          </DarkField>
          <button onClick={saveBanner} className="w-full rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-xs font-semibold text-black hover:brightness-110">Publish banner</button>
        </div>
      </div>
    </div>
  );
}

// -- Deposit settings --------------------------------------------------------

function DepositSettingsPanel({ settings, onSaved }: { settings: DepositSettingsDb | null; onSaved: () => void }) {
  const [draft, setDraft] = useState<DepositSettingsDb | null>(settings);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(settings); }, [settings]);
  if (!draft) return <div className="mt-4 text-xs text-slate-500">Loading deposit settings…</div>;

  async function pickQr(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !draft) return;
    const dataUrl = await readFileAsDataUrl(f);
    setDraft({ ...draft, btcQrDataUrl: dataUrl });
  }
  async function save() {
    if (!draft) return;
    await updateSetting("deposit", draft);
    onSaved();
  }

  return (
    <div className="mt-4 grid lg:grid-cols-[1fr_260px] gap-4">
      <div className="rounded-xl border border-white/10 bg-[#0f1420] p-6 grid sm:grid-cols-2 gap-3">
        <DarkField label="Bank name"><input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} className={inputDark} /></DarkField>
        <DarkField label="Routing / ABA"><input value={draft.routing} onChange={(e) => setDraft({ ...draft, routing: e.target.value })} className={inputDark} /></DarkField>
        <DarkField label="Beneficiary"><input value={draft.beneficiary} onChange={(e) => setDraft({ ...draft, beneficiary: e.target.value })} className={inputDark} /></DarkField>
        <DarkField label="Account number"><input value={draft.accountNumber} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} className={inputDark} /></DarkField>
        <DarkField label="SWIFT / BIC"><input value={draft.swift} onChange={(e) => setDraft({ ...draft, swift: e.target.value })} className={inputDark} /></DarkField>
        <DarkField label="Bank address"><input value={draft.bankAddress} onChange={(e) => setDraft({ ...draft, bankAddress: e.target.value })} className={inputDark} /></DarkField>
        <div className="sm:col-span-2">
          <DarkField label="Bitcoin (BTC) wallet address"><input value={draft.btcAddress} onChange={(e) => setDraft({ ...draft, btcAddress: e.target.value })} className={`${inputDark} font-mono`} /></DarkField>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button onClick={save} className="rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-xs font-semibold text-black hover:brightness-110">Save deposit settings</button>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0f1420] p-6 flex flex-col items-center gap-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">BTC QR image</div>
        {draft.btcQrDataUrl
          ? <img src={draft.btcQrDataUrl} alt="BTC QR" className="h-40 w-40 rounded-md object-contain bg-white p-2" />
          : <div className="h-40 w-40 rounded-md border-2 border-dashed border-white/10 flex items-center justify-center text-slate-500 text-xs">No QR uploaded</div>}
        <input ref={fileRef} type="file" accept="image/*" onChange={pickQr} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="w-full rounded border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Upload QR image</button>
        {draft.btcQrDataUrl && (
          <button onClick={() => setDraft({ ...draft, btcQrDataUrl: "" })} className="text-[10px] text-red-300 hover:text-red-200">Remove QR</button>
        )}
      </div>
    </div>
  );
}

// -- Profile edit modal ------------------------------------------------------

function EditProfileModal({ profile, onClose, onSaved }: { profile: DbProfile; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<DbProfile>(profile);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPic(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const dataUrl = await readFileAsDataUrl(f);
    setDraft({ ...draft, profile_picture: dataUrl });
  }
  const enr = draft.enrollments ?? { smallBusiness: false, commercial: false, wire: false };
  const svc = draft.service_balances ?? { smallBusiness: 0, commercial: 0, wire: 0 };
  function setEnr(patch: Partial<typeof enr>) {
    setDraft({ ...draft, enrollments: { ...enr, ...patch } });
  }
  function setSvc(patch: Partial<typeof svc>) {
    setDraft({ ...draft, service_balances: { ...svc, ...patch } });
  }

  async function save() {
    if (!draft.name.trim() || !draft.email.trim()) { setErr("Name and email required."); return; }
    setBusy(true);
    try {
      await updateProfile(profile.id, {
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone,
        address: draft.address,
        tier: draft.tier,
        status: draft.status,
        verified: draft.verified,
        debit_frozen: draft.debit_frozen,
        daily_limit: Number(draft.daily_limit) || 0,
        balance: Number(draft.balance) || 0,
        savings_balance: Number(draft.savings_balance) || 0,
        profile_picture: draft.profile_picture,
        enrollments: enr,
        service_balances: {
          smallBusiness: Number(svc.smallBusiness) || 0,
          commercial: Number(svc.commercial) || 0,
          wire: Number(svc.wire) || 0,
        },
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-amber-400/30 bg-[#0f1420] p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Edit Customer Profile</div>
        <h3 className="mt-1 text-lg font-semibold text-white">{profile.name || profile.email}</h3>

        <div className="mt-5 flex items-center gap-4">
          {draft.profile_picture
            ? <img src={draft.profile_picture} alt="" className="h-16 w-16 rounded-full object-cover border border-white/10" />
            : <div className="h-16 w-16 rounded-full bg-slate-700 text-white text-lg flex items-center justify-center">{(draft.name || "?").slice(0, 1).toUpperCase()}</div>}
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPic} className="hidden" />
          <div className="flex flex-col gap-1">
            <button onClick={() => fileRef.current?.click()} className="rounded border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Upload profile picture</button>
            {draft.profile_picture && <button onClick={() => setDraft({ ...draft, profile_picture: null })} className="text-[10px] text-red-300 hover:text-red-200 text-left">Remove picture</button>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DarkField label="Full Name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputDark} /></DarkField>
          <DarkField label="Email"><input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputDark} /></DarkField>
          <DarkField label="Phone"><input value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputDark} /></DarkField>
          <DarkField label="Address"><input value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className={inputDark} /></DarkField>
          <DarkField label="Checking Balance (USD)"><input type="number" step="0.01" value={draft.balance} onChange={(e) => setDraft({ ...draft, balance: Number(e.target.value) })} className={`${inputDark} font-mono`} /></DarkField>
          <DarkField label="Way2Save Savings Balance (USD)"><input type="number" step="0.01" value={draft.savings_balance} onChange={(e) => setDraft({ ...draft, savings_balance: Number(e.target.value) })} className={`${inputDark} font-mono`} /></DarkField>
          <DarkField label="Daily Transfer Limit ($)"><input type="number" value={draft.daily_limit} onChange={(e) => setDraft({ ...draft, daily_limit: Number(e.target.value) })} className={`${inputDark} font-mono`} /></DarkField>
          <DarkField label="Tier">
            <select value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })} className={inputDark}>
              {["Standard", "Premier", "Private", "Business"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </DarkField>
          <DarkField label="Status">
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={inputDark}>
              {["Active", "Frozen", "Review"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </DarkField>
          <label className="flex items-center gap-2 text-sm text-white mt-6">
            <input type="checkbox" checked={draft.debit_frozen} onChange={(e) => setDraft({ ...draft, debit_frozen: e.target.checked })} className="h-4 w-4 accent-amber-500" />
            Freeze debit card
          </label>
          <label className="flex items-center gap-2 text-sm text-white mt-6">
            <input type="checkbox" checked={draft.verified} onChange={(e) => setDraft({ ...draft, verified: e.target.checked })} className="h-4 w-4 accent-amber-500" />
            Identity verified
          </label>
        </div>

        <div className="mt-6 rounded-lg border border-amber-400/20 bg-black/30 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Specialized Services · Enrollment & Balances</div>
          <p className="text-[11px] text-slate-400 mt-1">Toggle enrollment to unlock the section for the customer. Balance fields override the ledger amount displayed on their dashboard.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ServicePanel
              title="Wire Services"
              enrolled={!!enr.wire}
              onToggle={(v) => setEnr({ wire: v })}
              balance={svc.wire ?? 0}
              onBalance={(v) => setSvc({ wire: v })}
            />
            <ServicePanel
              title="Small Business Banking"
              enrolled={!!enr.smallBusiness}
              onToggle={(v) => setEnr({ smallBusiness: v })}
              balance={svc.smallBusiness ?? 0}
              onBalance={(v) => setSvc({ smallBusiness: v })}
            />
            <ServicePanel
              title="Commercial Accounts"
              enrolled={!!enr.commercial}
              onToggle={(v) => setEnr({ commercial: v })}
              balance={svc.commercial ?? 0}
              onBalance={(v) => setSvc({ commercial: v })}
            />
          </div>
        </div>

        {err && <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}


        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-white/10 px-4 py-2 text-xs hover:bg-white/5">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-xs font-semibold text-black hover:brightness-110 disabled:opacity-40">
            {busy ? "Saving…" : "Save & broadcast"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Merchant template repository (writes to profiles.balance + local ledger) -

type MerchantTemplate = {
  key: string; merchant: string; category: string;
  descriptions: string[]; min: number; max: number;
  direction: "debit" | "credit";
};

const MERCHANT_TEMPLATES: MerchantTemplate[] = [
  { key: "starbucks", merchant: "Starbucks", category: "Coffee & Food", descriptions: ["STARBUCKS STORE #4471 SEATTLE WA", "STARBUCKS #22910 LOS ANGELES CA"], min: 4.75, max: 18.9, direction: "debit" },
  { key: "att", merchant: "AT&T", category: "Telecom", descriptions: ["AT&T *PAYMENT 800-288-2020 TX", "AT&T WIRELESS AUTOPAY"], min: 65, max: 189.4, direction: "debit" },
  { key: "verizon", merchant: "Verizon", category: "Telecom", descriptions: ["VERIZON WRLS MYACCT VW"], min: 70, max: 245.75, direction: "debit" },
  { key: "walmart", merchant: "Walmart", category: "Retail", descriptions: ["WAL-MART SUPERCENTER #1287", "WALMART.COM 800-966-6546 AR"], min: 14.5, max: 312.6, direction: "debit" },
  { key: "amazon", merchant: "Amazon", category: "E-commerce", descriptions: ["AMZN Mktp US*RT7Y21P43", "AMAZON.COM*MK9J812TA"], min: 8.99, max: 429.15, direction: "debit" },
  { key: "target", merchant: "Target", category: "Retail", descriptions: ["TARGET T-0912 LOS ANGELES", "TARGET.COM * 800-591-3869"], min: 12.75, max: 267.4, direction: "debit" },
  { key: "bestbuy", merchant: "Best Buy", category: "Electronics", descriptions: ["BEST BUY #0428 BURBANK CA"], min: 24.5, max: 899, direction: "debit" },
  { key: "netflix", merchant: "Netflix", category: "Subscription", descriptions: ["NETFLIX.COM LOS GATOS CA"], min: 15.49, max: 22.99, direction: "debit" },
  { key: "payroll", merchant: "Payroll Direct Deposit", category: "Payroll", descriptions: ["DIRECT DEP PAYROLL EMPLR CO", "ACH CREDIT PAYROLL 072118"], min: 1850, max: 6420, direction: "credit" },
  { key: "irs", merchant: "IRS Refund", category: "Government", descriptions: ["IRS TREAS 310 TAX REF"], min: 420, max: 3890, direction: "credit" },
  { key: "zelle_in", merchant: "Zelle Transfer", category: "P2P Credit", descriptions: ["ZELLE FROM SMITH J 991284"], min: 40, max: 1250, direction: "credit" },
  { key: "stripe_payout", merchant: "Stripe Payout", category: "Merchant Payout", descriptions: ["STRIPE TRANSFER ST-K4XY71"], min: 210, max: 8420, direction: "credit" },
  { key: "wire_in", merchant: "Incoming Wire", category: "Wire Credit", descriptions: ["FEDWIRE CREDIT REF 20260708"], min: 500, max: 18500, direction: "credit" },
  { key: "interest", merchant: "Interest Earned", category: "Interest", descriptions: ["INTEREST PAYMENT — MONTHLY"], min: 0.42, max: 84.6, direction: "credit" },
  { key: "refund", merchant: "Merchant Refund", category: "Refund", descriptions: ["AMAZON.COM REFUND 8827001"], min: 9.99, max: 349.5, direction: "credit" },
];

function rand(min: number, max: number) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }
function randChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

async function injectRow(profile: DbProfile, account: AccountKey, description: string, amount: number, direction: "debit" | "credit", dateIso: string) {
  const signed = direction === "credit" ? amount : -amount;
  const currentDb = account === "checking" ? Number(profile.balance) : Number(profile.savings_balance);
  const newBal = Math.round((currentDb + signed) * 100) / 100;
  // Push balance change to profile (realtime broadcasts to the customer)
  await updateProfile(profile.id, account === "checking" ? { balance: newBal } : { savings_balance: newBal });
  // Write ledger entry to the transactions table so the customer's account page updates live.
  await insertTransaction({
    user_id: profile.id,
    account,
    posted_at: dateIso,
    description,
    amount: signed,
    balance_after: newBal,
  });
}


function TemplateRepositoryPanel({ profiles, flash }: { profiles: DbProfile[]; flash: (m: string) => void }) {
  const [targetId, setTargetId] = useState<string>(profiles[0]?.id ?? "");
  const [account, setAccount] = useState<AccountKey>("checking");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  useEffect(() => { if (!targetId && profiles[0]) setTargetId(profiles[0].id); }, [profiles, targetId]);

  function amountFor(t: MerchantTemplate): number {
    const raw = customAmounts[t.key]?.trim();
    if (raw) { const n = Number(raw); if (!Number.isNaN(n) && n > 0) return Math.round(n * 100) / 100; }
    return rand(t.min, t.max);
  }

  async function inject(t: MerchantTemplate) {
    const target = profiles.find((p) => p.id === targetId);
    if (!target) { flash("Select a client profile first."); return; }
    const amt = amountFor(t);
    const desc = randChoice(t.descriptions);
    await injectRow(target, account, desc, amt, t.direction, new Date().toISOString());
    flash(`Injected ${t.direction === "credit" ? "+" : "-"}${fmtCurrency(amt)} · ${t.merchant}`);
  }

  async function simulateMonthly() {
    const target = profiles.find((p) => p.id === targetId);
    if (!target) { flash("Select a client profile first."); return; }
    const count = 5 + Math.floor(Math.random() * 3);
    const pool = [...MERCHANT_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, count);
    const batch = pool.map((t) => ({ t, amt: amountFor(t), date: new Date(Date.now() - Math.floor(Math.random() * 30 * 86400000)).toISOString(), desc: randChoice(t.descriptions) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    let cr = 0, dr = 0;
    for (const r of batch) {
      // Re-read latest target from state to stay in sync
      const latest = profiles.find((p) => p.id === targetId)!;
      await injectRow(latest, account, r.desc, r.amt, r.t.direction, r.date);
      if (r.t.direction === "credit") cr += r.amt; else dr += r.amt;
    }
    flash(`Simulated ${batch.length} entries · +${fmtCurrency(cr)} / -${fmtCurrency(dr)}`);
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <SectionHeader title="Transaction Template Repository" subtitle="Internal ledger injection tools. Rows appear as ordinary production entries in the client-facing view." />
        <button onClick={simulateMonthly} disabled={!targetId}
          className="inline-flex items-center gap-2 rounded-md border border-amber-400/50 bg-gradient-to-b from-amber-400/25 to-amber-600/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-amber-200 hover:from-amber-400/40 disabled:opacity-30">
          ⚡ Simulate Complete Monthly Activity
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-[#0f1420] p-5">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 mb-5">
          <DarkField label="Target Client Profile">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputDark}>
              {profiles.map((u) => <option key={u.id} value={u.id}>{u.name || u.email} — •••• {u.account_number.slice(-4)}</option>)}
            </select>
          </DarkField>
          <DarkField label="Destination Account">
            <select value={account} onChange={(e) => setAccount(e.target.value as AccountKey)} className={inputDark}>
              <option value="checking">Everyday Checking</option>
              <option value="savings">Way2Save Savings</option>
            </select>
          </DarkField>
          <div className="rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] leading-relaxed text-amber-200/80 flex items-center">
            Leave "Custom Amount" blank to use the merchant bracket range. Any numeric value overrides the bracket exactly.
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MERCHANT_TEMPLATES.map((t) => {
            const isCredit = t.direction === "credit";
            return (
              <div key={t.key} className={`rounded-lg border p-3 flex flex-col gap-2 transition ${isCredit ? "border-emerald-400/20 bg-emerald-500/[0.04] hover:border-emerald-400/50" : "border-white/10 bg-black/30 hover:border-amber-400/40"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{t.merchant}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">{t.category}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${isCredit ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-red-400/40 bg-red-400/10 text-red-300"}`}>
                      {isCredit ? "Credit" : "Debit"}
                    </span>
                    <div className="text-[10px] font-mono text-slate-400 text-right">{fmtCurrency(t.min)}–{fmtCurrency(t.max)}</div>
                  </div>
                </div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                  Custom Amount ($)
                  <input type="number" step="0.01" min="0" placeholder="auto"
                    value={customAmounts[t.key] ?? ""}
                    onChange={(e) => setCustomAmounts({ ...customAmounts, [t.key]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-2 py-1.5 text-xs font-mono text-white focus:border-amber-400 focus:outline-none" />
                </label>
                <button onClick={() => inject(t)} disabled={!targetId}
                  className={`mt-1 rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 ${isCredit ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20" : "border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"}`}>
                  {isCredit ? "Inject Deposit" : "Inject Charge"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// -- primitives --------------------------------------------------------------

const inputDark = "mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none";
function DarkField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs uppercase tracking-wider text-slate-400">{label}{children}</label>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1420] p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
function TierPill({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    Standard: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    Premier: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    Private: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300",
    Business: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
  };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[tier] ?? map.Standard}`}>{tier}</span>;
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    Frozen: "border-red-400/40 bg-red-400/10 text-red-300",
    Review: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[status] ?? map.Active}`}>{status}</span>;
}
function TxStatus({ status }: { status: DbPending["status"] }) {
  const map = {
    Pending: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    Approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    Failed: "border-red-400/40 bg-red-400/10 text-red-300",
  } as const;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[status]}`}>{status}</span>;
}
function MethodPill({ method }: { method: DbPending["method"] }) {
  return <span className="inline-block rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">{method}</span>;

}
