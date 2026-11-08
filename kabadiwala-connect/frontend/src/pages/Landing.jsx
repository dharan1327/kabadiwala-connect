import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Handshake, Home, MapPin, Mic, Recycle, ShieldCheck, Store, Truck, Scale } from 'lucide-react';
import { PublicLayout } from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { inr } from '../lib/constants.js';
import { CONTACT_EMAIL } from '../components/Layout.jsx';

function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 360" className="w-full max-w-md" role="img" aria-label="Households, collectors and recycling units connected in one network">
      <defs>
        <linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#10B981" /><stop offset="1" stopColor="#0F3D2E" /></linearGradient>
      </defs>
      <path d="M90 90 L240 180 L390 90 M240 180 L240 300" stroke="#10B981" strokeWidth="3" strokeDasharray="6 6" fill="none" />
      <circle cx="90" cy="90" r="58" fill="url(#g)" />
      <circle cx="390" cy="90" r="58" fill="url(#g)" />
      <circle cx="240" cy="180" r="66" fill="#F5B700" />
      <circle cx="240" cy="300" r="50" fill="#0F3D2E" />
      <text x="90" y="95" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">Households</text>
      <text x="390" y="95" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">Kabadiwalas</text>
      <text x="240" y="185" textAnchor="middle" fill="#0F3D2E" fontSize="15" fontWeight="700">Platform</text>
      <text x="240" y="305" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">Recycling</text>
    </svg>
  );
}

const STEPS = [
  ['Upload your scrap photograph', 'Snap a photo of circuit boards, cables, batteries and more.', Mic],
  ['Identify the scrap', 'Get an AI suggestion, or choose the category yourself.', Brain],
  ['Receive price offers', 'Compare offers from nearby collectors against a reference price.', Handshake],
  ['Schedule and track', 'Confirm a pickup and follow every step to the recycling unit.', Truck],
];

const USERS = [
  ['Households', 'Sell scrap for a fair price and get a handover record.', Home],
  ['Kabadiwalas', 'Get a digital identity, customers and transparent earnings.', Recycle],
  ['Scrap Dealers', 'Find verified material lots and record purchases.', Store],
  ['Recycling Units', 'Confirm receipt and processing; recycling is claimed only when confirmed.', ShieldCheck],
];

const FEATURES = [
  ['AI Scrap Identification', 'Photo-based suggestion with confidence and manual fallback.', Brain],
  ['Transparent Scrap Pricing', 'Reference prices, collector offers and final prices shown side by side.', Scale],
  ['Nearby Collector Discovery', 'Find collectors within their service radius.', MapPin],
  ['Easy Pickup Scheduling', 'Choose a date and time; track each status change.', Truck],
  ['Digital Collector Identity', 'A unique collector ID with a QR verification page.', ShieldCheck],
  ['Recycling Traceability', 'Every handover has a reference from collector to recycler.', Recycle],
  ['Multilingual Voice Assistance', 'Speak a category or hear prices in Tamil, Hindi or English.', Mic],
];

const FAQS = [
  ['How do I sell my scrap?', 'Register as a household, upload a photo, confirm the category, enter the quantity and submit a pickup request. Collectors nearby send offers.'],
  ['How do I become a collector?', 'Register as a Kabadiwala and set your service area. Your digital collector ID is created immediately. Verification is a separate review by our team.'],
  ['How are prices determined?', 'We show a reference price for each material. Collectors make their own offers, and you choose. Offers far above or below the reference are flagged for review.'],
  ['How do pickups work?', 'You accept an offer, a date and time are set, and the collector updates the status as they arrive and collect the material.'],
  ['How are transactions recorded?', 'When the collector confirms the quantity and final price, a transaction record with a handover reference is created for both parties.'],
  ['How is recycling tracked?', 'Material moves from collector to dealer to recycling unit. Each step is logged. Recycling is shown as complete only after the recycling unit confirms it.'],
];

const TESTIMONIALS = [
  { quote: 'Sample testimonial: I finally know what my scrap is worth before I agree to sell it.', who: 'Illustrative household user' },
  { quote: 'Sample testimonial: My customers can now find me through the app and see my ID.', who: 'Illustrative collector' },
];

