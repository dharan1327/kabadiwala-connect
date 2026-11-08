import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, download } from '../lib/api.js';
import { inr } from '../lib/constants.js';
import { Notice, Spinner, Stat, errorText } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Role-aware analytics. Every figure comes from database records; empty charts mean no records yet.
export default function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  useEffect(() => { api('/analytics/me').then(setData).catch((e) => setNotice({ type: 'error', text: errorText(e) })); }, []);
  if (!data) return notice ? <Notice notice={notice} /> : <Spinner />;

  const exportCsv = () => download('/analytics/export.csv', `kabadiwala-${user.role}-report.csv`)
    .catch((e) => setNotice({ type: 'error', text: errorText(e) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-forest">Analytics and reports</h1>
        <button className="btn-ghost" onClick={exportCsv}>Download CSV report</button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Quantity (kg)" value={data.totals.kg} />
        <Stat label="Amount" value={inr(data.totals.amount)} />
        <Stat label="Records" value={data.totals.records} />
        <Stat label="Completion rate" value={data.completion_rate_pct === null ? '—' : `${data.completion_rate_pct}%`} />
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-bold text-forest">Monthly quantity (kg)</h2>
          {data.monthly.length === 0 ? <p className="text-sm text-ink/60">No records yet.</p> : (
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" stroke="#e6f2ea" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                <Bar dataKey="kg" fill="#0F3D2E" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer></div>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-bold text-forest">Quantity by category (kg)</h2>
          {data.categories.length === 0 ? <p className="text-sm text-ink/60">No records yet.</p> : (
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categories} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6f2ea" />
                <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={110} /><Tooltip />
                <Bar dataKey="kg" fill="#10B981" radius={[0, 6, 6, 0]} /></BarChart>
            </ResponsiveContainer></div>
          )}
        </section>
      </div>
    </div>
  );
}
