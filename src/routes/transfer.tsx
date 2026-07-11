import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Shield, Users, DollarSign, Building2 } from "lucide-react";
import { jsPDF } from "jspdf";
import {
  currentUser, genRef, fmtCurrency, onStoreChange,
  type MtUser, type PendingTx,
} from "@/lib/mt-store";
import { insertPending } from "@/lib/mt-db";

// Local ABA routing lookup — extend as needed. Real, verifiable HQ addresses.
const ROUTING_DB: Record<string, { name: string; address: string }> = {
  "021000021": { name: "JPMorgan Chase Bank, N.A.", address: "383 Madison Avenue, New York, NY 10179" },
  "121000248": { name: "Wells Fargo Bank, N.A.",    address: "420 Montgomery Street, San Francisco, CA 94104" },
  "026009593": { name: "Bank of America, N.A.",     address: "100 North Tryon Street, Charlotte, NC 28255" },
  "021000089": { name: "Citibank, N.A.",            address: "388 Greenwich Street, New York, NY 10013" },
  "031176110": { name: "Capital One, N.A.",         address: "1680 Capital One Drive, McLean, VA 22102" },
  "071000013": { name: "The Northern Trust Company", address: "50 South LaSalle Street, Chicago, IL 60603" },
  "322271627": { name: "JPMorgan Chase Bank (CA)",  address: "270 Park Avenue, New York, NY 10017" },
  "011401533": { name: "TD Bank, N.A.",             address: "1701 Route 70 East, Cherry Hill, NJ 08034" },
  "124003116": { name: "Zions Bank",                address: "One South Main Street, Salt Lake City, UT 84133" },
  "064000017": { name: "Truist Bank",               address: "214 North Tryon Street, Charlotte, NC 28202" },
};


export const Route = createFileRoute("/transfer")({
  head: () => ({
    meta: [
      { title: "Fund Transfers — Dynamic Bank of West" },
      { name: "description", content: "Send money securely between accounts and to external beneficiaries." },
    ],
  }),
  component: TransferPage,
});

function TransferPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<MtUser | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientAcct, setRecipientAcct] = useState("");
  const [routingCode, setRoutingCode] = useState("");
  const [recipientBank, setRecipientBank] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initiated, setInitiated] = useState<PendingTx | null>(null);

  useEffect(() => {
    setUser(currentUser());
    return onStoreChange(() => setUser(currentUser()));
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 text-center">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Please sign in</div>
          <Link to="/" className="inline-block mt-4 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">Return to sign in</Link>
        </div>
      </div>
    );
  }

  const amountNum = Number(amount);
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;
  const insufficient = validAmount && amountNum > user.balance;

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!recipientName.trim()) e.name = "Recipient name is required.";
    if (recipientAcct.replace(/\D/g, "").length < 4) e.acct = "Enter a valid account number.";
    if (routingCode.replace(/\D/g, "").length !== 9) e.routing = "Routing code must be 9 digits.";
    if (!recipientBank.trim()) e.bank = "Recipient bank is required.";
    setErrors(e); return Object.keys(e).length === 0;
  }
  function validateStep2() {
    const e: Record<string, string> = {};
    if (!validAmount) e.amount = "Enter an amount greater than $0.";
    if (insufficient) e.amount = "Amount exceeds your available balance.";
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function submitTransfer() {
    const ref = genRef("DBW-XFR");
    const tx: PendingTx = {
      id: ref, userId: user!.id, userName: user!.name,
      method: "Transfer", amount: amountNum,
      submitted: new Date().toISOString().slice(0, 10),
      status: "Pending", reference: ref, direction: "debit",
      memo, recipient: recipientName, recipientBank, recipientAcct, routing: routingCode,
    };
    try {
      await insertPending({
        reference: ref, user_id: user!.id, user_name: user!.name,
        method: "Transfer", direction: "debit", amount: amountNum,
        memo, recipient: recipientName, recipient_bank: recipientBank,
        recipient_acct: recipientAcct, routing: routingCode,
      });
      setInitiated(tx);
    } catch (e) {
      setErrors({ amount: `Submission failed: ${(e as Error).message}` });
    }
  }

  if (initiated) {
    return <TransferInitiated tx={initiated} onDone={() => navigate({ to: "/" })} />;
  }



  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-600/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 text-slate-900 text-[11px] font-extrabold flex items-center justify-center shadow ring-1 ring-amber-600/40">DBW</div>
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
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Fund Transfers</h1>
          <p className="text-sm text-slate-600 mt-1">All external transfers enter compliance review before releasing funds.</p>
        </div>

        <Stepper step={step} />

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {step === 1 && (
            <Section icon={<Users className="h-4 w-4" />} title="Recipient Details">
              <div className="space-y-4">
                <Field label="Recipient Full Name" error={errors.name}>
                  <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Jane Carter" className={inputCls} />
                </Field>
                <Field label="Recipient Bank" error={errors.bank}>
                  <input value={recipientBank} onChange={(e) => setRecipientBank(e.target.value)} placeholder="e.g. Chase Bank" className={inputCls} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Routing Code (9 digits)" error={errors.routing}>
                    <input value={routingCode} onChange={(e) => setRoutingCode(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" placeholder="121000248" className={inputCls} />
                  </Field>
                  <Field label="Account Number" error={errors.acct}>
                    <input value={recipientAcct} onChange={(e) => setRecipientAcct(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="000000000000" className={inputCls} />
                  </Field>
                </div>
              </div>
              <Footer>
                <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">Cancel</Link>
                <button type="button" onClick={() => validateStep1() && setStep(2)} className={btnPrimary}>
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </Footer>
            </Section>
          )}

          {step === 2 && (
            <Section icon={<DollarSign className="h-4 w-4" />} title="Amount & Source">
              <div className="space-y-5">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">From</div>
                    <div className="text-sm font-semibold text-slate-900">{user.name} · {user.account}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Available</div>
                    <div className="text-sm font-mono font-semibold text-slate-900">{fmtCurrency(user.balance)}</div>
                  </div>
                </div>

                <Field label="Amount (USD)" error={errors.amount}>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">$</span>
                    <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00"
                      className="w-full h-14 pl-9 pr-4 rounded-lg border border-slate-300 bg-white text-slate-900 text-2xl tabular-nums font-semibold focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none" />
                  </div>
                </Field>

                <Field label="Memo (optional)">
                  <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What's this for?" className={inputCls} />
                </Field>
              </div>
              <Footer>
                <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-600 inline-flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</button>
                <button type="button" onClick={() => validateStep2() && setStep(3)} className={btnPrimary}>Review <ArrowRight className="h-4 w-4" /></button>
              </Footer>
            </Section>
          )}

          {step === 3 && (
            <Section icon={<Shield className="h-4 w-4" />} title="Review & Submit">
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
                <Row label="From" value={`${user.name} (${user.account})`} />
                <Row label="Recipient" value={recipientName} />
                <Row label="Bank" value={recipientBank} />
                <Row label="Routing" value={routingCode} mono />
                <Row label="Account" value={`•••• ${recipientAcct.slice(-4)}`} mono />
                <Row label="Amount" value={fmtCurrency(amountNum)} mono strong />
                {memo && <Row label="Memo" value={memo} />}
              </div>
              <Footer>
                <button type="button" onClick={() => setStep(2)} className="text-sm text-slate-600 inline-flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" /> Edit</button>
                <button type="button" onClick={submitTransfer} className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 text-slate-900 text-sm font-bold border border-amber-700/40 shadow">
                  Submit for Review
                </button>
              </Footer>
            </Section>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> All transfers held pending compliance review.
        </p>
      </main>
    </div>
  );
}

function TransferInitiated({ tx, onDone }: { tx: PendingTx; onDone: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />
        <div className="px-8 py-10 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-emerald-50 ring-8 ring-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="h-11 w-11 text-emerald-600" strokeWidth={2.25} />
          </div>
          <div className="mt-6 text-[10px] uppercase tracking-[0.28em] text-emerald-700 font-semibold">Transfer Initiated</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 tracking-tight">Your transfer request has been queued</h1>
          <p className="mt-3 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Your transfer request has been successfully queued. Please note that processing standard external or non-instant pipeline transfers generally takes 1 to 2 business days to settle.
          </p>

          <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50/70 divide-y divide-slate-100 text-left">
            <Row label="Reference" value={tx.reference} mono />
            <Row label="Amount" value={fmtCurrency(tx.amount)} mono strong />
            <Row label="Recipient" value={tx.recipient ?? ""} />
            <Row label="Submitted" value={tx.submitted} />
            <Row label="Status" value="Queued for processing" />
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onDone}
              className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 text-slate-900 text-sm font-bold border border-amber-700/40 shadow"
            >
              <ArrowLeft className="h-4 w-4" /> Return to Account Overview
            </button>
            <button
              type="button"
              onClick={() => downloadTransferReceiptPdf(tx)}
              className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-[#0a2540] hover:bg-[#0f3160] text-white text-sm font-semibold border border-[#0a2540] shadow"
            >
              <Download className="h-4 w-4" /> Download PDF Receipt
            </button>
          </div>
          <p className="mt-4 text-[11px] text-slate-500">You will receive a settlement notification once the pipeline clears. Your account remains fully accessible.</p>

        </div>
      </div>
    </div>
  );
}

function downloadTransferReceiptPdf(tx: PendingTx) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(10, 37, 64);
  doc.rect(0, 0, w, 90, "F");
  doc.setFillColor(245, 191, 66);
  doc.rect(0, 90, w, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("DYNAMIC BANK OF WEST", 48, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(245, 191, 66);
  doc.text("Transfer Receipt · Treasury Operations", 48, 66);

  // Body
  doc.setTextColor(20, 30, 48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Transfer Initiated", 48, 140);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const wrapped = doc.splitTextToSize(
    "Your transfer request has been successfully queued. Please note that processing standard external or non-instant pipeline transfers generally takes 1 to 2 business days to settle.",
    w - 96,
  );
  doc.text(wrapped, 48, 164);

  // Detail table
  const rows: Array<[string, string]> = [
    ["Reference", tx.reference],
    ["Amount (USD)", fmtCurrency(tx.amount)],
    ["Recipient", tx.recipient ?? "—"],
    ["Recipient Bank", tx.recipientBank ?? "—"],
    ["Routing", tx.routing ?? "—"],
    ["Account", tx.recipientAcct ? `•••• ${tx.recipientAcct.slice(-4)}` : "—"],
    ["Submitted", tx.submitted],
    ["Status", "Pending — 1–2 business days"],
  ];
  let y = 230;
  doc.setDrawColor(220, 226, 236);
  doc.setLineWidth(0.5);
  doc.rect(48, y - 18, w - 96, rows.length * 26 + 8);
  rows.forEach((r, i) => {
    if (i > 0) doc.line(48, y - 8, w - 48, y - 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(9);
    doc.text(r[0].toUpperCase(), 60, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 30, 48);
    doc.setFontSize(11);
    doc.text(r[1], w - 60, y + 4, { align: "right" });
    y += 26;
  });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Dynamic Bank of West, N.A. · Member FDIC · Keep this receipt for your records.",
    w / 2,
    doc.internal.pageSize.getHeight() - 40,
    { align: "center" },
  );

  doc.save(`DBW-Transfer-Receipt-${tx.reference}.pdf`);
}



// -- small primitives ---------------------------------------------------------

const inputCls = "w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none";
const btnPrimary = "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800";

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [{ n: 1, label: "Recipient" }, { n: 2, label: "Amount" }, { n: 3, label: "Review" }];
  return (
    <ol className="flex items-center gap-2 sm:gap-4 mb-6">
      {items.map((it, i) => {
        const active = step === it.n; const done = step > it.n;
        return (
          <li key={it.n} className="flex items-center gap-2 sm:gap-4 flex-1">
            <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-emerald-600 text-white" : active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"}`}>{done ? "✓" : it.n}</div>
            <span className={`text-xs sm:text-sm font-medium ${active ? "text-slate-900" : done ? "text-emerald-700" : "text-slate-500"}`}>{it.label}</span>
            {i < items.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-lg bg-slate-900 text-amber-300 flex items-center justify-center">{icon}</div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
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
    <div className="flex items-center justify-between px-5 py-3.5 gap-3">
      <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</span>
      <span className={`text-sm text-slate-900 text-right break-all ${mono ? "font-mono tabular-nums" : ""} ${strong ? "font-bold text-base" : "font-semibold"}`}>{value}</span>
    </div>
  );
}
