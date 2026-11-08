import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { firebaseAuth, firebaseEnabled } from '../lib/firebase.js';
import { Notice, errorText } from '../components/ui.jsx';
import { PublicLayout } from '../components/Layout.jsx';

export default function Reset() {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!firebaseEnabled) return setNotice({ type: 'info', text: 'Password reset uses Firebase Authentication. It is not available in development mode.' });
    setBusy(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setNotice({ type: 'success', text: 'If an account exists for this email, a reset link is on its way.' });
    } catch (err) {
      setNotice({ type: 'error', text: errorText(err) });
    } finally { setBusy(false); }
  };
  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-16">
        <form className="card space-y-4" onSubmit={submit}>
          <h1 className="text-2xl font-bold text-forest">Reset password</h1>
          <Notice notice={notice} onClose={() => setNotice(null)} />
          <div><label className="label" htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn-primary w-full" disabled={busy}>Send reset link</button>
          <p className="text-center text-sm"><Link className="text-forest underline" to="/login">Back to login</Link></p>
        </form>
      </div>
    </PublicLayout>
  );
}
