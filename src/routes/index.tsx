import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meridian Trust — Online Banking" },
      { name: "description", content: "Secure online banking portal." },
    ],
  }),
  component: App,
});

type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number; // negative = debit
  category: string;
};

type ChatMsg = {
  id: string;
  from: "user" | "agent";
  text: string;
  ts: number;
};

const LS_AUTH = "mt_auth";
const LS_TX = "mt_tx";
const LS_BAL = "mt_bal";
const LS_CHAT = "mt_chat";

const seedTx: Tx[] = [
  { id: "t1", date: "2026-06-26", description: "Direct Deposit — ACME Payroll", amount: 3420.55, category: "Income" },
  { id: "t2", date: "2026-06-25", description: "Starbucks #4421", amount: -7.85, category: "Dining" },
  { id: "t3", date: "2026-06-24", description: "Target T-1138", amount: -124.62, category: "Shopping" },
  { id: "t4", date: "2026-06-22", description: "Starbucks #4421", amount: -6.40, category: "Dining" },
  { id: "t5", date: "2026-06-20", description: "Direct Deposit — Stripe Payout", amount: 812.10, category: "Income" },
  { id: "t6", date: "2026-06-18", description: "Target T-0098", amount: -58.19, category: "Shopping" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function App() {
  const [authed, setAuthed] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    setAuthed(localStorage.getItem(LS_AUTH) === "1");
    setBooted(true);
  }, []);

  if (!booted) return null;
  return authed ? <Dashboard onLogout={() => { localStorage.removeItem(LS_AUTH); setAuthed(false); }} /> : <Login onAuth={() => { localStorage.setItem(LS_AUTH, "1"); setAuthed(true); }} />;
}

