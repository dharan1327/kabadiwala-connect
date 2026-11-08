import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeCheck, MapPin } from 'lucide-react';
import { api } from '../lib/api.js';
import { inr, STATUS_TONE } from '../lib/constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ConfirmDialog, Empty, Notice, Spinner, Stat, errorText } from '../components/ui.jsx';
import VoiceAssistant from '../components/VoiceAssistant.jsx';
import MapView from '../components/MapView.jsx';

const READOUT = {
  'en-IN': (n, a) => `You have ${n} nearby requests and ${a} assigned pickups.`,
  'ta-IN': (n, a) => `உங்களுக்கு அருகில் ${n} கோரிக்கைகளும், ${a} ஒதுக்கப்பட்ட சேகரிப்புகளும் உள்ளன.`,
  'hi-IN': (n, a) => `आपके पास ${n} नज़दीकी अनुरोध और ${a} निर्धारित पिकअप हैं।`,
};

export default function CollectorDashboard() {
  const { user, refreshUser } = useAuth();
  const [nearby, setNearby] = useState(null);
  const [assigned, setAssigned] = useState(null);
  const [txns, setTxns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [route, setRoute] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const [n, a, t, an, r] = await Promise.all([
      api('/requests/nearby'), api('/pickups/assigned'), api('/transactions/mine'),
      api('/analytics/me'), api('/pickups/route'),
    ]);
    setNearby(n); setAssigned(a); setTxns(t); setAnalytics(an); setRoute(r);
  }, []);
  useEffect(() => { load().catch((e) => setNotice({ type: 'error', text: errorText(e) })); }, [load]);

  const profile = user;
  const earnings = txns.reduce((s, t) => s + t.total_amount, 0);
  const kg = txns.reduce((s, t) => s + t.confirmed_quantity_kg, 0);
  const monthEarnings = (analytics?.monthly || []).slice(-1)[0]?.amount || 0;
  const verifyUrl = `${window.location.origin}/verify/collector/${profile.collector_code}`;

  const requestVerification = async () => {
    try {
      await api('/collector/verification-request', { method: 'POST' });
      setNotice({ type: 'success', text: 'Verification requested. An administrator will review your details.' });
      await refreshUser();
    } catch (e) { setNotice({ type: 'error', text: errorText(e) }); }
  };

  const readout = (lang) => READOUT[lang](nearby?.length || 0, assigned?.filter((r) => ['scheduled', 'arriving', 'collected'].includes(r.status)).length || 0);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card flex flex-col gap-4 sm:flex-row lg:col-span-2" aria-labelledby="id-card">
          <div className="flex-1 space-y-2">
            <p id="id-card" className="text-xs uppercase tracking-wide text-ink/50">Digital collector ID</p>
            <p className="text-2xl font-bold text-forest">{profile.full_name}</p>
            <p className="font-mono text-sm">{profile.collector_code}</p>
            <p className="text-sm text-ink/70"><MapPin className="mr-1 inline h-4 w-4" />Service area: {profile.city} · radius {profile.service_radius_km} km</p>
            <p className="flex items-center gap-2 text-sm">
              <BadgeCheck className="h-4 w-4 text-emerald" />
              Verification: <strong className="capitalize">{profile.verification_status}</strong>
            </p>
            {profile.verification_status === 'unverified' && (
              <button className="btn-ghost" onClick={requestVerification}>Request verification</button>
            )}
            <p className="text-xs text-ink/50">Completed pickups: {profile.completed_pickups}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <QRCodeSVG value={verifyUrl} size={132} includeMargin aria-label="QR code for public verification" />
            <p className="max-w-[160px] text-center text-xs text-ink/50">Scan to view the public verification page.</p>
          </div>
        </section>
        <VoiceAssistant mode="readout" getReadout={readout} />
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total earnings" value={inr(earnings)} />
        <Stat label="Earnings (latest month)" value={inr(monthEarnings)} />
        <Stat label="Pending pickups" value={(assigned || []).filter((r) => ['scheduled', 'arriving', 'collected'].includes(r.status)).length} />
        <Stat label="Material handled" value={`${kg.toFixed(1)} kg`} hint={`${txns.length} completed transactions`} />
      </div>

      <section className="card" aria-labelledby="earn-chart">
        <h2 id="earn-chart" className="mb-3 text-lg font-bold text-forest">Earnings, last 7 days</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics?.daily_amount || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6f2ea" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => inr(v)} />
              <Bar dataKey="amount" fill="#0F3D2E" radius={[6, 6, 0, 0]} name="Earnings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="assigned">
        <h2 id="assigned" className="text-lg font-bold text-forest">Assigned pickups</h2>
        {assigned === null && <Spinner />}
        {assigned?.length === 0 && <Empty title="No assigned pickups">Accept a nearby request below to schedule a pickup.</Empty>}
        {assigned?.map((r) => (
          <AssignedCard key={r.id} req={r} onDone={load} onNotice={setNotice} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-forest">Route for scheduled pickups</h2>
          <p className="text-xs text-ink/60">{route?.method}</p>
          {route?.message && <p className="text-sm text-ink/60">{route.message}</p>}
          {route?.stops?.length > 0 && (
            <>
              <ol className="card list-decimal space-y-1 pl-9 text-sm">
                {route.stops.map((s) => <li key={s.request_id}>{s.public_ref} · {s.category_label} · {s.leg_km} km leg</li>)}
              </ol>
              <p className="text-sm font-semibold text-forest">Total: {route.total_km} km</p>
              <MapView height={260} center={[profile.lat || 13.08, profile.lng || 80.27]}
                       markers={route.stops.map((s) => ({ lat: s.lat, lng: s.lng, label: s.public_ref }))} />
            </>
          )}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="nearby">
        <h2 id="nearby" className="text-lg font-bold text-forest">Nearby pickup requests</h2>
        <p className="text-sm text-ink/60">Addresses are hidden until a household accepts your offer. You see the area and distance only.</p>
        {nearby === null && <Spinner />}
        {nearby?.length === 0 && <Empty title="No open requests nearby">New requests within your service radius appear here.</Empty>}
        <div className="grid gap-4 md:grid-cols-2">
          {nearby?.map((r) => <NearbyCard key={r.id} req={r} onDone={load} onNotice={setNotice} />)}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="my-txns">
        <h2 id="my-txns" className="text-lg font-bold text-forest">Transactions</h2>
        {txns.length === 0 ? <Empty title="No completed transactions yet" /> : (
          <ul className="space-y-2">
            {txns.map((t) => (
              <li key={t.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link className="font-mono text-forest underline" to={`/app/transactions/${t.id}`}>{t.public_ref}</Link>
                <span>{t.category_label} · {t.confirmed_quantity_kg} kg · {inr(t.total_amount)}</span>
                <span className="font-mono text-xs text-ink/50">{t.handover_ref}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function NearbyCard({ req, onDone, onNotice }) {
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = req.my_offer;
  const [editing, setEditing] = useState(false);
  const [withdraw, setWithdraw] = useState(false);

  const send = async () => {
    const p = Number(price);
    if (!(p > 0)) return onNotice({ type: 'error', text: 'Enter a price per kg greater than zero.' });
    setBusy(true);
    try {
      if (mine && editing) await api(`/offers/${mine.id}`, { method: 'PATCH', body: { price_per_kg: p, message: message || null } });
      else await api(`/requests/${req.id}/offers`, { method: 'POST', body: { price_per_kg: p, message: message || null } });
      onNotice({ type: 'success', text: 'Your offer was sent to the household.' });
      setEditing(false); setPrice(''); setMessage('');
      await onDone();
    } catch (e) { onNotice({ type: 'error', text: errorText(e) }); }
    finally { setBusy(false); }
  };

  const doWithdraw = async () => {
    setBusy(true);
    try { await api(`/offers/${mine.id}/withdraw`, { method: 'POST' }); onNotice({ type: 'info', text: 'Offer withdrawn.' }); await onDone(); }
    catch (e) { onNotice({ type: 'error', text: errorText(e) }); }
    finally { setBusy(false); setWithdraw(false); }
  };

  return (
    <article className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-forest">{req.category_label} · ~{req.est_quantity_kg} kg</p>
          <p className="text-xs text-ink/60">{req.pickup_area} · {req.distance_km ?? '?'} km away · {req.preferred_date} {req.preferred_time}</p>
        </div>
        <span className={`badge ${STATUS_TONE[req.status] || ''}`}>{req.status_label}</span>
      </div>
      {req.instructions && <p className="text-sm text-ink/70">Note: {req.instructions}</p>}
      {mine && !editing ? (
        <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm">
          <p>Your offer: <strong>{inr(mine.price_per_kg)}/kg</strong> {mine.flagged && <span className="text-amber-700">(flagged: {mine.flag_reason})</span>}</p>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => { setEditing(true); setPrice(String(mine.price_per_kg)); setMessage(mine.message || ''); }}>Modify</button>
            <button className="btn-ghost" onClick={() => setWithdraw(true)}>Withdraw</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <input aria-label="Price per kg in rupees" type="number" min="0" step="0.5" placeholder="₹ per kg" className="input"
                 value={price} onChange={(e) => setPrice(e.target.value)} />
          <input aria-label="Message to household" placeholder="Message (optional)" className="input sm:col-span-2"
                 value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} />
          <div className="sm:col-span-3 flex gap-2">
            <button className="btn-accent" disabled={busy} onClick={send}>{editing ? 'Save changes' : 'Submit offer'}</button>
            {editing && <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </div>
      )}
      <ConfirmDialog open={withdraw} title="Withdraw your offer?" message="The household will see that you withdrew it."
                     confirmLabel="Withdraw" tone="danger" busy={busy} onConfirm={doWithdraw} onCancel={() => setWithdraw(false)} />
    </article>
  );
}

function AssignedCard({ req, onDone, onNotice }) {
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const next = { scheduled: 'arriving', arriving: 'collected' }[req.status];
  const nextLabel = { arriving: 'Mark as arriving', collected: 'Mark material collected' }[next];

  const advance = async () => {
    setBusy(true);
    try { await api(`/requests/${req.id}/status`, { method: 'POST', body: { status: next } }); onNotice({ type: 'success', text: 'Status updated. The household has been notified.' }); await onDone(); }
    catch (e) { onNotice({ type: 'error', text: errorText(e) }); }
    finally { setBusy(false); }
  };

  const complete = async (e) => {
    e.preventDefault();
    const q = Number(qty); const p = Number(price);
    if (!(q > 0) || !(p > 0)) return onNotice({ type: 'error', text: 'Enter the confirmed quantity and the final price per kg.' });
    setBusy(true);
    try {
      const t = await api(`/requests/${req.id}/complete`, { method: 'POST', body: { confirmed_quantity_kg: q, price_per_kg: p } });
      onNotice({ type: 'success', text: `Transaction ${t.public_ref} recorded. Handover reference ${t.handover_ref}.` });
      await onDone();
    } catch (err) { onNotice({ type: 'error', text: errorText(err) }); }
    finally { setBusy(false); }
  };

  return (
    <article className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-forest">{req.category_label} · {req.est_quantity_kg} kg (estimated)</p>
          <p className="text-sm text-ink/70">{req.pickup_address}</p>
          <p className="text-xs text-ink/60">Pickup {req.scheduled_date} at {req.scheduled_time} · {req.public_ref}</p>
          {req.instructions && <p className="text-sm text-ink/70">Note: {req.instructions}</p>}
        </div>
        <span className={`badge ${STATUS_TONE[req.status] || ''}`}>{req.status_label}</span>
      </div>
      {next && <button className="btn-primary" disabled={busy} onClick={advance}>{nextLabel}</button>}
      {req.status === 'collected' && (
        <form className="grid gap-3 rounded-xl bg-surface p-4 sm:grid-cols-3" onSubmit={complete} noValidate>
          <input aria-label="Confirmed quantity in kg" type="number" min="0" step="0.1" placeholder="Confirmed kg" className="input"
                 value={qty} onChange={(e) => setQty(e.target.value)} />
          <input aria-label="Final price per kg" type="number" min="0" step="0.5" placeholder="Final ₹ per kg" className="input"
                 value={price} onChange={(e) => setPrice(e.target.value)} />
          <button className="btn-primary" disabled={busy}>Complete transaction</button>
        </form>
      )}
    </article>
  );
}
