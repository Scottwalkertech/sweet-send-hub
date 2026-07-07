import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Dynamic Bank of West" },
      { name: "description", content: "DYNAMIC BANK OF WEST — established 1998, FDIC certificate #48291. Serving western communities with secure, community-focused banking." },
      { property: "og:title", content: "About Dynamic Bank of West" },
      { property: "og:description", content: "Established 1998 · FDIC #48291 · Community-focused retail and institutional banking across the Western United States." },
    ],
  }),
  component: AboutPage,
});

const IMG_FAMILY = "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=70";
const IMG_SENIORS = "https://images.unsplash.com/photo-1447452001602-7090c7ab2db3?auto=format&fit=crop&w=1200&q=70";
const IMG_WEST = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=70";

function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header strip */}
      <header className="bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center text-black font-black text-[10px]">DBW</div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-amber-300/90">Member FDIC</div>
              <div className="text-sm font-semibold">Dynamic Bank of West</div>
            </div>
          </Link>
          <Link to="/" className="text-xs text-amber-300 hover:text-amber-200 border border-amber-400/30 rounded-md px-3 py-1.5">
            ← Back to Banking
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="text-[10px] uppercase tracking-[0.32em] text-amber-300 font-semibold">Established 1998 · FDIC #48291</div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight">About Dynamic Bank of West</h1>
          <p className="mt-6 text-lg text-slate-200/85 leading-relaxed max-w-3xl mx-auto">
            DYNAMIC BANK OF WEST, N.A. operates under FDIC certificate #48291, managing global digital retail and secure
            institutional capital reserves across the Western United States. For over a quarter century we have paired
            community-first values with enterprise-grade security.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-700 font-semibold">Our Mission</div>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Banking that grows where you live.</h2>
        <p className="mt-5 text-slate-700 leading-relaxed text-lg">
          Our mission is simple: strengthen the households, small businesses, and civic institutions of the West by
          providing dependable, transparent banking. From Way2Save Savings for growing families to commercial capital
          solutions for regional employers, every product is built to keep more of what our neighbors earn working right
          here in the community.
        </p>
      </section>

      {/* Community focus */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.28em] text-amber-700 font-semibold">Community Focus</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Rooted in the people we serve.</h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              We invest in the households, retirees, and landscapes that make the West what it is.
            </p>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            <FocusCard img={IMG_FAMILY} title="Family Banking"
              body="Trusted household financial planning across generations — from first savings accounts to family-owned businesses." />
            <FocusCard img={IMG_SENIORS} title="Retirement & Legacy"
              body="Steady, personal support for retirees and pre-retirees who value clear guidance, security, and dignity." />
            <FocusCard img={IMG_WEST} title="Our Western Roots"
              body="From coastal cities to mountain communities, our branches are proud to be part of the western landscape." />
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-700 font-semibold">Our Story</div>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">A quarter century of trusted service.</h2>
        <div className="mt-6 space-y-4 text-slate-700 leading-relaxed text-lg">
          <p>
            Dynamic Bank of West was founded in 1998 in Los Angeles with a single premise — that western families and
            businesses deserve a bank that understood them by name. That founding branch became the seed of a federally
            insured national institution, now serving customers across every western state.
          </p>
          <p>
            Today the bank safeguards deposits with 256-bit TLS encryption, multi-factor authentication, and 24/7
            compliance monitoring. Every account is protected up to the maximum allowed under FDIC insurance, and every
            member has direct access to secure messaging with our concierge team.
          </p>
          <p>
            Whether you are opening your first Way2Save Savings account, running payroll through our Small Business
            services, or clearing institutional wires, you are backed by the same commitment: transparent banking,
            responsibly delivered.
          </p>
        </div>
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-600 grid sm:grid-cols-3 gap-3">
          <Fact k="Founded" v="1998" />
          <Fact k="FDIC Certificate" v="#48291" />
          <Fact k="Headquarters" v="Los Angeles, CA" />
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Dynamic Bank of West, N.A. · Member FDIC</span>
          <Link to="/" className="text-amber-700 hover:text-amber-900">Return to online banking →</Link>
        </div>
      </footer>
    </div>
  );
}

function FocusCard({ img, title, body }: { img: string; title: string; body: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
        <img src={img} alt={title} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-5">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{k}</div>
      <div className="text-slate-900 font-semibold mt-0.5">{v}</div>
    </div>
  );
}
