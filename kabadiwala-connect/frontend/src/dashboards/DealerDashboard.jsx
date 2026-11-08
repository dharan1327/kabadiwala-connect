import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CATEGORIES, LOT_LABELS, inr } from '../lib/constants.js';
import { ConfirmDialog, Empty, Notice, Spinner, Stat, errorText } from '../components/ui.jsx';

export default function DealerDashboard() {
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [lots, setLots] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [recyclers, setRecyclers] = useState([]);
  const [notice, setNotice] = useState(null);
  const [buying, setBuying] = useState(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (city.trim()) qs.set('city', city.trim());
    const [l, inv, rec] = await Promise.all([
      api(`/market/lots?${qs.toString()}`), api('/market/dealer/inventory'), api('/market/recyclers'),
    ]);
    setLots(l); setInventory(inv); setRecyclers(rec);
  }, [category, city]);
  useEffect(() => { load().catch((e) => setNotice({ type: 'error', text: errorText(e) })); }, [load]);

  const purchase = async () => {
    const p = Number(price);
    if (!(p > 0)) return setNotice({ type: 'error', text: 'Enter a purchase price per kg.' });
    setBusy(true);
    try {
      await api(`/market/lots/${buying.id}/purchase`, { method: 'POST', body: { price_per_kg: p } });
      setNotice({ type: 'success', text: 'Purchase recorded. The collector has been notified.' });
      setBuying(null); setPrice(''); await load();
    } catch (e) { setNotice({ type: 'error', text: errorText(e) }); }
    finally { setBusy(false); }
  };

  const dispatch = async (lotId, recyclerId) => {
    if (!recyclerId) return setNotice({ type: 'error', text: 'Choose an authorised recycling unit first.' });
    try {
      await api(`/market/lots/${lotId}/dispatch`, { method: 'POST', body: { recycler_id: Number(recyclerId) } });
      setNotice({ type: 'success', text: 'Dispatched to the recycling unit.' }); await load();
    } catch (e) { setNotice({ type: 'error', text: errorText(e) }); }
  };

  const spend = inventory.reduce((s, l) => s + (l.quantity_kg * (l.purchase_price_per_kg || 0)), 0);

  return (
    <>
      <h1 className="text-2xl font-bold text-forest">Scrap dealer dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Available lots" value={lots?.length ?? '—'} />
        <Stat label="Lots in my inventory" value={inventory.length} />
        <Stat label="Inventory value" value={inr(spend)} hint="Quantity × your purchase price" />
        <Stat label="Recycling units (authorised)" value={recyclers.length} />
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <section className="card space-y-4" aria-labelledby="avail">
        <div className="flex flex-wrap items-end gap-3">
          <h2 id="avail" className="mr-auto text-lg font-bold text-forest">Available material</h2>
          <div>
            <label className="label" htmlFor="cat">Category</label>
            <select id="cat" className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">Collector city</label>
            <input id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Chennai" />
          </div>
        </div>
        {lots === null && <Spinner />}
        {lots?.length === 0 && <Empty title="No lots match these filters" />}
        {lots?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Available material lots</caption>
              <thead className="text-forest"><tr><th className="p-2">Material</th><th className="p-2">Quantity</th>
                <th className="p-2">Collector</th><th className="p-2">Reference / kg</th><th className="p-2"></th></tr></thead>
              <tbody>
                {lots.map((l) => (
                  <tr key={l.id} className="border-t border-emerald-50">
                    <td className="p-2 font-medium">{l.category_label}</td>
                    <td className="p-2">{l.quantity_kg} kg</td>
                    <td className="p-2">{l.collector_code} · {l.collector_city}</td>
                    <td className="p-2">{inr(l.reference_price_per_kg)}</td>
                    <td className="p-2 text-right"><button className="btn-accent" onClick={() => setBuying(l)}>Purchase</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-3" aria-labelledby="inv">
        <h2 id="inv" className="text-lg font-bold text-forest">My inventory and dispatch</h2>
        {inventory.length === 0 && <Empty title="No purchased lots yet" />}
        {inventory.map((l) => (
          <div key={l.id} className="flex flex-col gap-2 rounded-xl bg-surface p-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-forest">{l.category_label} · {l.quantity_kg} kg · bought at {inr(l.purchase_price_per_kg)}/kg</p>
              <p className="text-xs text-ink/60">{LOT_LABELS[l.status]} {l.transaction_ref && <> · <Link className="underline" to={`/app/transactions/${l.transaction_id}`}>{l.transaction_ref}</Link></>}</p>
            </div>
            {l.status === 'purchased' && <DispatchControl recyclers={recyclers} onDispatch={(rid) => dispatch(l.id, rid)} />}
            {l.status === 'rejected' && <p className="text-sm text-red-700">Rejected at recycler inspection.</p>}
          </div>
        ))}
      </section>

      <ConfirmDialog open={!!buying} title="Record this purchase?"
        message={buying ? `You are buying ${buying.quantity_kg} kg of ${buying.category_label} from ${buying.collector_code}. Enter the price you are paying per kg.` : ''}
        confirmLabel="Record purchase" busy={busy} onConfirm={purchase} onCancel={() => { setBuying(null); setPrice(''); }}>
        <label className="label" htmlFor="pp">Price per kg (₹)</label>
        <input id="pp" type="number" min="0" step="0.5" className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
      </ConfirmDialog>
    </>
  );
}

function DispatchControl({ recyclers, onDispatch }) {
  const [rid, setRid] = useState('');
  return (
    <div className="flex gap-2">
      <select aria-label="Recycling unit" className="input !w-auto" value={rid} onChange={(e) => setRid(e.target.value)}>
        <option value="">Choose recycling unit…</option>
        {recyclers.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.city}</option>)}
      </select>
      <button className="btn-primary" onClick={() => onDispatch(rid)}>Dispatch</button>
    </div>
  );
}
