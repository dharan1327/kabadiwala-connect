import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { PublicLayout } from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { Empty, Spinner } from '../components/ui.jsx';

// Public verification page reached from a collector's digital ID QR code. Shows no contact details.
export default function PublicCollector() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/public/collectors/${encodeURIComponent(code)}`).then(setData).catch((e) => setError(e.message));
  }, [code]);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-12">
        {!data && !error && <Spinner />}
        {error && <Empty title="Collector not found">{error}</Empty>}
        {data && (
          <div className="card space-y-4 text-center">
            {data.verification_status === 'verified'
              ? <ShieldCheck className="mx-auto h-12 w-12 text-emerald" />
              : <ShieldQuestion className="mx-auto h-12 w-12 text-amber-500" />}
            <p className="text-sm text-ink/60">Kabadiwala Connect digital ID</p>
            <p className="text-2xl font-bold text-forest">{data.display_name}</p>
            <p className="font-mono text-sm">{data.collector_code}</p>
            <p className="text-sm">Service city: {data.service_city}</p>
            <p className="text-sm">Completed pickups: {data.completed_pickups}</p>
            <p className="text-sm">Rating: {data.rating ?? 'No reviews yet'}</p>
            <p className="rounded-xl bg-surface p-3 text-sm">
              Verification status: <strong className="capitalize">{data.verification_status}</strong>.
              {data.verification_status !== 'verified' && ' This collector has not completed verification.'}
            </p>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
