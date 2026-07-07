import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  SECURITY_QUESTIONS,
  genAccountNumber,
  maskAccount,
  genOTP,
  loadUsers,
  saveUsers,
  setCurrentUserId,
  type MtUser,
} from "@/lib/mt-store";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Open an Account — Dynamic Bank of West" },
      { name: "description", content: "Open a secure Dynamic Bank of West account in minutes." },
    ],
  }),
  component: SignupPage,
});

type Form = {
  name: string; email: string; phone: string; ssn: string;
  password: string; confirm: string;
  securityQ: string; securityA: string;
};

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({
    name: "", email: "", phone: "", ssn: "",
    password: "", confirm: "",
    securityQ: SECURITY_QUESTIONS[0], securityA: "",
  });
  const [err, setErr] = useState("");
  const [agree, setAgree] = useState(false);

  // OTP gate state
  const [gate, setGate] = useState<null | {
    phoneOtp: string; emailOtp: string; user: MtUser;
    inputPhone: string; inputEmail: string; gateErr: string;
  }>(null);

  function update<K extends keyof Form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErr("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setErr("Please enter your full legal name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setErr("Enter a valid email address.");
    if (form.phone.replace(/\D/g, "").length < 10) return setErr("Enter a valid 10-digit phone number.");
    if (form.ssn.replace(/\D/g, "").length !== 9) return setErr("Enter a valid 9-digit Social Security Number.");
    if (form.securityA.trim().length < 2) return setErr("Answer your security question to continue.");
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    if (!agree) return setErr("You must agree to the disclosures to open an account.");
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      return setErr("An account with this email already exists.");
    }
    const acctFull = genAccountNumber();
    const ssnDigits = form.ssn.replace(/\D/g, "");
    const newUser: MtUser = {
      id: "u_" + Math.floor(1000 + Math.random() * 9000),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      phone: form.phone.replace(/\D/g, ""),
      ssn: `•••-••-${ssnDigits.slice(-4)}`,
      securityQ: form.securityQ,
      securityA: form.securityA.trim().toLowerCase(),
      accountNumber: acctFull,
      account: maskAccount(acctFull),
      tier: "Standard",
      status: "Active",
      balance: 0,
      savingsBalance: 0,
      savingsAccountNumber: genAccountNumber(),
      verified: false,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const phoneOtp = genOTP();
    const emailOtp = genOTP();
    // Debug surface for sandbox testing
    // eslint-disable-next-line no-console
    console.log(`%c[DBW SANDBOX] Phone OTP → ${phoneOtp}  ·  Email OTP → ${emailOtp}`,
      "background:#0f172a;color:#fbbf24;padding:4px 8px;border-radius:4px;font-weight:bold;");
    setTimeout(() => {
      alert(`[DEBUG MODE — SANDBOX VERIFICATION]\n\nPhone code sent to (${form.phone}):  ${phoneOtp}\nEmail code sent to (${form.email}): ${emailOtp}\n\nEnter both codes in the verification window to activate your account.`);
    }, 100);
    setGate({ phoneOtp, emailOtp, user: newUser, inputPhone: "", inputEmail: "", gateErr: "" });
  }

  function verifyOtp() {
    if (!gate) return;
    if (gate.inputPhone.trim() !== gate.phoneOtp || gate.inputEmail.trim() !== gate.emailOtp) {
      setGate({ ...gate, gateErr: "Invalid Verification Token. Re-check the codes and try again." });
      return;
    }
    const verifiedUser: MtUser = { ...gate.user, verified: true, balance: 0 };
    const users = loadUsers();
    saveUsers([verifiedUser, ...users]);
    setCurrentUserId(verifiedUser.id);
    window.dispatchEvent(new Event("ptl:show"));
    setTimeout(() => navigate({ to: "/" }), 900);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 py-3">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 text-white">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-b from-amber-300 to-amber-600 text-slate-900 font-bold text-[10px] flex items-center justify-center tracking-wide">DBW</div>
            <div>
              <div className="text-sm font-semibold tracking-wide">DYNAMIC BANK OF WEST</div>
              <div className="text-[11px] text-white/60">Member FDIC · Est. 1998</div>
            </div>
          </Link>
          <Link to="/" className="text-xs text-white/70 hover:text-amber-300">← Back to Sign in</Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_320px] gap-8">
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Open your account</h1>
            <p className="text-sm text-slate-500 mt-1">All new accounts open with a $0.00 balance and require phone + email verification before activation.</p>
          </div>

          <SectionHeading>1 · Personal information</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full legal name" value={form.name} onChange={(v) => update("name", v)} placeholder="Jordan A. Davis" />
            <Field label="Email address" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="you@email.com" />
            <Field label="Mobile phone" type="tel" value={form.phone} onChange={(v) => update("phone", v)} placeholder="(555) 123-4567" />
            <Field label="Social Security Number" value={form.ssn} onChange={(v) => update("ssn", v.replace(/[^\d-]/g, "").slice(0, 11))} placeholder="•••-••-••••" />
          </div>

          <SectionHeading>2 · Security question</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Choose a question</label>
              <select
                value={form.securityQ}
                onChange={(e) => update("securityQ", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <Field label="Your answer" value={form.securityA} onChange={(v) => update("securityA", v)} placeholder="Case-insensitive" />
          </div>

          <SectionHeading>3 · Password</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} placeholder="At least 8 characters" />
            <Field label="Confirm password" type="password" value={form.confirm} onChange={(v) => update("confirm", v)} placeholder="Repeat password" />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            I agree to the Dynamic Bank of West Deposit Agreement, Privacy Notice, and E-Sign consent, and confirm my SSN under penalty of perjury.
          </label>

          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 text-slate-900 text-sm font-bold py-3 rounded-md shadow-md border border-amber-700/40"
          >
            Continue to phone & email verification
          </button>
        </form>

        <aside className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-6">
            <div className="text-xs uppercase tracking-widest text-amber-300 mb-2">Bank-grade security</div>
            <ul className="space-y-2.5 text-sm">
              <Check>256-bit TLS encryption</Check>
              <Check>Two-factor identity verification (SMS + email)</Check>
              <Check>SSN & security question on file</Check>
              <Check>FDIC insured up to $250,000</Check>
              <Check>All accounts open at $0.00</Check>
            </ul>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
            <div className="font-semibold text-slate-900 mb-1">Need help?</div>
            Call our 24/7 concierge at <span className="text-slate-900 font-medium">1-800-DBW-BANK</span>.
          </div>
        </aside>
      </div>

      {gate && <OtpGate gate={gate} setGate={setGate} verify={verifyOtp} />}
    </div>
  );
}

