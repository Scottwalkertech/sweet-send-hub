import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: "Make a Deposit — Dynamic Bank of West" },
      { name: "description", content: "Deposit funds by mobile check, wire, ACH, or cryptocurrency transfer." },
    ],
  }),
  component: DepositPage,
});

const ACCOUNTS = [
  { id: "checking", label: "Everyday Checking", tail: "5678", balance: 8420.55 },
  { id: "savings", label: "Way2Save Savings", tail: "9012", balance: 15230.10 },
  { id: "business", label: "Business Checking", tail: "3344", balance: 42150.00 },
  { id: "commercial", label: "Commercial Reserve", tail: "7781", balance: 250000.00 },
];

const ROUTING = "121000248";
const ACCOUNT_NO = "000123455678";
const SWIFT = "DBWSUS44";

const CRYPTO_ASSETS = [
  { id: "btc", label: "Bitcoin", symbol: "BTC", network: "BTC Network" },
  { id: "eth", label: "Ethereum", symbol: "ETH", network: "ERC-20" },
  { id: "usdt", label: "Tether", symbol: "USDT-TRC20", network: "TRC-20" },
];

const CRYPTO_NETWORKS: Record<string, string[]> = {
  btc: ["BTC Network", "Lightning Network"],
  eth: ["ERC-20", "BEP-20"],
  usdt: ["TRC-20", "ERC-20"],
};

