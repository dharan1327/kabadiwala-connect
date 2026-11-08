import { PublicLayout } from '../components/Layout.jsx';

// Placeholder legal text. Must be reviewed and replaced by counsel before any real use.
export default function Legal({ title }) {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-12">
        <h1 className="text-3xl font-bold text-forest">{title}</h1>
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Draft placeholder for the demonstration. This text has not been reviewed by legal counsel and is not a binding policy.
        </div>
        <p className="text-ink/70">
          Final {title.toLowerCase()} will describe what personal data is collected, why, how long it is kept, and your rights,
          in line with applicable Indian law including the Digital Personal Data Protection Act, 2023.
        </p>
      </article>
    </PublicLayout>
  );
}
