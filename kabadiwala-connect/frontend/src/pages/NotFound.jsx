import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layout.jsx';

export default function NotFound() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-forest">Page not found</h1>
        <p className="mt-2 text-ink/60">The page you are looking for does not exist.</p>
        <Link className="btn-primary mt-6" to="/">Back to home</Link>
      </div>
    </PublicLayout>
  );
}
