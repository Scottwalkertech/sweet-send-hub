import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Open an Account — Dynamic Bank of West" },
      { name: "description", content: "Open a secure Dynamic Bank of West account in minutes." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", code: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [agree, setAgree] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErr("");
  }

  function sendCode() {
    if (form.phone.replace(/\D/g, "").length < 10) {
      setErr("Enter a valid 10-digit phone number to receive your verification code.");
      return;
    }
    setCodeSent(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setErr("Please enter your full legal name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setErr("Enter a valid email address.");
    if (!codeSent || form.code.length < 4) return setErr("Verify your phone number to continue.");
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    if (!agree) return setErr("You must agree to the disclosures to open an account.");
    window.dispatchEvent(new Event("ptl:show"));
    setTimeout(() => navigate({ to: "/" }), 1800);
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
            <p className="text-sm text-slate-500 mt-1">It takes about 3 minutes. Your information is encrypted in transit and at rest.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full legal name" value={form.name} onChange={(v) => update("name", v)} placeholder="Jordan A. Davis" />
            <Field label="Email address" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="you@email.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile phone verification</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="(555) 123-4567"
              />
              <button
                type="button"
                onClick={sendCode}
                className="px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium whitespace-nowrap"
              >
                {codeSent ? "Resend code" : "Send code"}
              </button>
            </div>
            {codeSent && (
              <div className="mt-3">
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="6-DIGIT CODE"
                />
                <p className="mt-1 text-xs text-emerald-700">✓ Verification code sent to {form.phone}. (Enter any 4+ digits to continue.)</p>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} placeholder="At least 8 characters" />
            <Field label="Confirm password" type="password" value={form.confirm} onChange={(v) => update("confirm", v)} placeholder="Repeat password" />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            I agree to the Dynamic Bank of West <a className="underline">Deposit Agreement</a>, <a className="underline">Privacy Notice</a>, and E-Sign consent.
          </label>

          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 text-slate-900 text-sm font-bold py-3 rounded-md shadow-md border border-amber-700/40"
          >
            Open my account securely
          </button>
        </form>

        <aside className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-6">
            <div className="text-xs uppercase tracking-widest text-amber-300 mb-2">Bank-grade security</div>
            <ul className="space-y-2.5 text-sm">
              <Check>256-bit TLS encryption</Check>
              <Check>Multi-factor authentication</Check>
              <Check>FDIC insured up to $250,000</Check>
              <Check>Real-time fraud monitoring</Check>
              <Check>Biometric login on mobile</Check>
            </ul>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
            <div className="font-semibold text-slate-900 mb-1">Need help?</div>
            Call our 24/7 concierge at <span className="text-slate-900 font-medium">1-800-DBW-BANK</span>.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; }) {
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