function Section({ id, title, children, subtitle }) {
  return (
    <section id={id} className="scroll-mt-24 mx-auto max-w-7xl px-4 py-16">
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-ink/70">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function Landing() {
  const [prices, setPrices] = useState([]);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api('/prices/current').then(setPrices).catch(() => {});
    api('/public/stats').then(setStats).catch(() => {});
  }, []);

  return (
    <PublicLayout>
      <section id="home" className="scroll-mt-24 bg-gradient-to-br from-surface via-white to-emerald-50">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="badge">Maatram HackForge 2026–27 · MH26-28</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-forest md:text-5xl">Turn Your Waste Into Wealth.</h1>
            <p className="mt-4 max-w-xl text-lg text-ink/70">
              Connect with trusted scrap collectors, discover transparent scrap prices and contribute to a cleaner and greener future.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn-accent" to="/register?role=household">Sell Your Scrap <ArrowRight className="h-4 w-4" /></Link>
              <Link className="btn-primary" to="/register?role=collector">Become a Collector</Link>
            </div>
          </div>
          <div className="flex justify-center"><HeroIllustration /></div>
        </div>
      </section>

      <Section id="how" title="How It Works" subtitle="Four steps from a photograph to a recorded, traceable handover.">
        <ol className="grid gap-5 md:grid-cols-4">
          {STEPS.map(([title, text, Icon], i) => (
            <li key={title} className="card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-bold text-forest">{i + 1}</span>
              <Icon className="mt-4 h-6 w-6 text-emerald" />
              <p className="mt-2 font-semibold text-forest">{title}</p>
              <p className="mt-1 text-sm text-ink/70">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="about" title="About Us" subtitle="Informal collectors already keep India's scrap moving. We give them the tools the formal system takes for granted.">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card">
            <p className="text-ink/80">
              Much of the electronic and household scrap is collected by informal collectors and dealers, who work without digital identity,
              price visibility or records. Material can end up in unsafe backyard processing. Kabadiwala Connect brings them into the formal recycling chain.
            </p>
          </div>
          <div className="card">
            <p className="font-semibold text-forest">Our commitments</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/70">
              <li>Collectors keep their identity, earnings and records.</li>
              <li>Prices are shown with their source. Sample prices are labelled.</li>
              <li>We never claim recycling is complete until the recycling unit confirms it.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section id="users" title="Who It Is For">
        <div className="grid gap-5 md:grid-cols-4">
          {USERS.map(([title, text, Icon]) => (
            <div key={title} className="card">
              <Icon className="h-7 w-7 text-emerald" />
              <p className="mt-3 font-semibold text-forest">{title}</p>
              <p className="mt-1 text-sm text-ink/70">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="services" title="Key Features">
        <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-4">
          {FEATURES.map(([title, text, Icon]) => (
            <div key={title} className="card">
              <Icon className="h-6 w-6 text-emerald" />
              <p className="mt-2 font-semibold text-forest">{title}</p>
              <p className="mt-1 text-sm text-ink/70">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="prices" title="Scrap Prices" subtitle="Reference prices set by platform administrators. Sample values are labelled and are not market data.">
        {prices.length === 0 ? (
          <p className="text-sm text-ink/60">Reference prices are not published yet.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Current reference prices</caption>
              <thead className="bg-emerald-50 text-forest">
                <tr><th className="p-3">Material</th><th className="p-3">Reference price / kg</th><th className="p-3">Source</th><th className="p-3">Updated</th></tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.category} className="border-t border-emerald-50">
                    <td className="p-3 font-medium">{p.label}</td>
                    <td className="p-3">{inr(p.price_per_kg)}</td>
                    <td className="p-3">{p.is_sample ? <span className="badge bg-amber-100 text-amber-900">Sample</span> : p.source}</td>
                    <td className="p-3 text-ink/60">{p.effective_from?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="stats" title="Platform Statistics" subtitle="Live counts from the database. Zeros mean no real records yet.">
        {stats ? (
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {[
              ['Registered collectors', stats.registered_collectors],
              ['Registered households', stats.registered_households],
              ['Completed transactions', stats.completed_transactions],
              ['kg collected', stats.kg_collected],
              ['kg confirmed recycled', stats.kg_recycled_confirmed],
              ['Open pickup requests', stats.open_requests],
            ].map(([label, value]) => (
              <div key={label} className="card">
                <dt className="text-xs uppercase tracking-wide text-ink/50">{label}</dt>
                <dd className="mt-1 text-3xl font-bold text-forest">{value}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="text-sm text-ink/60">Loading statistics…</p>}
      </Section>

      <Section id="sustainability" title="Sustainability" subtitle="Why segregation and recycling matter.">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="card"><p className="font-semibold text-forest">Segregation at source</p><p className="mt-1 text-sm text-ink/70">Households separate recyclables, so collectors get cleaner material and better prices.</p></div>
          <div className="card"><p className="font-semibold text-forest">Recovery, not dumping</p><p className="mt-1 text-sm text-ink/70">Cables, circuit boards and batteries go to authorised recyclers instead of open burning or acid stripping.</p></div>
          <div className="card"><p className="font-semibold text-forest">A circular economy</p><p className="mt-1 text-sm text-ink/70">Recovered metals and plastics return to manufacturing, reducing demand for virgin resources.</p></div>
        </div>
      </Section>

      <Section id="testimonials" title="Testimonials" subtitle="Illustrative examples for the demonstration. Replace with real testimonials with consent.">
        <div className="grid gap-5 md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure key={t.who} className="card">
              <blockquote className="text-ink/80">“{t.quote}”</blockquote>
              <figcaption className="mt-3 text-sm font-semibold text-forest">{t.who}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="faq" title="Frequently Asked Questions">
        <div className="space-y-3">
          {FAQS.map(([q, a]) => (
            <details key={q} className="card group">
              <summary className="cursor-pointer font-semibold text-forest">{q}</summary>
              <p className="mt-2 text-sm text-ink/70">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section id="contact" title="Contact">
        <div className="card">
          <p className="text-ink/80">
            {CONTACT_EMAIL
              ? <>Write to us at <a className="font-semibold text-forest underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>
              : 'Set VITE_CONTACT_EMAIL in the frontend environment file to show a contact address.'}
          </p>
        </div>
      </Section>
    </PublicLayout>
  );
}
