import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, AlertCircle, Download, ArrowLeft, LifeBuoy, RefreshCw } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  status: z.enum(["success", "pending", "failed"]).catch("success"),
  amount: z.string().optional(),
  recipient: z.string().optional(),
  reference: z.string().optional(),
  date: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/transfer-confirmation")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Transfer Confirmation — Dynamic Bank of West" },
      { name: "description", content: "Status of your fund transfer." },
    ],
  }),
  component: TransferConfirmationPage,
});

function fmtAmount(a?: string) {
  if (!a) return "—";
  const n = Number(a);
  if (!Number.isFinite(n)) return a;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function TransferConfirmationPage() {
  const search = Route.useSearch();
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <TransferStatus
        status={search.status}
        amount={search.amount}
        recipient={search.recipient}
        reference={search.reference ?? "DBW-" + Math.random().toString(36).slice(2, 10).toUpperCase()}
        date={search.date ?? new Date().toISOString().slice(0, 10)}
        errorMessage={search.error}
      />
    </div>
  );
}

export type TransferStatusKind = "success" | "pending" | "failed";

export function TransferStatus({
  status,
  amount,
  recipient,
  reference,
  date,
  errorMessage,
}: {
  status: TransferStatusKind;
  amount?: string;
  recipient?: string;
  reference: string;
  date: string;
  errorMessage?: string;
}) {
  const cfg = {
    success: {
      Icon: CheckCircle2,
      iconClass: "text-emerald-500 bg-emerald-50 ring-emerald-100",
      headline: "Transfer Successful",
      subline: "Your funds have been moved and the receipt is ready to download.",
    },
    pending: {
      Icon: Clock,
      iconClass: "text-amber-500 bg-amber-50 ring-amber-100",
      headline: "Transfer Pending",
      subline: "Funds are being processed. Expected completion: 1–2 business days.",
    },
    failed: {
      Icon: AlertCircle,
      iconClass: "text-red-600 bg-red-50 ring-red-100",
      headline: "Transfer Failed",
      subline: errorMessage || "We couldn't complete this transfer. Please review the details and try again.",
    },
  }[status];

  const { Icon } = cfg;

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 text-slate-900 text-[10px] font-bold flex items-center justify-center shadow ring-1 ring-amber-600/40">
            DBW
          </div>
          <div className="text-white text-sm font-semibold tracking-wide">DYNAMIC BANK OF WEST</div>
        </div>

        <div className="px-8 pt-10 pb-8 text-center">
          <div className={`mx-auto h-20 w-20 rounded-full ring-8 flex items-center justify-center ${cfg.iconClass}`}>
            <Icon className="h-10 w-10" strokeWidth={2.25} />
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-slate-900 tracking-tight">{cfg.headline}</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">{cfg.subline}</p>
        </div>

        <div className="px-8 pb-8">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-100">
            <Row label="Amount" value={fmtAmount(amount)} mono />
            <Row label="Recipient" value={recipient || "—"} />
            <Row label="Date" value={date} />
            <Row label="Reference ID" value={reference} mono />
            {status === "failed" && errorMessage && (
              <Row label="Reason" value={errorMessage} valueClass="text-red-700" />
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {status === "success" && (
              <>
                <button
                  type="button"
                  onClick={() => downloadReceipt({ amount, recipient, reference, date })}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 text-slate-900 text-sm font-bold py-2.5 rounded-md shadow border border-amber-700/40"
                >
                  <Download className="h-4 w-4" /> Download Receipt
                </button>
                <Link
                  to="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-md"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Link>
              </>
            )}
            {status === "pending" && (
              <>
                <button
                  type="button"
                  disabled
                  title="Receipt available once the transfer settles."
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-400 text-sm font-bold py-2.5 rounded-md border border-slate-200 cursor-not-allowed"
                >
                  <Download className="h-4 w-4" /> Receipt Unavailable
                </button>
                <Link
                  to="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-md"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Link>
              </>
            )}
            {status === "failed" && (
              <>
                <a
                  href="mailto:support@dynamicbankofwest.example"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-b from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white text-sm font-bold py-2.5 rounded-md shadow"
                >
                  <LifeBuoy className="h-4 w-4" /> Contact Support
                </a>
                <Link
                  to="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-md"
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500">
            🔒 For security, never share your reference ID with anyone.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</span>
      <span className={`text-sm font-semibold text-slate-900 ${mono ? "tabular-nums font-mono" : ""} ${valueClass ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

function downloadReceipt(d: { amount?: string; recipient?: string; reference: string; date: string }) {
  const body = [
    "DYNAMIC BANK OF WEST",
    "Transfer Receipt",
    "----------------------------------",
    `Date:       ${d.date}`,
    `Recipient:  ${d.recipient ?? "—"}`,
    `Amount:     ${fmtAmount(d.amount)}`,
    `Reference:  ${d.reference}`,
    "",
    "Keep this receipt for your records.",
  ].join("\n");
  const blob = new Blob([body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dbw-receipt-${d.reference}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
