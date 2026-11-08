import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

export function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-sm text-ink/60">
      <Loader2 className="h-5 w-5 animate-spin text-emerald" /> {label}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/60 p-8 text-center">
      <p className="font-semibold text-forest">{title}</p>
      {children && <p className="mt-1 text-sm text-ink/60">{children}</p>}
    </div>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-forest">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

export function Notice({ notice, onClose }) {
  if (!notice) return null;
  const styles = {
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    info: 'bg-sky-50 text-sky-900 border-sky-200',
  };
  const Icon = notice.type === 'success' ? CheckCircle2 : notice.type === 'error' ? AlertTriangle : Info;
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${styles[notice.type]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{notice.text}</p>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', onConfirm, onCancel, busy, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md">
        <h3 className="text-lg font-bold text-forest">{title}</h3>
        <p className="mt-2 text-sm text-ink/70">{message}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status, label, tone }) {
  return <span className={`badge ${tone || ''}`}>{label || status}</span>;
}

export function errorText(err) {
  return err?.message || 'Something went wrong. Please try again.';
}
