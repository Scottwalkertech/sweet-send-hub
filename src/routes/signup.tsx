import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/external-supabase";
import {
  genAccountNumber,
  maskAccount,
  loadUsers,
  saveUsers,
  type MtUser,
} from "@/lib/mt-store";
import { SECURITY_QUESTIONS, normalizeSecurityAnswer } from "@/lib/security-questions";

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
  name: string;
  email: string;
  password: string;
  confirm: string;
};

function SignupPage() {
  const [form, setForm] = useState<Form>({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ email: string; name: string } | null>(null);

  function update<K extends keyof Form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErr("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setErr("Please enter your full legal name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setErr("Enter a valid email address.");
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    if (!agree) return setErr("You must agree to the disclosures to open an account.");

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: form.name.trim() },
      },
    });
    setSubmitting(false);

    if (error) return setErr(error.message);

    // Pre-provision a local DBW banking profile keyed by email so the dashboard
    // is ready the moment the user confirms their email and signs in.
    const users = loadUsers();
    if (!users.some((u) => u.email.toLowerCase() === form.email.toLowerCase())) {
      const acctFull = genAccountNumber();
      const newUser: MtUser = {
        id: data.user?.id ?? "u_" + Math.floor(1000 + Math.random() * 9000),
        name: form.name.trim(),
        email: form.email,
        password: form.password, // legacy shim; real auth is via Supabase
        phone: "",
        ssn: "",
        securityQ: "",
        securityA: "",
        accountNumber: acctFull,
        account: maskAccount(acctFull),
        tier: "Standard",
        status: "Active",
        balance: 0,
        savingsBalance: 0,
        savingsAccountNumber: genAccountNumber(),
        verified: false, // flips to true after email confirmation on first sign-in
        createdAt: new Date().toISOString().slice(0, 10),
      };
      saveUsers([newUser, ...users]);
    }

    setSent({ email: form.email, name: form.name.trim() });
  }

  if (sent) return <ConfirmationCard email={sent.email} name={sent.name} />;

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
            <p className="text-sm text-slate-500 mt-1">All new accounts open with a $0.00 balance. We'll email you a secure link to verify your identity before activation.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full legal name" value={form.name} onChange={(v) => update("name", v)} placeholder="Jordan A. Davis" />
            <Field label="Email address" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="you@email.com" />
            <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} placeholder="At least 8 characters" />
            <Field label="Confirm password" type="password" value={form.confirm} onChange={(v) => update("confirm", v)} placeholder="Repeat password" />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            I agree to the Dynamic Bank of West Deposit Agreement, Privacy Notice, and E-Sign consent.
          </label>

          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-700 disabled:opacity-60 text-slate-900 text-sm font-bold py-3 rounded-md shadow-md border border-amber-700/40"
          >
            {submitting ? "Creating your account…" : "Create account & send verification email"}
          </button>
        </form>

        <aside className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-6">
            <div className="text-xs uppercase tracking-widest text-amber-300 mb-2">Bank-grade security</div>
            <ul className="space-y-2.5 text-sm">
              <Check>256-bit TLS encryption</Check>
              <Check>Email verification link before activation</Check>
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
    </div>
  );
}

function ConfirmationCard({ email, name }: { email: string; name: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-8 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-gradient-to-b from-amber-300 to-amber-600 text-slate-900 font-bold text-xs flex items-center justify-center tracking-wide">DBW</div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-amber-300 font-semibold">Application received</div>
                <div className="text-base font-semibold">Dynamic Bank of West</div>
              </div>
            </div>
          </div>
          <div className="px-8 py-8 text-center space-y-5">
            <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-3xl">
              ✉️
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Check your inbox, {name.split(" ")[0]}</h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                We just sent a secure verification link to
                <br />
                <span className="font-semibold text-slate-900">{email}</span>
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-left text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800 text-sm mb-1">Next steps</div>
              <div>1. Open the email from Dynamic Bank of West.</div>
              <div>2. Click <span className="font-medium text-slate-800">"Confirm my account"</span> to verify your identity.</div>
              <div>3. Return here to sign in and activate your $0.00 balance.</div>
            </div>
            <div className="text-[11px] text-slate-500">
              Didn't receive it? Check your spam folder or wait a minute before requesting a new one.
            </div>
            <Link
              to="/"
              className="inline-block w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-3 rounded-md"
            >
              Return to sign in
            </Link>
          </div>
          <div className="bg-slate-50 border-t border-slate-100 px-8 py-3 text-center text-[10px] text-slate-500 tracking-wider">
            🔒 FDIC INSURED · MEMBER DBW · 256-BIT TLS
          </div>
        </div>
      </div>
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
