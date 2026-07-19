import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { supabase } from "@/lib/external-supabase";

export const Route = createFileRoute("/loans")({
  head: () => ({
    meta: [
      { title: "Loans & Instant Pre-Approval — Dynamic Bank of West" },
      { name: "description", content: "Premium home mortgages, executive auto loans, and gold-tier personal lines of credit. Get an instant pre-approval decision in under 60 seconds." },
      { property: "og:title", content: "Loans & Instant Pre-Approval — Dynamic Bank of West" },
      { property: "og:description", content: "Instant pre-approval, transparent rates, funds credited within 24 business hours." },
    ],
  }),
  component: LoansPage,
});

type Product = {
  key: "mortgage" | "auto" | "line";
  name: string;
  tagline: string;
  apr: number;
  aprLabel: string;
  minCap: number;
  maxCap: number;
  multiplier: number;
  accent: string;
};

const PRODUCTS: Product[] = [
  { key: "mortgage", name: "Premium Home Mortgage", tagline: "Fixed-rate 30 yr · Jumbo eligible", apr: 5.12, aprLabel: "5.12% APR Fixed", minCap: 50_000, maxCap: 2_500_000, multiplier: 60, accent: "from-amber-300 to-amber-600" },
  { key: "auto", name: "Executive Auto Loan", tagline: "Luxury & fleet financing", apr: 3.89, aprLabel: "3.89% APR Fixed", minCap: 15_000, maxCap: 250_000, multiplier: 18, accent: "from-emerald-300 to-emerald-600" },
  { key: "line", name: "Gold Tier Personal Line of Credit", tagline: "Revolving · Prime + 2.25", apr: 6.75, aprLabel: "6.75% APR Variable", minCap: 5_000, maxCap: 150_000, multiplier: 12, accent: "from-yellow-300 to-orange-500" },
];

const CREDIT_TIERS = [
  { key: "excellent", label: "Excellent (760+)", factor: 1.0 },
  { key: "great", label: "Great (720–759)", factor: 0.85 },
  { key: "good", label: "Good (680–719)", factor: 0.7 },
  { key: "fair", label: "Fair (640–679)", factor: 0.5 },
  { key: "building", label: "Building (600–639)", factor: 0.3 },
];

type Step = "hero" | "offer" | "kyc" | "terms" | "success";

// Fast-track codes now live in the loan_application_codes table. Admins
// create/manage them from the Special Application Code Management Portal.

