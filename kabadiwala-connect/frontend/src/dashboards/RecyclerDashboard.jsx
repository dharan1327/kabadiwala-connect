import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api.js';
import { LOT_LABELS, fmtDate } from '../lib/constants.js';
import { Empty, Notice, Stat, errorText } from '../components/ui.jsx';

export default function RecyclerDashboard() {
  const [lots, setLots] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [notice, setNotice] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [l, a] = await Promise.all([api('/market/recycler/lots'), api('/analytics/me')]);
    setLots(l); setAnalytics(a);
  }, []);
  useEffect(() => { load().catch((e) => setNotice({ type: 'error', text: errorText(e) })); }, [load]);

  const set = (id, key, value) => setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));

  const run = async (fn, okText) => {
    setBusy(true);
    try { await fn(); setNotice({ type: 'success', text: okText }); await load(); }
    catch (e) { setNotice({ type: 'error', text: errorText(e) }); }
    finally { setBusy(false); }
  };

  const incoming = (lots || []).filter((l) => l.status === 'dispatched');
  const processing = (lots || []).filter((l) => ['received', 'processing'].includes(l.status));
  const recycled = (lots || []).filter((l) => l.status === 'recycled');
  const totalRecycled = recycled.reduce((s, l) => s + (l.recycled_quantity_kg || 0), 0);

  return (
    <>
      <h1 className="text-2xl font-bold text-forest">Recycling unit dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Incoming (awaiting receipt)" value={incoming.length} />
        <Stat label="In processing" value={processing.length} />
        <Stat label="Recycled (confirmed)" value={`${totalRecycled.toFixed(1)} kg`} hint="Counted only after you confirm processing" />
        <Stat label="Lots handled" value={(lots || []).length} />
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <section className="card space-y-4" aria-labelledby="inc">
        <h2 id="inc" className="text-lg font-bold text-forest">Incoming material</h2>
        {incoming.length === 0 && <Empty title="Nothing awaiting receipt" />}
        {incoming.map((l) => (
          <div key={l.id} className="grid gap-3 rounded-xl bg-surface p-4 md:grid-cols-4">
            <div className="md:col-span-2 text-sm">
              <p className="font-semibold text-forest">{l.category_label} · dispatched {l.quantity_kg} kg</p>
              <p className="text-xs text-ink/60">Lot {l.id} · {l.transaction_ref}</p>
            </div>
            <select aria-label="Inspection result" className="input" value={drafts[l.id]?.inspection || 'pass'}
                    onChange={(e) => set(l.id, 'inspection', e.target.value)}>
              <option value="pass">Inspection passed</option>
              <option value="fail">Inspection failed</option>
            </select>
            <input aria-label="Received quantity in kg" type="number" min="0" step="0.1" className="input"
                   placeholder={`Received kg (sent ${l.quantity_kg})`} value={drafts[l.id]?.qty || ''}
                   onChange={(e) => set(l.id, 'qty', e.target.value)} />
            <button className="btn-primary md:col-span-4" disabled={busy}
                    onClick={() => run(() => api(`/market/lots/${l.id}/receive`, { method: 'POST', body: {
                      inspection: drafts[l.id]?.inspection || 'pass', received_quantity_kg: Number(drafts[l.id]?.qty) } }),
                      'Receipt recorded. The dealer has been notified.')}>
              Confirm receipt
            </button>
          </div>
        ))}
      </section>

      <section className="card space-y-4" aria-labelledby="proc">
        <h2 id="proc" className="text-lg font-bold text-forest">Processing</h2>
        {processing.length === 0 && <Empty title="No material in processing" />}
        {processing.map((l) => (
          <div key={l.id} className="flex flex-col gap-3 rounded-xl bg-surface p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-forest">{l.category_label} · received {l.received_quantity_kg} kg</p>
              <p className="text-xs text-ink/60">{LOT_LABELS[l.status]}</p>
            </div>
            {l.status === 'received' && (
              <button className="btn-ghost" disabled={busy}
                      onClick={() => run(() => api(`/market/lots/${l.id}/process`, { method: 'POST', body: { status: 'processing' } }), 'Processing started.')}>
                Start processing
              </button>
            )}
            {l.status === 'processing' && (
              <div className="flex flex-wrap gap-2">
                <input aria-label="Recycled quantity in kg" type="number" min="0" step="0.1" className="input !w-40"
                       placeholder="Recycled kg" value={drafts[l.id]?.rec || ''} onChange={(e) => set(l.id, 'rec', e.target.value)} />
                <button className="btn-primary" disabled={busy}
                        onClick={() => run(() => api(`/market/lots/${l.id}/process`, { method: 'POST', body: {
                          status: 'recycled', recycled_quantity_kg: Number(drafts[l.id]?.rec) } }), 'Recycling confirmed and recorded.')}>
                  Confirm recycled
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="card space-y-3" aria-labelledby="rec">
        <h2 id="rec" className="text-lg font-bold text-forest">Recycling history</h2>
        {recycled.length === 0 && <Empty title="No confirmed recycling yet" />}
        <ul className="space-y-2 text-sm">
          {recycled.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white p-3 shadow-soft">
              <span>{l.category_label} · {l.recycled_quantity_kg} kg recycled (from {l.received_quantity_kg} kg received)</span>
              <span className="text-xs text-ink/60">{fmtDate(l.updated_at)} · <Link className="underline" to={`/app/transactions/${l.transaction_id}`}>{l.transaction_ref}</Link></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="monthly">
        <h2 id="monthly" className="mb-3 text-lg font-bold text-forest">Monthly recycling (kg)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics?.monthly || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6f2ea" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="kg" fill="#10B981" radius={[6, 6, 0, 0]} name="kg recycled" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
