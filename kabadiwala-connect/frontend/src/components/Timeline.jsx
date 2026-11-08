import { CheckCircle2, Circle } from 'lucide-react';
import { fmtDate } from '../lib/constants.js';

// Vertical timeline of tracking events (request -> pickup -> transaction -> dealer -> recycling unit).
export default function Timeline({ events }) {
  if (!events?.length) return <p className="text-sm text-ink/60">No tracking events yet.</p>;
  return (
    <ol className="relative ml-2 border-l-2 border-emerald-100">
      {events.map((e, i) => (
        <li key={`${e.stage}-${i}`} className="mb-5 ml-5">
          <span className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-white">
            {i === events.length - 1
              ? <CheckCircle2 className="h-5 w-5 text-emerald" />
              : <Circle className="h-4 w-4 text-emerald/60" />}
          </span>
          <p className="font-semibold text-forest">{e.label}</p>
          <p className="text-xs text-ink/60">
            {fmtDate(e.at)}{e.actor_role ? ` · by ${e.actor_role}` : ''}{e.note ? ` · ${e.note}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}
