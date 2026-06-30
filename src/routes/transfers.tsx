import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  Shield,
  Wallet,
  Users,
  DollarSign,
  FileText,
} from "lucide-react";

export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Fund Transfers — Dynamic Bank of West" },
      { name: "description", content: "Send money securely between accounts and to beneficiaries." },
    ],
  }),
  component: TransfersPage,
});

type AccountKey = "checking" | "savings" | "commercial";

const ACCOUNTS: { key: AccountKey; name: string; mask: string; balanceKey: string; fallback: number }[] = [
  { key: "checking", name: "Everyday Checking", mask: "•••• 5678", balanceKey: "mt_checking_bal", fallback: 8432.19 },
  { key: "savings", name: "Way2Save Savings", mask: "•••• 9921", balanceKey: "mt_savings_bal", fallback: 21540.0 },
  { key: "commercial", name: "Commercial Operating", mask: "•••• 3344", balanceKey: "mt_commercial_bal", fallback: 25000.0 },
];

const BENEFICIARIES = [
  { id: "b1", name: "Jane Carter", bank: "Chase Bank", acct: "•••• 4421" },
  { id: "b2", name: "Acme Supplies LLC", bank: "Wells Fargo", acct: "•••• 7732" },
  { id: "b3", name: "Michael Tran", bank: "Bank of America", acct: "•••• 0098" },
  { id: "b4", name: "Pacific Rentals", bank: "US Bank", acct: "•••• 5510" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function readBal(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function writeBal(key: string, n: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, String(n));
}

type Stage =
  | { kind: "form" }
  | { kind: "review" }
  | { kind: "success"; txId: string }
  | { kind: "pending"; trackingId: string; eta: string }
  | { kind: "failed"; code: string; message: string };

function TransfersPage() {
  const [from, setFrom] = useState<AccountKey>("checking");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAcct, setRecipientAcct] = useState("");
  const [recipientBank, setRecipientBank] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fromAccount = ACCOUNTS.find((a) => a.key === from)!;
  const fromBalance = useMemo(() => readBal(fromAccount.balanceKey, fromAccount.fallback), [fromAccount, stage]);
  const amountNum = Number(amount);
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;
  const postBalance = validAmount ? fromBalance - amountNum : fromBalance;
  const insufficient = validAmount && amountNum > fromBalance;

  function pickBeneficiary(id: string) {
    setBeneficiary(id);
    const b = BENEFICIARIES.find((x) => x.id === id);
    if (b) {
      setRecipientName(b.name);
      setRecipientBank(b.bank);
      setRecipientAcct(b.acct.replace(/[^0-9]/g, "") || "44210000");
    }
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!recipientName.trim()) e.name = "Recipient name is required.";
    if (!recipientAcct.trim() || recipientAcct.replace(/\D/g, "").length < 4)
      e.acct = "Enter a valid account number.";
    if (!recipientBank.trim()) e.bank = "Recipient bank is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function validateStep2() {
    const e: Record<string, string> = {};
    if (!validAmount) e.amount = "Enter an amount greater than $0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goReview() {
    if (!validateStep2()) return;
    setStage({ kind: "review" });
  }

  function submitTransfer() {
    // Simulate outcomes: insufficient → failed; >$10k → pending; otherwise success.
    if (insufficient) {
      setStage({
        kind: "failed",
        code: "ERR_INSUFFICIENT_FUNDS_402",
        message: "Your selected account does not have enough available funds to complete this transfer.",
      });
      return;
    }
    writeBal(fromAccount.balanceKey, fromBalance - amountNum);
    if (amountNum > 10000) {
      setStage({
        kind: "pending",
        trackingId: "TRK-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
        eta: "1–2 business days",
      });
      return;
    }
    setStage({ kind: "success", txId: "DBW-" + Math.random().toString(36).slice(2, 10).toUpperCase() });
  }

  function resetAll() {
    setStage({ kind: "form" });
    setStep(1);
    setErrors({});
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-600/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 text-slate-900 text-[11px] font-extrabold flex items-center justify-center shadow ring-1 ring-amber-600/40">
              DBW
            </div>
            <div>
              <div className="text-white text-sm font-bold tracking-wider">DYNAMIC BANK OF WEST</div>
              <div className="text-amber-300/80 text-[10px] uppercase tracking-[0.2em]">Secure Fund Transfers</div>
            </div>
          </Link>
          <Link to="/" className="text-slate-300 hover:text-white text-sm inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {stage.kind === "form" || stage.kind === "review" ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Fund Transfers</h1>
              <p className="text-sm text-slate-600 mt-1">
                Move money between your accounts or send to a beneficiary. All transfers are encrypted end-to-end.
              </p>
            </div>

            <Stepper step={stage.kind === "review" ? 3 : step} />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {stage.kind === "form" && step === 1 && (
                <Section icon={<Users className="h-4 w-4" />} title="Recipient Details" subtitle="Who are you sending money to?">
                  <div className="space-y-4">
                    <Field label="Recent Beneficiaries">
                      <select
                        value={beneficiary}
                        onChange={(e) => pickBeneficiary(e.target.value)}
                        className="w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none"
                      >
                        <option value="">Select a saved recipient…</option>
                        {BENEFICIARIES.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} — {b.bank} {b.acct}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Recipient Full Name" error={errors.name}>
                      <input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Jane Carter"
                        className="w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none"
                      />
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Recipient Bank" error={errors.bank}>
                        <input
                          value={recipientBank}
                          onChange={(e) => setRecipientBank(e.target.value)}
                          placeholder="e.g. Chase Bank"
                          className="w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none"
                        />
                      </Field>
                      <Field label="Account Number" error={errors.acct}>
                        <input
                          value={recipientAcct}
                          onChange={(e) => setRecipientAcct(e.target.value.replace(/[^0-9]/g, ""))}
                          inputMode="numeric"
                          placeholder="000000000000"
                          className="w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 tabular-nums focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none"
                        />
                      </Field>
                    </div>
                  </div>
                  <Footer>
                    <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">Cancel</Link>
                    <button
                      type="button"
                      onClick={() => validateStep1() && setStep(2)}
                      className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </Footer>
                </Section>
              )}

              {stage.kind === "form" && step === 2 && (
                <Section icon={<DollarSign className="h-4 w-4" />} title="Amount & Source Account" subtitle="Choose how much and where to send from.">
                  <div className="space-y-5">
                    <Field label="From Account">
                      <select
                        value={from}
                        onChange={(e) => setFrom(e.target.value as AccountKey)}
                        className="w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none"
                      >
                        {ACCOUNTS.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.name} ({a.mask}) — {fmt(readBal(a.balanceKey, a.fallback))}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Amount (USD)" error={errors.amount}>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">$</span>
                        <input
                          value={amount}
                          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                          inputMode="decimal"
                          placeholder="0.00"
                          className="w-full h-14 pl-9 pr-4 rounded-lg border border-slate-300 bg-white text-slate-900 text-2xl tabular-nums font-semibold focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none"
                        />
                      </div>
                    </Field>

                    <Field label="Memo (optional)">
                      <input
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        placeholder="What's this for?"
                        className="w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none"
                      />
                    </Field>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Available balance</span>
                        <span className="font-semibold tabular-nums text-slate-900">{fmt(fromBalance)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-slate-600">Estimated balance after transfer</span>
                        <span className={`font-semibold tabular-nums ${insufficient ? "text-red-600" : "text-slate-900"}`}>
                          {fmt(postBalance)}
                        </span>
                      </div>
                      {insufficient && (
                        <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                          Heads up: this amount exceeds your available balance.
                        </div>
                      )}
                    </div>
                  </div>
                  <Footer>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={goReview}
                      className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                    >
                      Review Transfer <ArrowRight className="h-4 w-4" />
                    </button>
                  </Footer>
                </Section>
              )}

              {stage.kind === "review" && (
                <Section icon={<Shield className="h-4 w-4" />} title="Review & Confirm" subtitle="Verify everything looks right before we send.">
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
                    <Row label="From" value={`${fromAccount.name} (${fromAccount.mask})`} />
                    <Row label="Recipient" value={recipientName} />
                    <Row label="Bank" value={recipientBank} />
                    <Row label="Account" value={`•••• ${recipientAcct.slice(-4)}`} mono />
                    <Row label="Amount" value={fmt(amountNum)} mono strong />
                    {memo && <Row label="Memo" value={memo} />}
                  </div>

                  <div className={`mt-4 rounded-xl border p-4 ${insufficient ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className="flex items-start gap-3">
                      <Wallet className={`h-5 w-5 mt-0.5 ${insufficient ? "text-red-600" : "text-emerald-700"}`} />
                      <div className="text-sm">
                        <div className={`font-semibold ${insufficient ? "text-red-800" : "text-emerald-900"}`}>
                          Pre-transfer balance check
                        </div>
                        <div className={`mt-0.5 ${insufficient ? "text-red-700" : "text-emerald-800"}`}>
                          Current balance <span className="font-semibold tabular-nums">{fmt(fromBalance)}</span> → after
                          transfer <span className="font-semibold tabular-nums">{fmt(postBalance)}</span>.
                          {insufficient ? " Insufficient funds — this transfer will fail." : " Funds are available."}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Footer>
                    <button
                      type="button"
                      onClick={() => setStage({ kind: "form" })}
                      className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-4 w-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={submitTransfer}
                      className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 text-slate-900 text-sm font-bold border border-amber-700/40 shadow"
                    >
                      Confirm & Send
                    </button>
                  </Footer>
                </Section>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> 256-bit TLS encryption · FDIC certificate #48291
            </p>
          </>
        ) : null}

        {stage.kind === "success" && (
          <StatusCard
            tone="success"
            icon={<CheckCircle2 className="h-10 w-10" />}
            title="Transfer Successful"
            subtitle="Your funds have been sent. A receipt is ready for your records."
          >
            <SummaryRows
              rows={[
                ["Amount", fmt(amountNum), true],
                ["Recipient", recipientName],
                ["Bank", recipientBank],
                ["Transaction ID", stage.txId, true],
                ["Date", new Date().toLocaleString()],
              ]}
            />
            <Actions>
              <button
                type="button"
                onClick={() =>
                  downloadReceipt({
                    amount: amountNum,
                    recipient: recipientName,
                    bank: recipientBank,
                    txId: stage.txId,
                  })
                }
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                <Download className="h-4 w-4" /> Download Receipt
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
              >
                New Transfer
              </button>
            </Actions>
          </StatusCard>
        )}

        {stage.kind === "pending" && (
          <StatusCard
            tone="pending"
            icon={<Clock className="h-10 w-10" />}
            title="Processing Transfer"
            subtitle="Large transfers are reviewed for your protection."
          >
            <SummaryRows
              rows={[
                ["Amount", fmt(amountNum), true],
                ["Recipient", recipientName],
                ["Tracking Number", stage.trackingId, true],
                ["Estimated Arrival", stage.eta],
              ]}
            />
            <div className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              You'll receive an email and in-app notification once the transfer settles.
            </div>
            <Actions>
              <Link
                to="/"
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </Link>
              <button
                type="button"
                onClick={resetAll}
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-lg border border-slate-300 text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                New Transfer
              </button>
            </Actions>
          </StatusCard>
        )}

        {stage.kind === "failed" && (
          <StatusCard
            tone="failed"
            icon={<AlertTriangle className="h-10 w-10" />}
            title="Transfer Failed"
            subtitle={stage.message}
          >
            <SummaryRows
              rows={[
                ["Amount", fmt(amountNum), true],
                ["Recipient", recipientName || "—"],
                ["Error Code", stage.code, true],
                ["Date", new Date().toLocaleString()],
              ]}
            />
            <Actions>
              <button
                type="button"
                onClick={() => setStage({ kind: "form" })}
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
              >
                <RefreshCw className="h-4 w-4" /> Try Again
              </button>
              <a
                href="mailto:support@dynamicbankofwest.example"
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-lg border border-slate-300 text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                Contact Support
              </a>
            </Actions>
          </StatusCard>
        )}
      </main>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: "Recipient" },
    { n: 2, label: "Amount" },
    { n: 3, label: "Review" },
  ];
  return (
    <ol className="flex items-center gap-2 sm:gap-4 mb-6">
      {items.map((it, i) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <li key={it.n} className="flex items-center gap-2 sm:gap-4 flex-1">
            <div
              className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                done
                  ? "bg-emerald-600 text-white"
                  : active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : it.n}
            </div>
            <span
              className={`text-xs sm:text-sm font-medium ${
                active ? "text-slate-900" : done ? "text-emerald-700" : "text-slate-500"
              }`}
            >
              {it.label}
            </span>
            {i < items.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-lg bg-slate-900 text-amber-300 flex items-center justify-center">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error && <span className="block mt-1 text-xs text-red-600">{error}</span>}
    </label>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">{children}</div>;
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</span>
      <span
        className={`text-sm text-slate-900 ${mono ? "font-mono tabular-nums" : ""} ${
          strong ? "font-bold text-base" : "font-semibold"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusCard({
  tone,
  icon,
  title,
  subtitle,
  children,
}: {
  tone: "success" | "pending" | "failed";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const tones = {
    success: { ring: "ring-emerald-100", bg: "bg-emerald-50", text: "text-emerald-600", bar: "from-emerald-500 to-emerald-600" },
    pending: { ring: "ring-amber-100", bg: "bg-amber-50", text: "text-amber-600", bar: "from-amber-400 to-amber-500" },
    failed: { ring: "ring-red-100", bg: "bg-red-50", text: "text-red-600", bar: "from-red-500 to-red-600" },
  }[tone];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${tones.bar}`} />
      <div className="px-6 sm:px-8 pt-10 pb-6 text-center">
        <div className={`mx-auto h-20 w-20 rounded-full ring-8 ${tones.ring} ${tones.bg} ${tones.text} flex items-center justify-center`}>
          {icon}
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">{subtitle}</p>
      </div>
      <div className="px-6 sm:px-8 pb-8">{children}</div>
      <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Shield className="h-3 w-3" /> Secure transfer · For security, never share your transaction ID.
        </p>
      </div>
    </div>
  );
}

function SummaryRows({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
      {rows.map(([k, v, mono]) => (
        <Row key={k} label={k} value={v} mono={mono} />
      ))}
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-col sm:flex-row gap-3">{children}</div>;
}

function downloadReceipt(d: { amount: number; recipient: string; bank: string; txId: string }) {
  const body = [
    "DYNAMIC BANK OF WEST",
    "Transfer Receipt",
    "----------------------------------",
    `Date:         ${new Date().toLocaleString()}`,
    `Recipient:    ${d.recipient}`,
    `Bank:         ${d.bank}`,
    `Amount:       ${fmt(d.amount)}`,
    `Transaction:  ${d.txId}`,
    "",
    "Keep this receipt for your records.",
  ].join("\n");
  const blob = new Blob([body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dbw-receipt-${d.txId}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// satisfy lint for unused icon imports
void FileText;
