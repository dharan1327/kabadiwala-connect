import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download } from '../lib/api.js';
import { CATEGORIES, fmtDate, inr } from '../lib/constants.js';
import { ConfirmDialog, Empty, Notice, Spinner, Stat, errorText } from '../components/ui.jsx';

const TABS = [
  ['overview', 'Overview'], ['users', 'Users'], ['prices', 'Prices'], ['transactions', 'Transactions'],
  ['complaints', 'Complaints'], ['audit', 'Audit log'],
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [notice, setNotice] = useState(null);
  const loadStats = useCallback(() => api('/admin/stats').then(setStats).catch((e) => setNotice({ type: 'error', text: errorText(e) })), []);
  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <>
      <h1 className="text-2xl font-bold text-forest">Administrator dashboard</h1>
      <nav className="flex gap-2 overflow-x-auto" aria-label="Admin sections">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
                  className={tab === key ? 'btn-primary !py-2' : 'btn-ghost !py-2'}>{label}</button>
        ))}
      </nav>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {tab === 'overview' && <Overview stats={stats} onExport={() => download('/analytics/export.csv', 'kabadiwala-platform.csv').catch((e) => setNotice({ type: 'error', text: errorText(e) }))} />}
      {tab === 'users' && <Users onNotice={setNotice} onChanged={loadStats} />}
      {tab === 'prices' && <Prices onNotice={setNotice} />}
      {tab === 'transactions' && <Transactions />}
      {tab === 'complaints' && <Complaints onNotice={setNotice} />}
      {tab === 'audit' && <AuditLog />}
    </>
  );
}

function Overview({ stats, onExport }) {
  if (!stats) return <Spinner />;
  const roles = stats.users_by_role;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Households" value={roles.household} />
        <Stat label="Collectors" value={roles.collector} />
        <Stat label="Dealers" value={roles.dealer} />
        <Stat label="Recycling units" value={roles.recycler} />
        <Stat label="Pickup requests" value={stats.requests_total} hint={`${stats.requests_pending} pending`} />
        <Stat label="Completion rate" value={stats.pickup_completion_rate_pct === null ? '—' : `${stats.pickup_completion_rate_pct}%`} />
        <Stat label="kg collected" value={stats.kg_collected} />
        <Stat label="Earnings recorded" value={inr(stats.earnings_recorded_inr)} />
        <Stat label="kg confirmed recycled" value={stats.kg_recycled_confirmed} />
        <Stat label="Flagged transactions" value={stats.flagged_transactions} />
        <Stat label="Open complaints" value={stats.open_complaints} />
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/70">Export all transaction records as CSV for reporting.</p>
        <button className="btn-ghost" onClick={onExport}>Download CSV</button>
      </div>
    </div>
  );
}

