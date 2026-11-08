import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { LOT_LABELS, fmtDate, inr } from '../lib/constants.js';
import { Notice, Spinner, errorText } from '../components/ui.jsx';
import Timeline from '../components/Timeline.jsx';

// One transaction with its full material trail: collector -> dealer -> recycling unit.
export default function TransactionDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    api(`/transactions/${id}`).then(setData).catch((e) => setNotice({ type: 'error', text: errorText(e) }));
  }, [id]);

  if (!data) return notice ? <Notice notice={notice} /> : <Spinner />;
  const t = data.transaction;
  const lot = data.lot;
  return (
    <div className="space-y-6">
      <Link to="/app" className="text-sm text-forest underline">← Back to dashboard</Link>
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-mono text-xl font-bold text-forest">{t.public_ref}</h1>
          {t.flagged && <span className="badge bg-amber-100 text-amber-900">Flagged for review</span>}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-ink/50">Material</dt><dd className="font-semibold">{t.category_label}</dd></div>
          <div><dt className="text-ink/50">Confirmed quantity</dt><dd className="font-semibold">{t.confirmed_quantity_kg} kg</dd></div>
          <div><dt className="text-ink/50">Price per kg</dt><dd className="font-semibold">{inr(t.price_per_kg)}</dd></div>
          <div><dt className="text-ink/50">Total amount</dt><dd className="font-semibold">{inr(t.total_amount)}</dd></div>
          <div><dt className="text-ink/50">Handover reference</dt><dd className="font-mono">{t.handover_ref}</dd></div>
          <div><dt className="text-ink/50">Recorded</dt><dd>{fmtDate(t.created_at)}</dd></div>
        </dl>
        {t.flag_reason && <p className="text-sm text-amber-800">Review note: {t.flag_reason}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold text-forest">Material status</h2>
        {lot ? (
          <div className="text-sm">
            <p><strong>{LOT_LABELS[lot.status] || lot.status}</strong></p>
            <p className="text-ink/60">
              {lot.dealer_id && <>Dealer purchase at {inr(lot.purchase_price_per_kg)}/kg · </>}
              {lot.received_quantity_kg && <>Received {lot.received_quantity_kg} kg · </>}
              {lot.recycled_quantity_kg !== null && lot.status === 'recycled' && <>Recycled {lot.recycled_quantity_kg} kg (confirmed by recycler)</>}
            </p>
          </div>
        ) : <p className="text-sm text-ink/60">Material has not reached a dealer yet.</p>}
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold text-forest">Tracking timeline</h2>
        <Timeline events={data.timeline} />
      </section>
      <Notice notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
