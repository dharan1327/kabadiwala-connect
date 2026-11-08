import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CATEGORIES, STATUS_TONE, fmtDate, inr } from '../lib/constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ConfirmDialog, Empty, Notice, Spinner, Stat, errorText } from '../components/ui.jsx';
import PhotoUpload from '../components/PhotoUpload.jsx';
import VoiceAssistant from '../components/VoiceAssistant.jsx';

const EMPTY = { category: '', quantity: '', date: '', time: '', address: '', instructions: '',
  imageId: null, aiCategory: null, aiConfidence: null, lat: null, lng: null };
const ACTIVE = ['open', 'scheduled', 'arriving', 'collected'];

export default function HouseholdDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState(null);
  const [txns, setTxns] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [openOffers, setOpenOffers] = useState(null);
  const [cancelId, setCancelId] = useState(null);

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([api('/requests/mine'), api('/transactions/mine')]);
    setRequests(r); setTxns(t);
  }, []);
  useEffect(() => { load().catch((e) => setNotice({ type: 'error', text: errorText(e) })); }, [load]);

  const kg = txns.reduce((s, t) => s + t.confirmed_quantity_kg, 0);
  const earned = txns.reduce((s, t) => s + t.total_amount, 0);
  const active = (requests || []).filter((r) => ACTIVE.includes(r.status)).length;
  const completed = (requests || []).filter((r) => r.status === 'completed').length;

  const useLocation = () => navigator.geolocation?.getCurrentPosition(
    (p) => setForm((f) => ({ ...f, lat: p.coords.latitude, lng: p.coords.longitude })),
    () => setNotice({ type: 'info', text: 'Location permission denied. Your registered address will be used.' }),
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!form.category) return setNotice({ type: 'error', text: 'Choose a material category.' });
    const qty = Number(form.quantity);
    if (!(qty > 0)) return setNotice({ type: 'error', text: 'Enter the approximate quantity in kg.' });
    if (!form.date || !form.time) return setNotice({ type: 'error', text: 'Choose a preferred date and time.' });
    if (form.address.trim().length < 5) return setNotice({ type: 'error', text: 'Enter the pickup address.' });
    setBusy(true); setNotice(null);
    try {
      await api('/requests', { method: 'POST', body: {
        category: form.category, est_quantity_kg: qty, pickup_address: form.address.trim(),
        pickup_lat: form.lat, pickup_lng: form.lng, preferred_date: form.date, preferred_time: form.time,
        instructions: form.instructions.trim() || null, image_id: form.imageId,
      } });
      setForm(EMPTY);
      setNotice({ type: 'success', text: 'Pickup request submitted. Nearby collectors have been notified.' });
      await load();
    } catch (err) { setNotice({ type: 'error', text: errorText(err) }); }
    finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true);
    try { await api(`/requests/${cancelId}/cancel`, { method: 'POST' }); setNotice({ type: 'success', text: 'Request cancelled.' }); await load(); }
    catch (err) { setNotice({ type: 'error', text: errorText(err) }); }
    finally { setBusy(false); setCancelId(null); }
  };

  const readout = (lang) => {
    const n = (requests || []).filter((r) => r.status === 'open').length;
    const phrases = {
      'en-IN': `You have ${n} open pickup requests.`,
      'ta-IN': `உங்களுக்கு ${n} திறந்த சேகரிப்புக் கோரிக்கைகள் உள்ளன.`,
      'hi-IN': `आपके ${n} खुले पिकअप अनुरोध हैं।`,
    };
    return phrases[lang];
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-forest">Welcome, {user.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-ink/60">Sell scrap at a fair price and keep a record of every handover.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total scrap sold" value={`${kg.toFixed(1)} kg`} />
        <Stat label="Total earnings" value={inr(earned)} />
        <Stat label="Active pickups" value={active} />
        <Stat label="Completed pickups" value={completed} />
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card space-y-4 xl:col-span-2" aria-labelledby="new-request">
          <h2 id="new-request" className="text-lg font-bold text-forest">New scrap pickup request</h2>
          <form className="space-y-4" onSubmit={submit} noValidate>
            <PhotoUpload value={form} onChange={setForm} onError={(t) => setNotice({ type: 'error', text: t })} />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="qty">Approximate quantity (kg)</label>
                <input id="qty" type="number" min="0.1" step="0.1" className="input" value={form.quantity}
                       onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="date">Preferred date</label>
                <input id="date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="time">Preferred time</label>
                <input id="time" type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="address">Pickup address (shared only with the collector you accept)</label>
                <input id="address" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="notes">Additional instructions</label>
                <textarea id="notes" rows={2} className="input" value={form.instructions}
                          onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit pickup request'}</button>
              <button type="button" className="btn-ghost" onClick={useLocation}>Use my current location</button>
            </div>
          </form>
        </section>
        <div className="space-y-6">
          <VoiceAssistant mode="category" onCategory={(code) => setForm((f) => ({ ...f, category: code }))} getReadout={readout} />
          <div className="card text-sm text-ink/70">
            <p className="font-semibold text-forest">Your material categories</p>
            <p className="mt-1">{CATEGORIES.map((c) => c.label).join(' · ')}</p>
          </div>
        </div>
      </div>

      <section aria-labelledby="my-requests" className="space-y-4">
        <h2 id="my-requests" className="text-lg font-bold text-forest">My requests</h2>
        {requests === null && <Spinner />}
        {requests?.length === 0 && <Empty title="No pickup requests yet">Submit your first request above.</Empty>}
        {requests?.map((r) => (
          <article key={r.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-forest">{r.category_label} · {r.est_quantity_kg} kg</p>
                <p className="text-xs text-ink/50">{r.public_ref} · {r.pickup_area} · {r.preferred_date} {r.preferred_time}</p>
              </div>
              <span className={`badge ${STATUS_TONE[r.status] || ''}`}>{r.status_label}</span>
            </div>
            {r.category_source !== 'manual' && (
              <p className="text-xs text-ink/60">
                {r.category_source === 'ai_confirmed' ? 'AI suggestion confirmed by you.' : 'You corrected the AI suggestion.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {r.status === 'open' && (
                <>
                  <button className="btn-accent" onClick={() => setOpenOffers(openOffers === r.id ? null : r.id)}>
                    {openOffers === r.id ? 'Hide offers' : `View offers (${r.active_offers})`}
                  </button>
                  <button className="btn-ghost" onClick={() => setCancelId(r.id)}>Cancel request</button>
                </>
              )}
              {r.status !== 'open' && r.status !== 'cancelled' && (
                <Link className="btn-ghost" to={`/app/requests/${r.id}`}>Track pickup</Link>
              )}
            </div>
            {openOffers === r.id && <OffersPanel requestId={r.id} onChanged={load} onNotice={setNotice} />}
          </article>
        ))}
      </section>

      <section aria-labelledby="my-txns" className="space-y-3">
        <h2 id="my-txns" className="text-lg font-bold text-forest">Transaction history</h2>
        {txns.length === 0 ? <Empty title="No transactions yet">Completed pickups appear here with a handover reference.</Empty> : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Your transactions</caption>
              <thead className="bg-emerald-50 text-forest">
                <tr><th className="p-3">Transaction</th><th className="p-3">Date</th><th className="p-3">Category</th>
                  <th className="p-3">Quantity</th><th className="p-3">Price / kg</th><th className="p-3">Total</th><th className="p-3">Handover</th></tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-t border-emerald-50">
                    <td className="p-3"><Link className="font-mono text-forest underline" to={`/app/transactions/${t.id}`}>{t.public_ref}</Link></td>
                    <td className="p-3">{fmtDate(t.created_at)}</td>
                    <td className="p-3">{t.category_label}</td>
                    <td className="p-3">{t.confirmed_quantity_kg} kg</td>
                    <td className="p-3">{inr(t.price_per_kg)}</td>
                    <td className="p-3 font-semibold">{inr(t.total_amount)}</td>
                    <td className="p-3 font-mono text-xs">{t.handover_ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog open={!!cancelId} title="Cancel this request?" message="Collectors who sent offers will be informed. This cannot be undone."
                     confirmLabel="Yes, cancel" tone="danger" busy={busy} onConfirm={cancel} onCancel={() => setCancelId(null)} />
    </>
  );
}

function OffersPanel({ requestId, onChanged, onNotice }) {
  const [data, setData] = useState(null);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/requests/${requestId}/offers`).then(setData).catch((e) => onNotice({ type: 'error', text: errorText(e) })), [requestId, onNotice]);
  useEffect(() => { load(); }, [load]);

  const decide = async (action) => {
    setBusy(true);
    try {
      await api(`/offers/${target.offer.id}/${action}`, { method: 'POST', body: action === 'accept' ? {} : undefined });
      onNotice({ type: 'success', text: action === 'accept' ? 'Offer accepted. The pickup is scheduled.' : 'Offer declined.' });
      setTarget(null);
      await onChanged();
      await load();
    } catch (e) { onNotice({ type: 'error', text: errorText(e) }); }
    finally { setBusy(false); }
  };

  if (!data) return <Spinner label="Loading offers…" />;
  return (
    <div className="space-y-3 rounded-xl bg-surface p-4">
      <p className="text-sm text-ink/70">
        {data.reference_price_per_kg
          ? <>Reference price: <strong>{inr(data.reference_price_per_kg)}/kg</strong> ({data.reference_source}). Offers are the collectors' own prices.</>
          : 'No reference price is set for this material yet.'}
      </p>
      {data.offers.length === 0 && <p className="text-sm text-ink/60">No offers yet. Nearby collectors have been notified.</p>}
      {data.offers.map((o) => (
        <div key={o.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <p className="font-semibold text-forest">{inr(o.price_per_kg)}/kg · {o.collector_name}
              <span className="ml-2 font-mono text-xs text-ink/50">{o.collector_code}</span></p>
            <p className="text-xs text-ink/60">
              {o.gap_vs_reference_pct !== null && `${o.gap_vs_reference_pct > 0 ? '+' : ''}${o.gap_vs_reference_pct}% vs reference · `}
              {o.distance_km !== null && `${o.distance_km} km · `}
              {o.completed_pickups} pickups · rating {o.collector_rating ?? 'not yet rated'}
            </p>
            {o.message && <p className="text-xs italic text-ink/60">“{o.message}”</p>}
            {o.flagged && <p className="text-xs font-medium text-amber-700">Flagged for review: {o.flag_reason}</p>}
          </div>
          <div className="flex gap-2">
            <button className="btn-accent" onClick={() => setTarget({ offer: o, action: 'accept' })}>Accept</button>
            <button className="btn-ghost" onClick={() => setTarget({ offer: o, action: 'reject' })}>Decline</button>
          </div>
        </div>
      ))}
      <ConfirmDialog open={!!target}
        title={target?.action === 'accept' ? 'Accept this offer?' : 'Decline this offer?'}
        message={target?.action === 'accept'
          ? `You will accept ${inr(target?.offer.price_per_kg)}/kg from ${target?.offer.collector_name}. Other offers will close and your address will be shared with this collector.`
          : 'The collector will be informed. You can still accept another offer.'}
        confirmLabel={target?.action === 'accept' ? 'Accept offer' : 'Decline'} tone={target?.action === 'accept' ? 'primary' : 'danger'}
        busy={busy} onConfirm={() => decide(target.action)} onCancel={() => setTarget(null)} />
    </div>
  );
}