function OtpGate({
  gate, setGate, verify,
}: {
  gate: { phoneOtp: string; emailOtp: string; user: MtUser; inputPhone: string; inputEmail: string; gateErr: string };
  setGate: (g: typeof gate) => void;
  verify: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
          <div className="text-[10px] uppercase tracking-[0.25em] text-amber-300 font-semibold">Step 2 of 2 · Identity Gate</div>
          <h2 className="mt-1 text-lg font-semibold">Verify your phone & email</h2>
          <p className="text-xs text-slate-300 mt-1">We sent a 6-digit code to each channel. Enter both to activate your DBW account.</p>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
            <span className="font-semibold">Sandbox mode:</span> the browser alert showed both codes. Copy them here to continue.
          </div>

          <OtpField
            label={`SMS code sent to ${gate.user.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}`}
            value={gate.inputPhone}
            onChange={(v) => setGate({ ...gate, inputPhone: v, gateErr: "" })}
          />
          <OtpField
            label={`Email code sent to ${gate.user.email}`}
            value={gate.inputEmail}
            onChange={(v) => setGate({ ...gate, inputEmail: v, gateErr: "" })}
          />

          {gate.gateErr && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
              ⚠ {gate.gateErr}
            </div>
          )}

          <button
            onClick={verify}
            className="w-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 text-slate-900 text-sm font-bold py-3 rounded-md shadow-md border border-amber-700/40"
          >
            Confirm & activate account
          </button>

          <div className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-100">
            🔒 FFIEC dual-channel verification protocol · Locked until validated
          </div>
        </div>
      </div>
    </div>
  );
}

function OtpField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full text-center text-2xl tracking-[0.6em] font-mono rounded-md border-2 border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40 outline-none py-3 bg-slate-50"
        placeholder="••••••"
      />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-widest text-amber-700 font-bold pt-2 border-t border-slate-100 -mb-2">
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        placeholder={placeholder}
      />
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-amber-300 mt-0.5">✓</span>
      <span className="text-white/90">{children}</span>
    </li>
  );
}
