import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  loadUsers, upsertUser, setCurrentUserId, currentUser,
  loadQueue, onStoreChange, fmtCurrency, readFileAsDataUrl,
  type MtUser, type PendingTx,
} from "@/lib/mt-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dynamic Bank of West — Online Banking" },
      { name: "description", content: "Secure online banking portal." },
    ],
  }),
  component: App,
});

function App() {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<MtUser | null>(null);

  useEffect(() => {
    setUser(currentUser());
    setBooted(true);
    const off = onStoreChange(() => setUser(currentUser()));
    return off;
  }, []);

  if (!booted) return null;
  if (!user) return <Login onAuth={(u) => { setCurrentUserId(u.id); setUser(u); }} />;
  return <Dashboard user={user} onLogout={() => { setCurrentUserId(null); setUser(null); }} />;
}

function Login({ onAuth }: { onAuth: (u: MtUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const users = loadUsers();
    const match = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    );
    if (!match) { setErr("Invalid credentials. Only registered DBW customer accounts may sign in."); return; }
    if (!match.verified) { setErr("This account has not completed phone/email verification."); return; }
    if (match.status === "Frozen") { setErr("This account is frozen. Contact support at 1-800-DBW-BANK."); return; }
    window.dispatchEvent(new Event("ptl:show"));
    setTimeout(() => onAuth(match), 900);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-[11px] tracking-wide">DBW</div>
          <div>
            <div className="text-xl font-semibold text-slate-900">Dynamic Bank of West</div>
            <div className="text-xs text-slate-500">Secure Online Banking</div>
          </div>
        </div>
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-5">
          <h1 className="text-lg font-semibold text-slate-900">Sign in to your account</h1>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="you@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 tracking-widest" placeholder="••••••••" />
          </div>
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>}
          <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-md">
            Sign in securely
          </button>
          <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-100">
            🔒 256-bit TLS encryption · FDIC Insured
          </div>
          <div className="text-xs text-center text-slate-600">
            New to Dynamic Bank of West?{" "}
            <Link to="/signup" className="text-amber-700 hover:text-amber-900 font-medium">Open an account →</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }: { user: MtUser; onLogout: () => void }) {
  const navigate = useNavigate();
  const [activePending, setActivePending] = useState<PendingTx | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    function refresh() {
      const q = loadQueue().filter((t) => t.userId === user.id);
      const pending = q.find((t) => t.status === "Pending" && t.method === "Transfer");
      setActivePending(pending ?? null);
    }
    refresh();
    const off = onStoreChange(refresh);
    const i = setInterval(refresh, 1200);
    return () => { off(); clearInterval(i); };
  }, [user.id]);

  const userHistory = loadQueue()
    .filter((t) => t.userId === user.id && t.status !== "Pending")
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="bg-slate-900">
          <div className="max-w-6xl mx-auto px-6 py-1.5 flex items-center justify-end gap-6 text-[11px] tracking-wide uppercase">
            <span className="text-white/60">Personal Banking</span>
            <span className="text-white/60">·</span>
            <span className="text-amber-300">Member FDIC</span>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-[10px] tracking-wide">DBW</div>
            <div>
              <div className="text-sm font-semibold text-slate-900 tracking-wide">DYNAMIC BANK OF WEST</div>
              <div className="text-xs text-slate-500">Personal Banking</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 hidden sm:inline">Hello, {user.name.split(" ")[0]}</span>
            <button onClick={() => setShowProfile(true)} className="h-9 w-9 rounded-full overflow-hidden bg-slate-200 border border-slate-300 hover:ring-2 hover:ring-amber-400 transition">
              {user.profilePicture
                ? <img src={user.profilePicture} alt="Profile" className="h-full w-full object-cover" />
                : <div className="h-full w-full flex items-center justify-center text-sm text-slate-600 font-semibold">{user.name.slice(0, 1)}</div>}
            </button>
            <button onClick={onLogout} className="text-sm text-slate-600 hover:text-slate-900">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Balance card */}
        <section className="rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white px-8 py-10 relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent_60%)]" />
            <div className="relative flex items-start justify-between flex-wrap gap-6">
              <div>
                <div className="flex items-center gap-2 text-amber-300 text-xs uppercase tracking-[0.2em] font-semibold">
                  <span className="h-px w-8 bg-amber-400" />
                  Primary Account
                </div>
                <h1 className="text-2xl font-semibold mt-3 tracking-wide">Everyday Checking</h1>
                <div className="text-xs text-amber-200/80 mt-1 tabular-nums">
                  Account {user.account} · Routing 121000248
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-amber-200/80">Available Balance</div>
                <div className="text-4xl font-semibold tabular-nums mt-1 bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-transparent">
                  {fmtCurrency(user.balance)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Deposit CTA directly beneath the balance card */}
        <section className="flex justify-center">
          <Link
            to="/deposit"
            className="group inline-flex items-center gap-3 rounded-xl border border-emerald-600/40 bg-gradient-to-b from-slate-900 to-slate-800 px-8 py-3.5 text-sm font-semibold text-white shadow-md ring-1 ring-inset ring-white/5 hover:from-slate-800 hover:to-slate-700 hover:border-emerald-400/60 transition-all"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300 text-lg leading-none group-hover:bg-emerald-500/25">+</span>
            <span className="tracking-wide">Deposit Funds</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80 border-l border-white/10 pl-3 ml-1">Enterprise Secure</span>
          </Link>
        </section>

        {/* Quick actions */}
        <section className="grid sm:grid-cols-3 gap-3">
          <QuickAction to="/transfer" title="Send money" subtitle="External transfer" />
          <QuickAction to="/deposit" title="Deposit" subtitle="Wire · ACH · Crypto" />
          <QuickAction to="/signup" title="Refer a friend" subtitle="Invite to DBW" />
        </section>

        {/* Transaction history (resolved only) */}
        <section className="bg-white border border-slate-200 rounded-xl">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Ledger — Resolved Transactions</h2>
              <p className="text-xs text-slate-500 mt-0.5">{userHistory.length} entries · pending items stay in review</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                  <th className="text-left px-6 py-3 font-medium">Reference</th>
                  <th className="text-left px-6 py-3 font-medium">Type</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                  <th className="text-right px-6 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {userHistory.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">No resolved transactions yet.</td></tr>
                )}
                {userHistory.map((t) => {
                  const isCredit = t.direction === "credit" && t.status === "Approved";
                  const sign = t.status === "Failed" ? "" : (t.direction === "credit" ? "+" : "-");
                  return (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{t.submitted}</td>
                      <td className="px-6 py-3 text-slate-900 font-mono text-xs">{t.reference}</td>
                      <td className="px-6 py-3 text-slate-600">{t.method}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          t.status === "Approved" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700"
                        }`}>{t.status}</span>
                      </td>
                      <td className={`px-6 py-3 text-right font-medium tabular-nums ${
                        t.status === "Failed" ? "text-slate-400 line-through" : isCredit ? "text-emerald-600" : "text-slate-900"
                      }`}>{sign}{fmtCurrency(t.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {activePending && <PendingOverlay tx={activePending} onExit={() => navigate({ to: "/transfer" })} />}
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
    </div>
  );
}

function QuickAction({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Link to={to} className="block bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-amber-400 hover:shadow-sm transition">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
    </Link>
  );
}

function PendingOverlay({ tx, onExit }: { tx: PendingTx; onExit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-slate-900/70 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-600" />
        <div className="px-8 py-8 text-white text-center">
          <div className="mx-auto relative h-20 w-20 mb-5">
            <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
            <div className="relative h-20 w-20 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-3xl">⏳</div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300 font-semibold">Pending Verification</div>
          <h2 className="mt-2 text-xl font-semibold">Your transfer is under compliance review</h2>
          <p className="mt-2 text-sm text-slate-300">
            Reference <span className="font-mono">{tx.reference}</span> for {fmtCurrency(tx.amount)} to {tx.recipient} is awaiting administrator approval. Your dashboard is locked on this screen until it resolves.
          </p>
          <button onClick={onExit} className="mt-6 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold px-5 py-2">
            View processing view
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ user, onClose }: { user: MtUser; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pic, setPic] = useState(user.profilePicture ?? "");
  async function pickPic(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const dataUrl = await readFileAsDataUrl(f);
    setPic(dataUrl);
    upsertUser({ ...user, profilePicture: dataUrl });
  }
  function removePic() {
    setPic("");
    upsertUser({ ...user, profilePicture: undefined });
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="text-xs uppercase tracking-widest text-amber-700 font-semibold">Profile</div>
          <h3 className="text-lg font-semibold text-slate-900 mt-1">{user.name}</h3>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <div className="px-6 py-6 flex flex-col items-center gap-3">
          {pic
            ? <img src={pic} alt="Profile" className="h-28 w-28 rounded-full object-cover border border-slate-200" />
            : <div className="h-28 w-28 rounded-full bg-slate-200 text-slate-600 text-2xl flex items-center justify-center">{user.name.slice(0, 1)}</div>}
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPic} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="rounded-md bg-slate-900 text-white text-xs px-4 py-2 hover:bg-slate-800">Upload profile picture</button>
          {pic && <button onClick={removePic} className="text-[11px] text-red-600 hover:text-red-700">Remove picture</button>}
        </div>
        <div className="px-6 py-4 text-xs text-slate-500 border-t border-slate-100 grid grid-cols-2 gap-2">
          <Kv k="Account" v={user.account} />
          <Kv k="Tier" v={user.tier} />
          <Kv k="Status" v={user.status} />
          <Kv k="Verified" v={user.verified ? "Yes" : "No"} />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">Close</button>
        </div>
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="uppercase tracking-wider text-[10px] text-slate-400">{k}</div>
      <div className="text-slate-900 font-medium mt-0.5">{v}</div>
    </div>
  );
}
