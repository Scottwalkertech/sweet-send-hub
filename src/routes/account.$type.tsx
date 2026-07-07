import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  currentUser, upsertUser, appendLedger, ledgerFor, onStoreChange,
  fmtCurrency, type MtUser, type AccountKey, type LedgerEntry,
} from "@/lib/mt-store";

export const Route = createFileRoute("/account/$type")({
  head: () => ({
    meta: [
      { title: "Account · Dynamic Bank of West" },
      { name: "description", content: "Account details, activity, and internal transfers." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { type } = useParams({ from: "/account/$type" });
  const navigate = useNavigate();
  const account = (type === "savings" ? "savings" : "checking") as AccountKey;
  const [user, setUser] = useState<MtUser | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    function refresh() {
      const u = currentUser();
      setUser(u);
      if (u) setEntries(ledgerFor(u.id, account));
    }
    refresh();
    return onStoreChange(refresh);
  }, [account]);

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-900">
        <div className="text-center">
          <p className="text-sm text-slate-600">You must sign in to view this account.</p>
          <Link to="/" className="mt-4 inline-block rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-black">Return to sign in</Link>
        </div>
      </div>
    );
  }

  const meta = account === "checking"
    ? { name: "Everyday Checking", balance: user.balance, acct: user.accountNumber, tag: "DBW Personal · Checking" }
    : { name: "Way2Save Savings", balance: user.savingsBalance, acct: user.savingsAccountNumber ?? user.accountNumber, tag: "DBW Personal · Savings" };
  const other = account === "checking" ? "savings" : "checking";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center text-black font-black text-[10px]">DBW</div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-amber-700 font-semibold">{meta.tag}</div>
              <div className="text-sm font-semibold text-slate-900">{meta.name}</div>
            </div>
          </div>
          <button onClick={() => navigate({ to: "/" })} className="text-xs text-slate-700 hover:text-slate-900 border border-slate-300 rounded-md px-3 py-1.5 bg-white">
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Balance card */}
        <section className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_55%)]" />
          <div className="relative px-8 py-9 flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-amber-700 text-xs uppercase tracking-[0.24em] font-semibold">
                <span className="h-px w-8 bg-amber-500" />
                {meta.tag}
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-wide text-slate-900">{meta.name}</h1>
              <div className="text-xs text-slate-500 mt-1 tabular-nums">
                Account •••• {meta.acct.slice(-4)} · Routing 121000248
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Available Balance</div>
              <div className="text-4xl font-semibold tabular-nums mt-1 bg-gradient-to-b from-amber-500 to-amber-700 bg-clip-text text-transparent">
                {fmtCurrency(meta.balance)}
              </div>
            </div>
          </div>
        </section>

        {/* Internal transfer widget */}
        <InternalTransfer user={user} source={account} />

        {/* Ledger */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{meta.name} · Activity Ledger</h2>
              <p className="text-xs text-slate-500 mt-0.5">{entries.length} entries · isolated to this account</p>
            </div>
            <Link to="/account/$type" params={{ type: other }} className="text-xs text-amber-700 hover:text-amber-800 border border-amber-500/40 rounded px-3 py-1.5 bg-amber-50">
              View {other === "checking" ? "Checking" : "Savings"} →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                  <th className="text-left px-6 py-3 font-medium">Description</th>
                  <th className="text-right px-6 py-3 font-medium">Amount</th>
                  <th className="text-right px-6 py-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">No activity recorded for this account yet.</td></tr>
                )}
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-slate-900">{e.description}</td>
                    <td className={`px-6 py-3 text-right font-mono tabular-nums ${e.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {e.amount >= 0 ? "+" : "-"}{fmtCurrency(Math.abs(e.amount))}
                    </td>
                    <td className="px-6 py-3 text-right font-mono tabular-nums text-slate-900">{fmtCurrency(e.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function InternalTransfer({ user, source }: { user: MtUser; source: AccountKey }) {
  const [dest, setDest] = useState<AccountKey>(source === "checking" ? "savings" : "checking");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const srcLabel = source === "checking" ? "Everyday Checking" : "Way2Save Savings";
  const destOptions = useMemo(() => ([
    { key: "checking" as AccountKey, label: "Transfer to Checking" },
    { key: "savings" as AccountKey, label: "Transfer to Savings" },
  ].filter((o) => o.key !== source)), [source]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setMsg({ ok: false, text: "Enter a valid amount greater than zero." });
    if (source === dest) return setMsg({ ok: false, text: "Choose a different destination account." });
    const srcBal = source === "checking" ? user.balance : user.savingsBalance;
    if (amt > srcBal) return setMsg({ ok: false, text: `Insufficient funds in ${srcLabel}.` });

    const newChecking = user.balance + (source === "checking" ? -amt : dest === "checking" ? amt : 0);
    const newSavings = user.savingsBalance + (source === "savings" ? -amt : dest === "savings" ? amt : 0);

    const updated: MtUser = { ...user, balance: newChecking, savingsBalance: newSavings };
    upsertUser(updated);

    const nowIso = new Date().toISOString();
    const destLabel = dest === "checking" ? "Everyday Checking" : "Way2Save Savings";
    appendLedger({
      id: `led_${Math.random().toString(36).slice(2, 10)}`,
      userId: user.id, account: source, date: nowIso,
      description: `Internal transfer to ${destLabel}`,
      amount: -amt,
      balanceAfter: source === "checking" ? newChecking : newSavings,
    });
    appendLedger({
      id: `led_${Math.random().toString(36).slice(2, 10)}`,
      userId: user.id, account: dest, date: nowIso,
      description: `Internal transfer from ${srcLabel}`,
      amount: amt,
      balanceAfter: dest === "checking" ? newChecking : newSavings,
    });
    setAmount("");
    setMsg({ ok: true, text: `Transferred ${fmtCurrency(amt)} to ${destLabel}.` });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center text-black font-black text-[10px]">⇄</div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-amber-700 font-semibold">Internal Transfer</div>
          <h3 className="text-sm font-semibold text-slate-900">Move funds between your DBW accounts</h3>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <label className="block text-xs uppercase tracking-wider text-slate-500">
          From
          <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">{srcLabel}</div>
        </label>
        <label className="block text-xs uppercase tracking-wider text-slate-500">
          Destination
          <select value={dest} onChange={(e) => setDest(e.target.value as AccountKey)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500">
            {destOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wider text-slate-500">
          Amount (USD)
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono tabular-nums focus:outline-none focus:border-amber-500" />
        </label>
        <div className="sm:col-span-3 flex items-center justify-between gap-3">
          {msg
            ? <div className={`text-xs rounded px-3 py-2 border ${msg.ok ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700"}`}>{msg.text}</div>
            : <div className="text-[11px] text-slate-500">Transfers post instantly and log to both account ledgers.</div>}
          <button type="submit" className="rounded-md bg-gradient-to-r from-amber-400 to-amber-600 text-black text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:brightness-110 shadow-sm">
            Submit Transfer
          </button>
        </div>
      </form>
    </section>
  );
}
