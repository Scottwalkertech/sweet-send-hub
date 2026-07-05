import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  currentUser,
  loadDepositSettings,
  pushToQueue,
  genRef,
  fmtCurrency,
  onStoreChange,
  type DepositSettings,
  type MtUser,
} from "@/lib/mt-store";

export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: "Make a Deposit — Dynamic Bank of West" },
      { name: "description", content: "Deposit funds by wire, ACH, or cryptocurrency transfer." },
    ],
  }),
  component: DepositPage,
});

function DepositPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<MtUser | null>(null);
  const [settings, setSettings] = useState<DepositSettings>(loadDepositSettings());
  const [method, setMethod] = useState<"scan" | "wire" | "crypto">("wire");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState("");
  const [submitted, setSubmitted] = useState<null | { ref: string; method: "Wire" | "Crypto" }>(null);

  useEffect(() => {
    setUser(currentUser());
    setSettings(loadDepositSettings());
    const off = onStoreChange(() => {
      setUser(currentUser());
      setSettings(loadDepositSettings());
    });
    return off;
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 text-center">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Please sign in</div>
          <p className="text-sm text-slate-500 mt-2">You must be signed in to make a deposit.</p>
          <Link to="/" className="inline-block mt-4 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">Return to sign in</Link>
        </div>
      </div>
    );
  }

  function copy(label: string, val: string) {
    navigator.clipboard?.writeText(val);
    setCopied(label);
    setTimeout(() => setCopied(""), 1400);
  }

  function submitWire(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const ref = genRef("DBW-WIRE");
    pushToQueue({
      id: ref, userId: user!.id, userName: user!.name,
      method: "Wire", amount: amt, submitted: new Date().toISOString().slice(0, 10),
      status: "Pending", reference: ref, direction: "credit",
      memo: "Inbound wire deposit request",
    });
    setSubmitted({ ref, method: "Wire" });
  }
  function submitCrypto(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const ref = genRef("DBW-CRYP");
    pushToQueue({
      id: ref, userId: user!.id, userName: user!.name,
      method: "Crypto", amount: amt, submitted: new Date().toISOString().slice(0, 10),
      status: "Pending", reference: ref, direction: "credit",
      memo: `BTC deposit — ${settings.btcAddress.slice(0, 12)}…`,
    });
    setSubmitted({ ref, method: "Crypto" });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-3xl">⏳</div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Deposit request submitted</h1>
          <p className="text-sm text-slate-500 mt-1">Your request is now in the compliance review queue. Funds will be credited to your account once an administrator approves the deposit.</p>
          <div className="mt-6 text-left bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-1.5">
            <RowKV k="Method" v={submitted.method} />
            <RowKV k="Reference" v={submitted.ref} />
            <RowKV k="Status" v="Pending admin review" />
          </div>
          <div className="mt-6 flex gap-2">
            <button onClick={() => { setSubmitted(null); setAmount(""); }} className="flex-1 border border-slate-300 rounded-md py-2 text-sm hover:bg-slate-50">New deposit</button>
            <button onClick={() => navigate({ to: "/" })} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md py-2 text-sm">Back to dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 py-3">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 text-white">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-b from-amber-300 to-amber-600 text-slate-900 font-bold text-[10px] flex items-center justify-center tracking-wide">DBW</div>
            <div>
              <div className="text-sm font-semibold tracking-wide">DYNAMIC BANK OF WEST</div>
              <div className="text-[11px] text-white/60">Deposit Center</div>
            </div>
          </Link>
          <Link to="/" className="text-xs text-white/70 hover:text-amber-300">← Back to dashboard</Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Make a deposit</h1>
          <p className="text-sm text-slate-500 mt-1">Depositing to <span className="font-semibold text-slate-900">{user.name}</span> · Account {user.account} · Current balance <span className="font-semibold">{fmtCurrency(user.balance)}</span></p>
        </div>

        <div className="flex gap-2">
          <MethodTab active={method === "scan"} onClick={() => setMethod("scan")}>📷 Mobile Check Deposit</MethodTab>
          <MethodTab active={method === "wire"} onClick={() => setMethod("wire")}>🏦 Wire / ACH</MethodTab>
          <MethodTab active={method === "crypto"} onClick={() => setMethod("crypto")}>₿ Cryptocurrency</MethodTab>
        </div>

        {method === "scan" && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl">📵</div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Mobile deposit not yet enrolled</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Your account is not currently enrolled in Mobile Check Deposit. Contact your relationship manager or visit a branch to enable this feature.
            </p>
            <div className="mt-6 inline-block rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-500 px-3 py-1.5">
              Feature disabled · pending enrollment
            </div>
          </div>
        )}

        {method === "wire" && (
          <form onSubmit={submitWire} className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white px-6 py-4">
                  <div className="text-xs uppercase tracking-widest text-amber-300">Wire / ACH Instructions</div>
                  <div className="text-sm mt-0.5">Provide these details to the sending bank</div>
                </div>
                <div className="p-6 space-y-3">
                  <CopyRow label="Bank name" value={settings.bankName} onCopy={copy} copied={copied} />
                  <CopyRow label="Routing / ABA number" value={settings.routing} onCopy={copy} copied={copied} mono />
                  <CopyRow label="Account number" value={settings.accountNumber} onCopy={copy} copied={copied} mono />
                  <CopyRow label="SWIFT / BIC" value={settings.swift} onCopy={copy} copied={copied} mono />
                  <CopyRow label="Beneficiary name" value={settings.beneficiary} onCopy={copy} copied={copied} />
                  <CopyRow label="Bank address" value={settings.bankAddress} onCopy={copy} copied={copied} />
                </div>
                <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-900">
                  ⚠ Verify all numbers with the sender. Wires are irreversible once processed.
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="text-sm font-semibold text-slate-900">Notify us of the incoming wire</div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number" step="0.01" min="0" value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-md border border-slate-300 pl-7 pr-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
                <button type="submit" disabled={!amount || parseFloat(amount) <= 0} className="w-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 disabled:opacity-40 text-slate-900 text-sm font-bold py-3 rounded-md border border-amber-700/40">
                  Submit wire notification
                </button>
                <p className="text-[11px] text-slate-500">Your request will be queued for administrative review. Funds credit only after admin approval.</p>
              </div>
            </div>
          </form>
        )}

        {method === "crypto" && (
          <form onSubmit={submitCrypto} className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="text-sm font-semibold text-slate-900">Bitcoin (BTC) deposit address</div>
              <div className="flex justify-center">
                {settings.btcQrDataUrl ? (
                  <img src={settings.btcQrDataUrl} alt="BTC deposit QR code" className="h-44 w-44 rounded-lg border border-slate-200 object-contain bg-white" />
                ) : (
                  <div className="h-44 w-44 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                    <span className="text-3xl">🔲</span>
                    <span className="text-[10px] uppercase tracking-wider mt-1">QR pending admin upload</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Wallet address</label>
                <div className="flex gap-2">
                  <input readOnly value={settings.btcAddress}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono tracking-wider text-slate-700 bg-slate-50 focus:outline-none" />
                  <button type="button" onClick={() => copy("btc", settings.btcAddress)}
                    className={`px-3 py-2 rounded-md border text-xs whitespace-nowrap ${copied === "btc" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-slate-300 hover:bg-slate-50 text-slate-700"}`}>
                    {copied === "btc" ? "✓ Copied" : "Copy Address"}
                  </button>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-900 flex gap-2 items-start">
                <span className="text-amber-600 mt-0.5">⚠</span>
                <span>Only send Bitcoin (BTC) to this address. Sending any other coin may result in permanent loss.</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="text-sm font-semibold text-slate-900">Report your deposit</div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount sent (USD equivalent)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input type="number" step="0.01" min="0" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-slate-300 pl-7 pr-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
              </div>
              <button type="submit" disabled={!amount || parseFloat(amount) <= 0} className="w-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 disabled:opacity-40 text-slate-900 text-sm font-bold py-3 rounded-md border border-amber-700/40">
                Confirm Deposit Request
              </button>
              <p className="text-[11px] text-slate-500">Your request enters the admin review queue and credits after approval.</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function MethodTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex-1 text-sm py-2 rounded-md border transition-colors ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
      {children}
    </button>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-medium text-slate-900">{v}</span></div>;
}

function CopyRow({ label, value, onCopy, copied, mono }: { label: string; value: string; onCopy: (l: string, v: string) => void; copied: string; mono?: boolean }) {
  const isCopied = copied === label;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className={`text-sm text-slate-900 truncate ${mono ? "font-mono tracking-wider" : "font-medium"}`}>{value}</div>
      </div>
      <button type="button" onClick={() => onCopy(label, value)} className={`text-xs px-3 py-1.5 rounded-md border whitespace-nowrap ${isCopied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-slate-300 hover:bg-slate-50 text-slate-700"}`}>
        {isCopied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}