function Users({ onNotice, onChanged }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (role) qs.set('role', role);
    return api(`/admin/users?${qs}`).then(setRows).catch((e) => onNotice({ type: 'error', text: errorText(e) }));
  }, [q, role, onNotice]);
  useEffect(() => { load(); }, [load]);

  const act = async () => {
    setBusy(true);
    try {
      const { user, body } = confirm;
      await api(user.action, { method: 'POST', body });
      onNotice({ type: 'success', text: 'Change saved to the audit log.' });
      setConfirm(null); await load(); onChanged();
    } catch (e) { onNotice({ type: 'error', text: errorText(e) }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-3">
        <input aria-label="Search users" className="input max-w-xs" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by role" className="input !w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="household">Households</option><option value="collector">Collectors</option>
          <option value="dealer">Dealers</option><option value="recycler">Recycling units</option><option value="admin">Admins</option>
        </select>
      </div>
      {rows === null && <Spinner />}
      {rows?.length === 0 && <Empty title="No users match" />}
      <div className="space-y-2">
        {rows?.map((u) => (
          <div key={u.id} className="card flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-forest">{u.full_name} <span className="badge ml-2 capitalize">{u.role}</span>
                {u.suspended && <span className="badge ml-2 bg-red-100 text-red-800">Suspended</span>}</p>
              <p className="text-xs text-ink/60">{u.email} · {u.city} {u.pin_code}
                {u.collector_code && <> · {u.collector_code} · verification: <strong>{u.verification_status}</strong></>}
                {u.organization_name && <> · {u.organization_name} · {u.authorized ? 'authorised' : 'not authorised'}</>}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {u.role === 'collector' && u.verification_status !== 'verified' && (
                <button className="btn-ghost" onClick={() => setConfirm({ user: { action: `/admin/collectors/${u.id}/verification` }, body: { status: 'verified' }, title: 'Verify this collector?', text: 'Only verify after you have checked their identity through your review process.' })}>Mark verified</button>
              )}
              {(u.role === 'dealer' || u.role === 'recycler') && (
                <button className="btn-ghost" onClick={() => setConfirm({ user: { action: `/admin/organizations/${u.id}/authorize` }, body: { authorized: !u.authorized }, title: u.authorized ? 'Remove authorisation?' : 'Authorise this organisation?', text: 'Only authorised organisations can receive or buy material.' })}>{u.authorized ? 'Remove authorisation' : 'Authorise'}</button>
              )}
              <button className={u.suspended ? 'btn-ghost' : 'btn-danger'}
                      onClick={() => setConfirm({ user: { action: `/admin/users/${u.id}/suspend` }, body: { suspended: !u.suspended }, title: u.suspended ? 'Reinstate account?' : 'Suspend account?', text: u.suspended ? 'The user will regain access.' : 'The user will be signed out of all actions until reinstated.' })}>
                {u.suspended ? 'Reinstate' : 'Suspend'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.text} confirmLabel="Confirm"
                     tone={confirm?.body?.suspended ? 'danger' : 'primary'} busy={busy} onConfirm={act} onCancel={() => setConfirm(null)} />
    </div>
  );
}

function Prices({ onNotice }) {
  const [current, setCurrent] = useState(null);
  const [cat, setCat] = useState('circuit_boards');
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ category: 'circuit_boards', price_per_kg: '', effective_from: '', source: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api('/prices/current').then(setCurrent).catch((e) => onNotice({ type: 'error', text: errorText(e) })), [onNotice]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api(`/prices/history/${cat}`).then(setHistory).catch(() => setHistory([])); }, [cat]);

  const save = async (e) => {
    e.preventDefault();
    if (!(Number(form.price_per_kg) > 0)) return onNotice({ type: 'error', text: 'Enter a price greater than zero.' });
    if (form.source.trim().length < 3) return onNotice({ type: 'error', text: 'Record where this price came from (at least 3 characters).' });
    setBusy(true);
    try {
      await api('/admin/prices', { method: 'POST', body: { category: form.category, price_per_kg: Number(form.price_per_kg),
        effective_from: form.effective_from || null, source: form.source.trim() } });
      onNotice({ type: 'success', text: 'Reference price saved. Previous values remain in history.' });
      setForm({ ...form, price_per_kg: '', source: '' }); await load(); setCat(form.category);
    } catch (err) { onNotice({ type: 'error', text: errorText(err) }); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-4" aria-labelledby="pr-form">
        <h2 id="pr-form" className="text-lg font-bold text-forest">Add or update a reference price</h2>
        <form className="grid gap-3" onSubmit={save}>
          <select aria-label="Category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input aria-label="Price per kg" type="number" min="0" step="0.5" className="input" placeholder="₹ per kg"
                 value={form.price_per_kg} onChange={(e) => setForm({ ...form, price_per_kg: e.target.value })} />
          <input aria-label="Effective date" type="date" className="input" value={form.effective_from}
                 onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
          <input aria-label="Source of this price" className="input" placeholder="Source, e.g. 'Local dealer survey, Nov 2026'"
                 value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <button className="btn-primary" disabled={busy}>Save reference price</button>
        </form>
        <p className="text-xs text-ink/60">Never enter a price you cannot source. Sample values are labelled "SAMPLE".</p>
      </section>
      <section className="card space-y-4" aria-labelledby="pr-cur">
        <h2 id="pr-cur" className="text-lg font-bold text-forest">Current prices</h2>
        {current === null ? <Spinner /> : (
          <ul className="space-y-1 text-sm">
            {current.map((p) => (
              <li key={p.category} className="flex justify-between gap-2 border-b border-emerald-50 py-1">
                <span>{p.label}</span><span>{inr(p.price_per_kg)} {p.is_sample && <span className="badge ml-1 bg-amber-100 text-amber-900">Sample</span>}</span>
              </li>
            ))}
          </ul>
        )}
        <label className="label" htmlFor="hist">History for</label>
        <select id="hist" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <ul className="max-h-56 space-y-1 overflow-auto text-xs">
          {history.map((h, i) => <li key={i}>{fmtDate(h.effective_from)} · {inr(h.price_per_kg)} · {h.source}</li>)}
        </ul>
      </section>
    </div>
  );
}

function Transactions() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/admin/transactions').then(setRows).catch(() => setRows([])); }, []);
  if (rows === null) return <Spinner />;
  if (rows.length === 0) return <Empty title="No transactions yet" />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink/60">Flagged transactions appear first. A flag asks for review; it does not block the transaction.</p>
      {rows.map((t) => (
        <div key={t.id} className={`card flex flex-wrap justify-between gap-2 text-sm ${t.flagged ? 'border-amber-300' : ''}`}>
          <Link className="font-mono text-forest underline" to={`/app/transactions/${t.id}`}>{t.public_ref}</Link>
          <span>{t.category_label} · {t.confirmed_quantity_kg} kg · {inr(t.price_per_kg)}/kg · {inr(t.total_amount)}</span>
          {t.flagged && <span className="font-medium text-amber-800">Flagged: {t.flag_reason}</span>}
        </div>
      ))}
    </div>
  );
}

function Complaints({ onNotice }) {
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const load = useCallback(() => api('/admin/complaints').then(setRows).catch((e) => onNotice({ type: 'error', text: errorText(e) })), [onNotice]);
  useEffect(() => { load(); }, [load]);
  const resolve = async (id) => {
    if ((notes[id] || '').trim().length < 2) return onNotice({ type: 'error', text: 'Write a short note before resolving.' });
    try { await api(`/admin/complaints/${id}/resolve`, { method: 'POST', body: { admin_note: notes[id].trim() } }); onNotice({ type: 'success', text: 'Complaint resolved.' }); load(); }
    catch (e) { onNotice({ type: 'error', text: errorText(e) }); }
  };
  if (rows === null) return <Spinner />;
  if (rows.length === 0) return <Empty title="No complaints" />;
  return (
    <div className="space-y-3">
      {rows.map((c) => (
        <div key={c.id} className="card space-y-2 text-sm">
          <p className="font-semibold text-forest">{c.subject} <span className="badge ml-2 capitalize">{c.status}</span></p>
          <p className="text-ink/70">{c.body}</p>
          <p className="text-xs text-ink/50">{fmtDate(c.created_at)}</p>
          {c.status === 'open' ? (
            <div className="flex flex-wrap gap-2">
              <input aria-label="Resolution note" className="input max-w-md" placeholder="Resolution note" value={notes[c.id] || ''}
                     onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
              <button className="btn-primary" onClick={() => resolve(c.id)}>Resolve</button>
            </div>
          ) : <p className="text-xs text-ink/60">Note: {c.admin_note}</p>}
        </div>
      ))}
    </div>
  );
}

function AuditLog() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/admin/audit').then(setRows).catch(() => setRows([])); }, []);
  if (rows === null) return <Spinner />;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Audit log of administrative and transactional actions</caption>
        <thead className="bg-emerald-50 text-forest"><tr><th className="p-2">When</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Target</th><th className="p-2">Detail</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-emerald-50">
              <td className="p-2">{fmtDate(a.created_at)}</td><td className="p-2">{a.actor_id ?? 'system'}</td>
              <td className="p-2 font-mono">{a.action}</td><td className="p-2">{a.target}</td><td className="p-2">{a.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
