export const CATEGORIES = [
  { value: 'paper', label: 'Paper' },
  { value: 'cardboard', label: 'Cardboard' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'mixed_plastics', label: 'Mixed plastics' },
  { value: 'iron', label: 'Iron' },
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'copper', label: 'Copper' },
  { value: 'glass', label: 'Glass' },
  { value: 'circuit_boards', label: 'Circuit boards' },
  { value: 'cables', label: 'Cables' },
  { value: 'batteries', label: 'Batteries' },
  { value: 'screens', label: 'Screens' },
  { value: 'motors', label: 'Motors' },
  { value: 'other', label: 'Other recyclables' },
];

export const ROLES = [
  { value: 'household', label: 'Household' },
  { value: 'collector', label: 'Kabadiwala (collector)' },
  { value: 'dealer', label: 'Scrap dealer' },
  { value: 'recycler', label: 'Recycling unit' },
];

export const ROLE_HOME = {
  household: '/app/household',
  collector: '/app/collector',
  dealer: '/app/dealer',
  recycler: '/app/recycler',
  admin: '/app/admin',
};

export const DEMO_ACCOUNTS = [
  { email: 'household@demo.kc', label: 'Household' },
  { email: 'collector@demo.kc', label: 'Collector (Ravi)' },
  { email: 'collector2@demo.kc', label: 'Collector (Lakshmi)' },
  { email: 'dealer@demo.kc', label: 'Scrap dealer' },
  { email: 'recycler@demo.kc', label: 'Recycling unit' },
  { email: 'admin@demo.kc', label: 'Administrator' },
];

export const STATUS_TONE = {
  open: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-sky-100 text-sky-800',
  arriving: 'bg-sky-100 text-sky-800',
  collected: 'bg-violet-100 text-violet-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-700',
};

export const inr = (n) =>
  n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const LOT_LABELS = {
  available: 'Available to buy',
  purchased: 'Purchased by dealer',
  dispatched: 'Dispatched to recycling unit',
  received: 'Received by recycling unit',
  processing: 'Recycling in progress',
  recycled: 'Recycled (confirmed by recycler)',
  rejected: 'Rejected at inspection',
};

export const REQUEST_LABELS = {
  open: 'Open for offers', scheduled: 'Pickup scheduled', arriving: 'Collector arriving',
  collected: 'Material collected', completed: 'Completed', cancelled: 'Cancelled',
};