const CRYPTO_WALLETS: Record<string, Record<string, string>> = {
  btc: {
    "BTC Network": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "Lightning Network": "lnbc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  },
  eth: {
    "ERC-20": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    "BEP-20": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  },
  usdt: {
    "TRC-20": "TJpQdXJKp9zCqNzQJpQdXJKp9zCqNzQJ",
    "ERC-20": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  },
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function DepositPage() {
  const [account, setAccount] = useState("checking");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"scan" | "wire" | "crypto">("scan");
  const [scanState, setScanState] = useState<"idle" | "scanning" | "captured">("idle");
  const [submitted, setSubmitted] = useState<null | { amount: number; ref: string; cryptoAsset?: string; cryptoNetwork?: string; cryptoAmount?: string }>(null);
  const [copied, setCopied] = useState("");

  const [cryptoAsset, setCryptoAsset] = useState("btc");
  const [cryptoNetwork, setCryptoNetwork] = useState("BTC Network");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoCopied, setCryptoCopied] = useState(false);
  const [cryptoConfirming, setCryptoConfirming] = useState(false);

  const acct = ACCOUNTS.find((a) => a.id === account)!;
  const asset = CRYPTO_ASSETS.find((a) => a.id === cryptoAsset)!;
  const networks = CRYPTO_NETWORKS[cryptoAsset] || [];
  const walletAddress = CRYPTO_WALLETS[cryptoAsset]?.[cryptoNetwork] || "";

  function copy(label: string, val: string) {
    navigator.clipboard?.writeText(val);
    setCopied(label);
    setTimeout(() => setCopied(""), 1400);
  }

  function copyWallet() {
    navigator.clipboard?.writeText(walletAddress);
    setCryptoCopied(true);
    setTimeout(() => setCryptoCopied(false), 1400);
  }

  function handleAssetChange(id: string) {
    setCryptoAsset(id);
    const nets = CRYPTO_NETWORKS[id] || [];
    setCryptoNetwork(nets[0] || "");
  }

  function submitDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (method === "crypto") {
      if (!cryptoAmount || parseFloat(cryptoAmount) <= 0) return;
      setCryptoConfirming(true);
      setTimeout(() => {
        setCryptoConfirming(false);
        setSubmitted({
          amount: 0,
          ref: "DBW-CRYP-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
          cryptoAsset: asset.symbol,
          cryptoNetwork,
          cryptoAmount,
        });
      }, 1800);
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setSubmitted({ amount: amt, ref: "DBW" + Math.random().toString(36).slice(2, 10).toUpperCase() });
  }

  if (submitted) {
    const isCrypto = !!submitted.cryptoAsset;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl">✓</div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Deposit submitted</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isCrypto ? "Your deposit is being verified on-chain. Funds will be credited after required confirmations." : "Your funds will be available within 1 business day."}
          </p>
          <div className="mt-6 text-left bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-1.5">
            {isCrypto ? (
              <>
                <Row k="Asset" v={submitted.cryptoAsset!} />
                <Row k="Network" v={submitted.cryptoNetwork!} />
                <Row k="Amount" v={`${submitted.cryptoAmount} ${submitted.cryptoAsset}`} />
                <Row k="Reference ID" v={submitted.ref} />
              </>
            ) : (
              <>
                <Row k="Amount" v={fmt(submitted.amount)} />
                <Row k="Deposited to" v={`${acct.label} ····${acct.tail}`} />
                <Row k="Reference ID" v={submitted.ref} />
                <Row k="Method" v={method === "scan" ? "Mobile Check Deposit" : "Wire / ACH"} />
              </>
            )}
          </div>
          <div className="mt-6 flex gap-2">
            <button onClick={() => { setSubmitted(null); setAmount(""); setScanState("idle"); setCryptoAmount(""); }} className="flex-1 border border-slate-300 rounded-md py-2 text-sm hover:bg-slate-50">New deposit</button>
            <Link to="/" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md py-2 text-sm text-center">Back to dashboard</Link>
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
          <p className="text-sm text-slate-500 mt-1">Choose your destination account and preferred method.</p>
        </div>

        <form onSubmit={submitDeposit} className="grid lg:grid-cols-2 gap-6">
          {/* Left column: form */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Deposit to</label>
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  {ACCOUNTS.map((a) => (
                    <option key={a.id} value={a.id}>{a.label} ····{a.tail} — {fmt(a.balance)}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">Current balance: <span className="font-semibold text-slate-900">{fmt(acct.balance)}</span></p>
              </div>
              {method !== "crypto" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-md border border-slate-300 pl-7 pr-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <MethodTab active={method === "scan"} onClick={() => setMethod("scan")}>📷 Mobile Check Deposit</MethodTab>
                <MethodTab active={method === "wire"} onClick={() => setMethod("wire")}>🏦 Wire / ACH</MethodTab>
                <MethodTab active={method === "crypto"} onClick={() => setMethod("crypto")}>₿ Crypto</MethodTab>
              </div>
            </div>

            {method === "scan" && (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="text-sm font-semibold text-slate-900 mb-3">Scan your check</div>
                <div className="relative aspect-[16/10] rounded-lg border-2 border-dashed border-slate-300 bg-slate-900 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.15),transparent_70%)]" />
                  <div className="absolute inset-6 border border-amber-300/60 rounded-md" />
                  <div className="absolute inset-x-6 top-1/2 h-px bg-amber-300/80" style={{ animation: scanState === "scanning" ? "dbw-scan 1.6s ease-in-out infinite" : undefined }} />
                  <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                    {scanState === "idle" && <span className="text-white/60">Align the front of your check inside the frame</span>}
                    {scanState === "scanning" && <span className="text-amber-300">Scanning check…</span>}
                    {scanState === "captured" && <span className="text-emerald-300">✓ Check image captured</span>}
                  </div>
                  <div className="absolute top-2 left-2 text-[10px] uppercase tracking-widest text-white/50">● Live camera</div>
                </div>
                <style>{`@keyframes dbw-scan { 0%,100%{top:15%;} 50%{top:85%;} }`}</style>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => { setScanState("scanning"); setTimeout(() => setScanState("captured"), 1600); }} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm py-2 rounded-md">
                    {scanState === "captured" ? "Rescan" : "Capture check"}
                  </button>
                  <button type="button" onClick={() => setScanState("idle")} className="px-4 border border-slate-300 text-sm rounded-md hover:bg-slate-50">Reset</button>
                </div>
                <p className="mt-2 text-xs text-slate-500">Endorse the back of your check "For mobile deposit only at DBW."</p>
              </div>
            )}

            {method === "crypto" && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Select asset</label>
                  <select
                    value={cryptoAsset}
                    onChange={(e) => handleAssetChange(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    {CRYPTO_ASSETS.map((a) => (
                      <option key={a.id} value={a.id}>{a.label} ({a.symbol})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Network</label>
                  <div className="flex flex-wrap gap-2">
                    {networks.map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => setCryptoNetwork(net)}
                        className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${cryptoNetwork === net ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
                      >
                        {net}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <div className="w-40 h-40 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <rect x="10" y="10" width="80" height="80" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl">🔲</div>
                      <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">QR Code</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Wallet address</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={walletAddress}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono tracking-wider text-slate-700 bg-slate-50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={copyWallet}
                      className={`px-3 py-2 rounded-md border text-xs whitespace-nowrap transition-colors ${cryptoCopied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-slate-300 hover:bg-slate-50 text-slate-700"}`}
                    >
                      {cryptoCopied ? "✓ Copied" : "Copy Address"}
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-900 flex gap-2 items-start">
                  <span className="text-amber-600 mt-0.5">⚠</span>
                  <span>Only send the selected cryptocurrency to this address. Sending any other coin may result in permanent loss.</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount deposited</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      value={cryptoAmount}
                      onChange={(e) => setCryptoAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-md border border-slate-300 pl-3 pr-16 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 uppercase">{asset.symbol}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!cryptoAmount || parseFloat(cryptoAmount) <= 0 || cryptoConfirming}
                  className="w-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-sm font-bold py-3 rounded-md shadow-md border border-amber-700/40"
                >
                  {cryptoConfirming ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                      Verifying on-chain…
                    </span>
                  ) : (
                    <>Confirm Deposit Request {cryptoAmount && `— ${cryptoAmount} ${asset.symbol}`}</>
                  )}
                </button>
              </div>
            )}

            {method !== "crypto" && (
              <button
                type="submit"
                disabled={!amount || (method === "scan" && scanState !== "captured")}
                className="w-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-sm font-bold py-3 rounded-md shadow-md border border-amber-700/40"
              >
                Submit deposit {amount && `— ${fmt(parseFloat(amount) || 0)}`}
              </button>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {method === "wire" ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white px-6 py-4">
                  <div className="text-xs uppercase tracking-widest text-amber-300">Wire / ACH Instructions</div>
                  <div className="text-sm mt-0.5">Send funds directly to your {acct.label}</div>
                </div>
                <div className="p-6 space-y-3">
                  <CopyRow label="Bank name" value="Dynamic Bank of West, N.A." onCopy={copy} copied={copied} />
                  <CopyRow label="Routing / ABA number" value={ROUTING} onCopy={copy} copied={copied} mono />
                  <CopyRow label="Account number" value={ACCOUNT_NO} onCopy={copy} copied={copied} mono />
                  <CopyRow label="SWIFT / BIC (int'l wires)" value={SWIFT} onCopy={copy} copied={copied} mono />
                  <CopyRow label="Beneficiary name" value="Jordan A. Davis" onCopy={copy} copied={copied} />
                  <CopyRow label="Bank address" value="1998 Western Blvd, Los Angeles, CA 90045" onCopy={copy} copied={copied} />
                </div>
                <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-900">
                  ⚠ Verify routing and account numbers with the sender. Wires are irreversible once processed.
                </div>
              </div>
            ) : method === "crypto" ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white px-6 py-4">
                  <div className="text-xs uppercase tracking-widest text-amber-300">Crypto Deposit Info</div>
                  <div className="text-sm mt-0.5">Deposit {asset.label} to your {acct.label}</div>
                </div>
                <div className="p-6 space-y-3">
                  <Row k="Asset" v={asset.label} />
                  <Row k="Symbol" v={asset.symbol} />
                  <Row k="Network" v={cryptoNetwork} />
                  <Row k="Min. deposit" v="0.001 BTC / 0.01 ETH / 10 USDT" />
                  <Row k="Confirmations required" v="3" />
                  <Row k="Estimated arrival" v="~10–30 minutes" />
                </div>
                <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-900">
                  ⚠ Always double-check the network before sending. DBW is not responsible for funds sent on the wrong chain.
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="text-sm font-semibold text-slate-900">Deposit limits</div>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex justify-between"><span>Per check</span><span className="font-medium text-slate-900">$10,000.00</span></li>
                  <li className="flex justify-between"><span>Daily total</span><span className="font-medium text-slate-900">$25,000.00</span></li>
                  <li className="flex justify-between"><span>Rolling 30-day</span><span className="font-medium text-slate-900">$100,000.00</span></li>
                </ul>
                <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
                  Funds from mobile deposits are typically available the next business day. Larger deposits may be subject to holds per Regulation CC.
                </div>
              </div>
            )}

            <div className="bg-slate-900 text-white rounded-xl p-6 text-sm">
              <div className="text-xs uppercase tracking-widest text-amber-300 mb-2">Security notice</div>
              Never share your account or routing number with an untrusted party. DBW will never ask for your password over the phone.
            </div>
          </div>
        </form>
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-medium text-slate-900">{v}</span></div>
  );
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
