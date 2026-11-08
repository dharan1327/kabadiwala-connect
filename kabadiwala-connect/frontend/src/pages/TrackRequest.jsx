import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { STATUS_TONE } from '../lib/constants.js';
import { Notice, Spinner, errorText } from '../components/ui.jsx';
import Timeline from '../components/Timeline.jsx';

// Live tracking for a single pickup request (household, assigned collector, or admin).
export default function TrackRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    Promise.all([api(`/requests/${id}`), api(`/requests/${id}/timeline`)])
      .then(([r, t]) => { setData(r); setTimeline(t); })
      .catch((e) => setNotice({ type: 'error', text: errorText(e) }));
  }, [id]);

  if (notice?.type === 'error' && !data) return <Notice notice={notice} />;
  if (!data) return <Spinner />;
  return (
    <div className="space-y-6">
      <button className="text-sm text-forest underline" onClick={() => navigate(-1)}>← Back</button>
      <section className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-forest">{data.category_label} · {data.est_quantity_kg} kg</h1>
          <span className={`badge ${STATUS_TONE[data.status] || ''}`}>{data.status_label}</span>
        </div>
        <p className="text-sm text-ink/60">{data.public_ref} · {data.pickup_area}</p>
        {data.scheduled_date && <p className="text-sm">Scheduled: {data.scheduled_date} at {data.scheduled_time}</p>}
        {data.pickup_address && <p className="text-sm">Address: {data.pickup_address}</p>}
      </section>
      <section className="card">
        <h2 className="mb-3 font-bold text-forest">Tracking timeline</h2>
        <Timeline events={timeline || []} />
      </section>
      {data.status === 'completed' && <p className="text-sm">Transaction details are available in your transaction history.</p>}
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <p className="text-xs text-ink/50">Tracking shows events as they are recorded.</p>
    </div>
  );
}