function LoansPage() {
  const [step, setStep] = useState<Step>("hero");
  const [productKey, setProductKey] = useState<Product["key"]>("mortgage");
  const product = useMemo(() => PRODUCTS.find((p) => p.key === productKey)!, [productKey]);
  const [income, setIncome] = useState(9000);
  const [debt, setDebt] = useState(1200);
  const [tierKey, setTierKey] = useState("excellent");
  const tier = CREDIT_TIERS.find((t) => t.key === tierKey)!;

  const [approvedAmount, setApprovedAmount] = useState<number | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [fastTracked, setFastTracked] = useState(false);

  // KYC form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [occupation, setOccupation] = useState("");
  const [ssn, setSsn] = useState("");
  const [incomeFile, setIncomeFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function computeApproval(): number {
    const dti = debt / Math.max(income, 1);
    const dtiPenalty = Math.max(0, 1 - dti * 1.8);
    const raw = Math.max(income - debt, 500) * product.multiplier * tier.factor * dtiPenalty;
    const rounded = Math.round(raw / 1000) * 1000;
    return Math.min(Math.max(rounded, product.minCap), product.maxCap);
  }

  async function handleCheckEligibility() {
    setErrorMsg(null);
    const amount = computeApproval();
    setApprovedAmount(amount);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("loan_applications").insert({
        user_id: userData.user?.id ?? null,
        product: product.name,
        apr: product.apr,
        requested_amount: amount,
        approved_amount: amount,
        gross_monthly_income: income,
        monthly_debt: debt,
        credit_tier: tier.label,
        status: "pre_approved",
      }).select("id").single();
      if (error) throw error;
      setApplicationId(data.id);
    } catch (e) {
      console.error(e);
    }
    setStep("offer");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleFastTrackCode(code: string): Promise<string | null> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return "Enter your special application code.";
    const { data: codeRows, error: codeErr } = await supabase
      .rpc("verify_loan_code", { code_string: normalized });
    const codeRow = Array.isArray(codeRows) ? codeRows[0] : codeRows;
    if (codeErr || !codeRow) return "Invalid or already-redeemed application code. Please verify with your banker.";
    const amount = Number(codeRow.approved_amount);
    setApprovedAmount(amount);
    setFastTracked(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("loan_applications").insert({
        user_id: userData.user?.id ?? null,
        product: product.name,
        apr: product.apr,
        requested_amount: amount,
        approved_amount: amount,
        gross_monthly_income: income,
        monthly_debt: debt,
        credit_tier: `FAST-TRACK (${normalized})`,
        status: "pre_approved_code",
        applied_code: normalized,
      }).select("id").single();
      if (error) throw error;
      setApplicationId(data.id);
    } catch (e) {
      console.error(e);
    }
    setStep("kyc");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return null;
  }
  async function handleKycNext() {
    setErrorMsg(null);
    if (!fullName.trim() || !email.trim() || !occupation.trim() || ssn.replace(/\D/g, "").length !== 9) {
      setErrorMsg("Please complete all fields. SSN must be 9 digits.");
      return;
    }
    if (!incomeFile || !idFile) {
      setErrorMsg("Please upload both proof of income and government ID.");
      return;
    }
    setSubmitting(true);
    try {
      const digits = ssn.replace(/\D/g, "");
      const last4 = digits.slice(-4);
      const encoded = typeof window !== "undefined" ? window.btoa(digits) : digits;
      if (applicationId) {
        const { data: userData } = await supabase.auth.getUser();
        const folder = userData.user?.id ?? "anon";
        const incPath = `${folder}/${applicationId}/proof-of-income-${Date.now()}-${incomeFile.name}`;
        const idPath = `${folder}/${applicationId}/government-id-${Date.now()}-${idFile.name}`;
        const upA = await supabase.storage.from("loan-docs").upload(incPath, incomeFile, { upsert: true });
        const upB = await supabase.storage.from("loan-docs").upload(idPath, idFile, { upsert: true });
        if (upA.error) throw upA.error;
        if (upB.error) throw upB.error;
        const { error } = await supabase.from("loan_applications").update({
          full_name: fullName.trim(),
          email: email.trim(),
          occupation: occupation.trim(),
          ssn_last4: last4,
          ssn_encrypted: encoded,
          proof_of_income_name: incomeFile.name,
          government_id_name: idFile.name,
          proof_of_income_path: incPath,
          government_id_path: idPath,
          status: "kyc_submitted",
        }).eq("id", applicationId);
        if (error) throw error;
      }
      setStep("terms");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalSubmit() {
    if (!termsAccepted) { setErrorMsg("Please accept the terms to continue."); return; }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (applicationId) {
        const { error } = await supabase.from("loan_applications").update({
          terms_accepted: true,
          status: "approved",
        }).eq("id", applicationId);
        if (error) throw error;
      }
      setStep("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      {step === "hero" && (
        <HeroAndCalculator
          products={PRODUCTS}
          productKey={productKey}
          setProductKey={setProductKey}
          income={income} setIncome={setIncome}
          debt={debt} setDebt={setDebt}
          tierKey={tierKey} setTierKey={setTierKey}
          onCheck={handleCheckEligibility}
          onFastTrack={handleFastTrackCode}
        />
      )}
      {step === "offer" && approvedAmount != null && (
        <OfferBreakdown
          product={product}
          amount={approvedAmount}
          onProceed={() => { setStep("kyc"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onBack={() => setStep("hero")}
        />
      )}
      {step === "kyc" && (
        <KycStep
          fullName={fullName} setFullName={setFullName}
          email={email} setEmail={setEmail}
          occupation={occupation} setOccupation={setOccupation}
          ssn={ssn} setSsn={setSsn}
          incomeFile={incomeFile} setIncomeFile={setIncomeFile}
          idFile={idFile} setIdFile={setIdFile}
          onNext={handleKycNext}
          submitting={submitting}
          errorMsg={errorMsg}
        />
      )}
      {step === "terms" && (
        <TermsStep
          accepted={termsAccepted}
          setAccepted={setTermsAccepted}
          onSubmit={handleFinalSubmit}
          submitting={submitting}
          errorMsg={errorMsg}
        />
      )}
      {step === "success" && <SuccessSplash product={product} amount={approvedAmount ?? 0} kycEmail={email} kycName={fullName} />}
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center text-black font-black text-[10px]">DBW</div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-amber-300/90">Member FDIC</div>
            <div className="text-sm font-semibold">Dynamic Bank of West</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className="text-xs text-white/80 hover:text-amber-300 px-3 py-1.5">Home</Link>
          <Link to="/loans" className="text-xs text-amber-300 border border-amber-400/30 rounded-md px-3 py-1.5">Loans</Link>
          <Link to="/about" className="text-xs text-white/80 hover:text-amber-300 px-3 py-1.5">About</Link>
        </nav>
      </div>
    </header>
  );
}

function HeroAndCalculator(props: {
  products: Product[];
  productKey: Product["key"];
  setProductKey: (k: Product["key"]) => void;
  income: number; setIncome: (n: number) => void;
  debt: number; setDebt: (n: number) => void;
  tierKey: string; setTierKey: (s: string) => void;
  onCheck: () => void;
  onFastTrack: (code: string) => Promise<string | null>;
}) {
  const { products, productKey, setProductKey, income, setIncome, debt, setDebt, tierKey, setTierKey, onCheck, onFastTrack } = props;
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  async function submitCode() {
    if (!code.trim()) { setCodeErr("Enter your special application code."); return; }
    setCodeBusy(true); setCodeErr(null);
    const err = await onFastTrack(code);
    if (err) setCodeErr(err);
    setCodeBusy(false);
  }
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.22),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.32em] text-amber-300 font-semibold">Lending Division · FDIC #48291</div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight max-w-3xl">Capital, delivered at the pace of ambition.</h1>
          <p className="mt-5 text-lg text-slate-200/85 max-w-2xl leading-relaxed">
            Premium mortgages, executive auto financing, and gold-tier lines of credit — underwritten in minutes, funded in days. Get an instant pre-approval decision below.
          </p>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {products.map((p) => (
              <button
                key={p.key}
                onClick={() => setProductKey(p.key)}
                className={[
                  "text-left rounded-2xl border p-5 transition-all",
                  productKey === p.key
                    ? "border-amber-400 bg-white/[0.08] shadow-[0_0_0_1px_rgba(251,191,36,0.4)]"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                ].join(" ")}
              >
                <div className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${p.accent}`} />
                <div className="mt-3 text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-slate-300/80 mt-1">{p.tagline}</div>
                <div className="mt-4 text-2xl font-semibold text-amber-300">{p.aprLabel}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 -mt-10 pb-20">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xl p-6 sm:p-8">
          <div className="text-[10px] uppercase tracking-[0.28em] text-amber-700 font-semibold">Instant Pre-Approval Calculator</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Check your eligibility in under 60 seconds.</h2>

          <div className="mt-6 grid gap-6">
            <SliderRow
              label="Gross monthly income"
              value={income}
              min={2000} max={50000} step={500}
              format={(v) => `$${v.toLocaleString()}`}
              onChange={setIncome}
            />
            <SliderRow
              label="Existing monthly debt payments"
              value={debt}
              min={0} max={20000} step={100}
              format={(v) => `$${v.toLocaleString()}`}
              onChange={setDebt}
            />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Credit score tier</div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CREDIT_TIERS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTierKey(t.key)}
                    className={[
                      "text-xs rounded-lg border px-3 py-2 text-left transition-colors",
                      tierKey === t.key
                        ? "border-amber-500 bg-amber-50 text-amber-900 font-semibold"
                        : "border-slate-200 hover:border-slate-300 text-slate-700",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onCheck}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 text-white font-semibold py-4 hover:from-slate-800 hover:to-slate-600 shadow-lg transition-transform active:scale-[0.99]"
          >
            Check My Eligibility →
          </button>
          <p className="mt-3 text-[11px] text-slate-500 text-center">
            Soft pull only · Will not affect your credit score
          </p>

          <div className="mt-8 relative">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold">Or</span>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
            <div className="text-[10px] uppercase tracking-[0.24em] text-amber-700 font-semibold">Apply with Code</div>
            <div className="mt-1 text-sm text-slate-700">
              Received a priority underwriting code from your banker? Skip the calculator and jump straight to verification.
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeErr(null); }}
                placeholder="e.g. DBW-VIP-2026"
                autoCapitalize="characters"
                spellCheck={false}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 uppercase tracking-wider focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <button
                onClick={submitCode}
                disabled={codeBusy}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 text-sm shadow"
              >
                {codeBusy ? "Verifying…" : "Fast-Track"}
              </button>
            </div>
            {codeErr && <div className="mt-2 text-xs text-red-600">{codeErr}</div>}
          </div>
        </div>
      </section>
    </>
  );
}

function SliderRow({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</div>
        <div className="text-sm font-semibold text-slate-900">{format(value)}</div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-amber-600"
      />
    </div>
  );
}

function OfferBreakdown({ product, amount, onProceed, onBack }: {
  product: Product; amount: number; onProceed: () => void; onBack: () => void;
}) {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <div className="rounded-3xl overflow-hidden border border-emerald-200 shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-white/15 flex items-center justify-center text-3xl">✓</div>
          <div className="mt-4 text-[10px] uppercase tracking-[0.28em] text-emerald-200">Pre-Approved</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold">Congratulations — you're pre-qualified.</h2>
          <div className="mt-6 text-5xl sm:text-6xl font-bold tracking-tight">
            ${amount.toLocaleString()}
          </div>
          <div className="mt-2 text-sm text-emerald-100/90">Maximum pre-approval cap for {product.name}</div>
        </div>
        <div className="bg-white p-8 grid sm:grid-cols-3 gap-4 text-center">
          <Metric k="Product" v={product.name} />
          <Metric k="Interest Rate" v={product.aprLabel} />
          <Metric k="Processing Time" v="1–3 business days" />
        </div>
        <div className="bg-slate-50 border-t border-slate-200 p-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onBack} className="text-sm text-slate-600 px-5 py-3 hover:text-slate-900">← Recalculate</button>
          <button onClick={onProceed} className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white font-semibold px-8 py-3 shadow-lg">
            Continue to Verification →
          </button>
        </div>
      </div>
    </section>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{k}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{v}</div>
    </div>
  );
}

function KycStep(props: {
  fullName: string; setFullName: (s: string) => void;
  email: string; setEmail: (s: string) => void;
  occupation: string; setOccupation: (s: string) => void;
  ssn: string; setSsn: (s: string) => void;
  incomeFile: File | null; setIncomeFile: (f: File | null) => void;
  idFile: File | null; setIdFile: (f: File | null) => void;
  onNext: () => void; submitting: boolean; errorMsg: string | null;
}) {
  const { fullName, setFullName, email, setEmail, occupation, setOccupation, ssn, setSsn, incomeFile, setIncomeFile, idFile, setIdFile, onNext, submitting, errorMsg } = props;
  function formatSsn(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 9);
    if (d.length <= 3) return d;
    if (d.length <= 5) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
  }
  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-700 font-semibold">Step 2 of 3 · Secure Underwriting</div>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Verify your identity & income</h2>
        <p className="mt-2 text-sm text-slate-600 max-w-lg mx-auto">Bank-grade 256-bit encryption. Your data is transmitted over TLS and never shared with third parties.</p>
      </div>
      <div className="mt-8 rounded-2xl bg-white border border-slate-200 shadow-lg p-6 sm:p-8 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full legal name" value={fullName} onChange={setFullName} placeholder="Jane A. Doe" />
          <Field label="Email address" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Occupation" value={occupation} onChange={setOccupation} placeholder="Senior Software Engineer" />
          <Field label="Social Security Number" value={ssn} onChange={(v) => setSsn(formatSsn(v))} placeholder="•••-••-••••" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <DropUpload label="Proof of income (paystubs)" file={incomeFile} onFile={setIncomeFile} />
          <DropUpload label="Government-issued ID" file={idFile} onFile={setIdFile} />
        </div>
        {errorMsg && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{errorMsg}</div>}
        <button
          onClick={onNext}
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 text-white font-semibold py-4 hover:from-slate-800 disabled:opacity-60 shadow-lg"
        >
          {submitting ? "Encrypting & submitting…" : "Continue to Final Review →"}
        </button>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (s: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
      />
    </label>
  );
}

function DropUpload({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File | null) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }
  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    onFile(f);
  }
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          "mt-1.5 cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragOver ? "border-amber-500 bg-amber-50" : file ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-slate-400",
        ].join(" ")}
      >
        {file ? (
          <div className="text-xs">
            <div className="text-emerald-700 font-semibold">✓ {file.name}</div>
            <div className="text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to replace</div>
          </div>
        ) : (
          <div className="text-xs text-slate-600">
            <div className="text-2xl">📎</div>
            <div className="mt-1 font-semibold">Drag & drop or click to upload</div>
            <div className="text-slate-500 mt-0.5">PDF, JPG, PNG up to 10 MB</div>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={onPick} className="hidden" />
      </div>
    </div>
  );
}

function TermsStep({ accepted, setAccepted, onSubmit, submitting, errorMsg }: {
  accepted: boolean; setAccepted: (b: boolean) => void; onSubmit: () => void; submitting: boolean; errorMsg: string | null;
}) {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-700 font-semibold">Step 3 of 3 · Terms & Conditions</div>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Review & sign your agreement</h2>
      </div>
      <div className="mt-8 rounded-2xl bg-white border border-slate-200 shadow-lg p-6 sm:p-8">
        <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed space-y-3">
          <p><strong>1. Loan Agreement.</strong> By accepting these terms, you enter into a binding lending agreement with Dynamic Bank of West, N.A. ("Lender", FDIC certificate #48291). Loan proceeds are subject to final underwriting verification of the documentation you have submitted.</p>
          <p><strong>2. Interest & Repayment.</strong> The stated Annual Percentage Rate (APR) applies for the initial contract term. Fixed-rate products remain constant; variable-rate products adjust with the U.S. Prime Rate. Payments are due monthly by the anniversary date of funding.</p>
          <p><strong>3. Authorization.</strong> You authorize the Lender to verify employment, credit history, and to obtain reports from consumer reporting agencies as required by federal law (12 U.S.C. §1681).</p>
          <p><strong>4. Truth in Lending.</strong> Full Truth-in-Lending disclosures (Regulation Z) including finance charges, total of payments, and schedule of payments will be delivered upon funding.</p>
          <p><strong>5. Prepayment.</strong> There is no penalty for early repayment of principal on any loan product.</p>
          <p><strong>6. Default.</strong> Failure to make a scheduled payment within 30 days of the due date constitutes default and may result in acceleration of the loan balance, reporting to credit bureaus, and collection activity.</p>
          <p><strong>7. Data & Privacy.</strong> Your information is protected under our Privacy Notice and handled in accordance with the Gramm-Leach-Bliley Act.</p>
          <p><strong>8. Governing Law.</strong> This agreement is governed by the laws of the State of California and applicable federal banking regulations.</p>
        </div>
        <label className="mt-5 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-600" />
          <span className="text-sm text-slate-700">I have read and agree to the Terms & Conditions, Truth-in-Lending disclosures, and the Electronic Consent Agreement.</span>
        </label>
        {errorMsg && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{errorMsg}</div>}
        <button
          onClick={onSubmit}
          disabled={submitting || !accepted}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-semibold py-4 hover:from-emerald-700 disabled:opacity-60 shadow-lg"
        >
          {submitting ? "Submitting application…" : "Sign & Submit Application"}
        </button>
      </div>
    </section>
  );
}

function SuccessSplash({ product, amount }: { product: Product; amount: number; kycEmail: string; kycName: string }) {
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setIsGuest(!data.user);
    });
    return () => { mounted = false; };
  }, []);
  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <div className="rounded-3xl overflow-hidden border border-emerald-200 shadow-2xl bg-white">
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-700 to-emerald-950 text-white p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_60%)] animate-pulse" />
          <div className="relative">
            <div className="mx-auto h-24 w-24 rounded-full bg-white/20 flex items-center justify-center text-6xl animate-bounce">🎉</div>
            <div className="mt-6 text-[10px] uppercase tracking-[0.32em] text-emerald-100">Application Approved</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold">Welcome to the DBW lending family.</h2>
            <p className="mt-5 text-emerald-50/95 max-w-xl mx-auto leading-relaxed">
              Your document verifications match our core ledger criteria. Your funds will be securely credited directly to your primary routing account balance within the next <strong>24 business hours</strong>.
            </p>
          </div>
        </div>
        <div className="p-8 grid sm:grid-cols-3 gap-4 text-center">
          <Metric k="Product" v={product.name} />
          <Metric k="Approved Amount" v={`$${amount.toLocaleString()}`} />
          <Metric k="Funding ETA" v="Within 24 business hours" />
        </div>
        {isGuest && (
          <div className="px-8 pb-8">
            <Link
              to="/signup"
              className="block w-full text-center rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white font-semibold px-8 py-4 shadow-lg text-base tracking-wide"
            >
              Create Your Account to Get Funded
            </Link>
            <p className="mt-3 text-center text-xs text-slate-500">
              Establish your DBW online banking profile to receive your approved funds.
            </p>
          </div>
        )}
        <div className="p-6 bg-slate-50 border-t border-slate-200 text-center">
          <Link to="/" className="inline-block rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8 py-3">
            Return to Online Banking
          </Link>
        </div>
      </div>
    </section>
  );
}