function Login({ onAuth }: { onAuth: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (u.trim().length < 3 || p.length < 4) {
      setErr("Enter your username and password to continue.");
      return;
    }
    onAuth();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold">M</div>
          <div>
            <div className="text-xl font-semibold text-slate-900">Meridian Trust</div>
            <div className="text-xs text-slate-500">Secure Online Banking</div>
          </div>
        </div>
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-5">
          <h1 className="text-lg font-semibold text-slate-900">Sign in to your account</h1>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <input
              type="text"
              autoComplete="username"
              value={u}
              onChange={(e) => setU(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="your.username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={p}
              onChange={(e) => setP(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 tracking-widest"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-slate-500">Password input is masked.</p>
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-md">
            Sign in securely
          </button>
          <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-100">
            🔒 256-bit TLS encryption · FDIC Insured
          </div>
        </form>
      </div>
      <ChatWidget />
    </div>
  );
}

type Segment = "personal" | "business" | "commercial" | "wire";
const SEGMENTS: Record<Segment, { label: string; sub: string; primary: { name: string; number: string; balance: number }; secondary: { name: string; number: string; balance: number } }> = {
  personal: {
    label: "Personal Banking", sub: "Personal Banking",
    primary: { name: "Primary Checking", number: "••••4421", balance: 12480.33 },
    secondary: { name: "High-Yield Savings", number: "••••9087", balance: 48210.00 },
  },
  business: {
    label: "Small Business", sub: "Small Business",
    primary: { name: "Business Checking", number: "••••7702", balance: 8420.55 },
    secondary: { name: "Business Reserve", number: "••••3310", balance: 15200.00 },
  },
  commercial: {
    label: "Commercial Accounts", sub: "Commercial Accounts",
    primary: { name: "Commercial Operating", number: "••••8821", balance: 25000.00 },
    secondary: { name: "Commercial Money Market", number: "••••2244", balance: 142500.00 },
  },
  wire: {
    label: "Wire Services", sub: "Wire Services",
    primary: { name: "Wire Settlement", number: "••••0001", balance: 5000.00 },
    secondary: { name: "FX Reserve", number: "••••0002", balance: 22000.00 },
  },
};

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [balance, setBalance] = useState(12480.33);
  const [savings] = useState(48210.00);
  const [tx, setTx] = useState<Tx[]>(seedTx);
  const [view, setView] = useState<"dashboard" | "profile" | "card">("dashboard");
  const [segment, setSegment] = useState<Segment>("personal");
  const [routingOpen, setRoutingOpen] = useState(false);

  useEffect(() => {
    const b = localStorage.getItem(LS_BAL);
    const t = localStorage.getItem(LS_TX);
    if (b) setBalance(parseFloat(b));
    if (t) { try { setTx(JSON.parse(t)); } catch {} }
  }, []);

  useEffect(() => { localStorage.setItem(LS_BAL, String(balance)); }, [balance]);
  useEffect(() => { localStorage.setItem(LS_TX, JSON.stringify(tx)); }, [tx]);

  useEffect(() => {
    const onProfile = () => setView("profile");
    const onCard = () => setView("card");
    const onRouting = () => setRoutingOpen(true);
    window.addEventListener("mt:view-profile", onProfile);
    window.addEventListener("mt:view-card", onCard);
    window.addEventListener("mt:open-routing", onRouting);
    return () => {
      window.removeEventListener("mt:view-profile", onProfile);
      window.removeEventListener("mt:view-card", onCard);
      window.removeEventListener("mt:open-routing", onRouting);
    };
  }, []);

  const [recipient, setRecipient] = useState("");
  const [routing, setRouting] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  function settle(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!recipient.trim() || !routing.trim() || !amt || amt <= 0) {
      setFlash("Please complete all fields with a valid amount.");
      return;
    }
    if (amt > balance) {
      setFlash("Insufficient funds in primary balance.");
      return;
    }
    const newTx: Tx = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      description: `Transfer to ${recipient}${memo ? ` — ${memo}` : ""}`,
      amount: -amt,
      category: "Transfer",
    };
    setTx([newTx, ...tx]);
    setBalance((b) => +(b - amt).toFixed(2));
    setRecipient(""); setRouting(""); setAmount(""); setMemo("");
    setFlash(`Settled ${fmt(amt)} to ${newTx.description.replace("Transfer to ", "")}.`);
    setTimeout(() => setFlash(null), 4000);
  }

  const seg = SEGMENTS[segment];
  // Personal segment uses live balance; other segments use mock balances
  const primaryBal = segment === "personal" ? balance : seg.primary.balance;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="bg-slate-900">
          <div className="max-w-6xl mx-auto px-6 py-1.5 flex items-center justify-end gap-6 text-[11px] tracking-wide uppercase">
            {(["personal", "business", "commercial", "wire"] as Segment[]).map((k) => (
              <button
                key={k}
                onClick={() => { setSegment(k); setView("dashboard"); }}
                className={`transition-colors ${segment === k ? "text-white" : "text-white/60 hover:text-white"}`}
              >
                {SEGMENTS[k].label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => setView("dashboard")} className="flex items-center gap-3 text-left">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold">M</div>
            <div>
              <div className="text-sm font-semibold text-slate-900 tracking-wide">DYNAMIC BANK OF WEST</div>
              <div className="text-xs text-slate-500">{seg.sub}</div>
            </div>
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 hidden sm:inline">Hello, Customer</span>
            <DbwMenu />
            <button onClick={onLogout} className="text-sm text-slate-600 hover:text-slate-900">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {view === "profile" && <ProfileView onBack={() => setView("dashboard")} />}
        {view === "card" && <CardView onBack={() => setView("dashboard")} />}
        {view === "dashboard" && (
          <>
            <section>
              <h1 className="text-2xl font-semibold text-slate-900 mb-1">{seg.label}</h1>
              <p className="text-sm text-slate-500">Here's your portfolio at a glance.</p>
            </section>

            <section className="grid md:grid-cols-2 gap-4">
              <AccountCard name={seg.primary.name} number={seg.primary.number} routing="121000248" balance={primaryBal} primary />
              <AccountCard name={seg.secondary.name} number={seg.secondary.number} routing="121000248" balance={seg.secondary.balance} />
            </section>

            <section className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Transaction Log</h2>
                  <span className="text-xs text-slate-500">{tx.length} records · immutable</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="text-left px-6 py-3 font-medium">Date</th>
                        <th className="text-left px-6 py-3 font-medium">Description</th>
                        <th className="text-left px-6 py-3 font-medium">Category</th>
                        <th className="text-right px-6 py-3 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tx.map((t) => (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{t.date}</td>
                          <td className="px-6 py-3 text-slate-900">{t.description}</td>
                          <td className="px-6 py-3 text-slate-600">{t.category}</td>
                          <td className={`px-6 py-3 text-right font-medium tabular-nums ${t.amount < 0 ? "text-slate-900" : "text-emerald-600"}`}>
                            {t.amount < 0 ? "-" : "+"}{fmt(Math.abs(t.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-1">Transfer Funds</h2>
                <p className="text-xs text-slate-500 mb-4">Deducted from Primary Checking.</p>
                <form onSubmit={settle} className="space-y-3">
                  <Field label="Recipient name" value={recipient} onChange={setRecipient} placeholder="Jane Doe" />
                  <Field label="Routing number" value={routing} onChange={setRouting} placeholder="123456789" />
                  <Field label="Amount (USD)" value={amount} onChange={setAmount} placeholder="0.00" type="number" />
                  <Field label="Memo (optional)" value={memo} onChange={setMemo} placeholder="Rent" />
                  {flash && <div className="text-xs text-slate-700 bg-slate-100 rounded px-3 py-2">{flash}</div>}
                  <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-md">
                    Settle
                  </button>
                </form>
              </div>
            </section>
          </>
        )}
      </main>

      {routingOpen && <RoutingModal onClose={() => setRoutingOpen(false)} />}
      <ChatWidget />
    </div>
  );
}

function ProfileView({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <section className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 mb-4">← Back to dashboard</button>
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-2xl font-semibold">JD</div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Jordan Davis</h1>
            <p className="text-sm text-slate-500">Member since March 2018</p>
          </div>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Mailing Address</dt><dd className="text-slate-900 mt-1">1428 Elm Street<br/>Springfield, IL 62704</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt><dd className="text-slate-900 mt-1 tabular-nums">(217) 555-0142</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt><dd className="text-slate-900 mt-1">jordan.davis@example.com</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">2FA</dt><dd className="text-emerald-600 mt-1">Enabled · SMS</dd></div>
        </dl>
        <div className="border-t border-slate-100 mt-8 pt-6">
          <button
            onClick={() => { setSent(true); setTimeout(() => setSent(false), 4000); }}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded-md"
          >
            🔒 Send secure password reset link
          </button>
          {sent && <p className="text-xs text-emerald-600 mt-3">Reset link sent to your verified email.</p>}
        </div>
      </div>
    </section>
  );
}

function CardView({ onBack }: { onBack: () => void }) {
  const [frozen, setFrozen] = useState(false);
  const [limit, setLimit] = useState(500);
  return (
    <section className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 mb-4">← Back to dashboard</button>
      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Debit Card Controls</h1>
          <p className="text-sm text-slate-500">Manage your physical and virtual card.</p>
        </div>

        <div className={`relative mx-auto w-full max-w-sm aspect-[1.586] rounded-2xl p-6 text-white shadow-xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 ${frozen ? "opacity-70" : ""}`}>
          <div className="flex items-start justify-between">
            <div className="text-xs uppercase tracking-widest opacity-80">DBW · Debit</div>
            <div className="h-8 w-10 rounded-md bg-gradient-to-br from-amber-300 to-amber-600" />
          </div>
          <div className="mt-10 text-lg font-mono tracking-widest">•••• •••• •••• 4421</div>
          <div className="mt-6 flex items-end justify-between text-xs">
            <div><div className="opacity-70 uppercase">Cardholder</div><div className="font-semibold tracking-wide">JORDAN DAVIS</div></div>
            <div><div className="opacity-70 uppercase">Exp</div><div className="font-semibold tabular-nums">08 / 28</div></div>
          </div>
          {frozen && (
            <div className="absolute inset-0 rounded-2xl bg-slate-900/40 flex items-center justify-center backdrop-blur-[2px]">
              <span className="text-sm font-semibold tracking-widest bg-white/90 text-slate-900 px-3 py-1 rounded">❄ FROZEN</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900">Freeze / Lock Card</div>
            <div className="text-xs text-slate-500">Instantly block all new transactions.</div>
          </div>
          <button
            onClick={() => setFrozen((f) => !f)}
            className={`relative h-7 w-12 rounded-full transition-colors ${frozen ? "bg-red-600" : "bg-slate-300"}`}
            aria-label="Freeze card"
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${frozen ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-slate-900">Daily spending limit</div>
            <div className="text-sm font-semibold tabular-nums text-slate-900">{fmt(limit)}</div>
          </div>
          <input
            type="range" min={100} max={5000} step={50}
            value={limit} onChange={(e) => setLimit(parseInt(e.target.value))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1 tabular-nums">
            <span>$100</span><span>$5,000</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoutingModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(label: string, val: string) {
    navigator.clipboard?.writeText(val);
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  }
  const Row = ({ label, value, copyVal }: { label: string; value: string; copyVal: string }) => (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums">{value}</div>
        <button onClick={() => copy(label, copyVal)} className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md">
          {copied === label ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center">M</div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Account & Routing Details</div>
              <div className="text-[11px] text-slate-500">Official — Dynamic Bank of West</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <Row label="Routing Number" value="121000248" copyVal="121000248" />
          <Row label="Checking Account Number" value="•••• 5678" copyVal="000123455678" />
          <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
            Use these numbers for direct deposit and ACH transfers. Never share with unverified parties. Dynamic Bank of West will never ask for your full account number by phone or email.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
    </div>
  );
}

function AccountCard({ name, number, routing, balance, primary }: { name: string; number: string; routing: string; balance: number; primary?: boolean }) {
  return (
    <div className={`rounded-xl p-6 border ${primary ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-xs uppercase tracking-wide ${primary ? "text-slate-300" : "text-slate-500"}`}>{name}</div>
          <div className={`text-3xl font-semibold mt-2 tabular-nums ${primary ? "text-white" : "text-slate-900"}`}>{fmt(balance)}</div>
        </div>
        {primary && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white">Primary</span>}
      </div>
      <div className={`mt-6 flex gap-6 text-xs ${primary ? "text-slate-300" : "text-slate-500"}`}>
        <div><span className="block uppercase tracking-wide opacity-75">Account</span><span className="tabular-nums">{number}</span></div>
        <div><span className="block uppercase tracking-wide opacity-75">Routing</span><span className="tabular-nums">{routing}</span></div>
      </div>
    </div>
  );
}

function DbwMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const items = [
    { icon: "👤", label: "My Profile Settings", action: () => {} },
    { icon: "💳", label: "Debit Card Controls", action: () => {} },
    { icon: "📋", label: "Routing & Account Info", action: () => {} },
    { icon: "🔒", label: "Open Secure Messages", action: () => window.dispatchEvent(new CustomEvent("mt:open-chat")) },
  ];
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-md bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 text-slate-900 text-[11px] font-bold shadow-md ring-1 ring-amber-600/40 hover:brightness-110 transition"
        aria-label="DBW menu"
      >
        DBW
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-50">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => { it.action(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left"
            >
              <span className="text-base">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [clicks, setClicks] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LS_CHAT);
    if (stored) { try { setMsgs(JSON.parse(stored)); } catch {} }
    else {
      setMsgs([{ id: uid(), from: "agent", text: "Hi! I'm Riley from Meridian Support. How can I help today?", ts: Date.now() }]);
    }
    // Poll for cross-view updates
    const i = setInterval(() => {
      const s = localStorage.getItem(LS_CHAT);
      if (s) {
        try {
          const parsed = JSON.parse(s) as ChatMsg[];
          setMsgs((cur) => parsed.length !== cur.length ? parsed : cur);
        } catch {}
      }
    }, 800);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    function openIt() { setOpen(true); }
    window.addEventListener("mt:open-chat", openIt);
    return () => window.removeEventListener("mt:open-chat", openIt);
  }, []);

  useEffect(() => {
    if (msgs.length) localStorage.setItem(LS_CHAT, JSON.stringify(msgs));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, open]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setMsgs((m) => [...m, { id: uid(), from: adminMode ? "agent" : "user", text: draft.trim(), ts: Date.now() }]);
    setDraft("");
  }

  // Hidden admin toggle: click the tiny corner dot 3 times
  function secretClick() {
    const n = clicks + 1;
    setClicks(n);
    if (n >= 3) {
      setAdminMode((a) => !a);
      setClicks(0);
    }
    setTimeout(() => setClicks(0), 1500);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg flex items-center justify-center z-50"
          aria-label="Open support chat"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 w-[360px] h-[520px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
          <div className={`px-4 py-3 flex items-center justify-between ${adminMode ? "bg-amber-500" : "bg-slate-900"} text-white`}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">R</div>
              <div>
                <div className="text-sm font-semibold">{adminMode ? "Admin View" : "Riley · Support"}</div>
                <div className="text-xs opacity-80">{adminMode ? "Replying as agent" : "Typically replies in seconds"}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-lg leading-none">×</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {msgs.map((m) => {
              const mine = adminMode ? m.from === "agent" : m.from === "user";
              const isAgent = m.from === "agent";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-slate-900 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm"
                  }`}>
                    {!mine && (
                      <div className={`text-[10px] uppercase tracking-wide mb-0.5 ${isAgent ? "text-emerald-600" : "text-slate-500"}`}>
                        {isAgent ? "Agent" : "Customer"}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={send} className="border-t border-slate-200 p-3 flex gap-2 bg-white">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={adminMode ? "Type agent reply…" : "Type a message…"}
              className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button type="submit" className="rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 text-sm font-medium">
              Send
            </button>
          </form>

          <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-slate-400 bg-white">
            <span>End-to-end encrypted</span>
            <button
              onClick={secretClick}
              className="h-3 w-3 rounded-full bg-slate-200 hover:bg-slate-300"
              aria-label="."
              title=""
            />
          </div>
        </div>
      )}
    </>
  );
}
