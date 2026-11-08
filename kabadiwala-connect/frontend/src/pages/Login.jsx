import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { DEMO_ACCOUNTS, ROLE_HOME } from '../lib/constants.js';
import { firebaseEnabled } from '../lib/firebase.js';
import { Notice, errorText } from '../components/ui.jsx';
import { PublicLayout } from '../components/Layout.jsx';

export default function Login() {
  const { loginDev, loginFirebase } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const go = (profile) => navigate(ROLE_HOME[profile.role] || '/app');

  const submitFirebase = async (e) => {
    e.preventDefault();
    setBusy(true); setNotice(null);
    try { go(await loginFirebase(email, password)); }
    catch (err) { setNotice({ type: 'error', text: errorText(err) }); }
    finally { setBusy(false); }
  };

  const loginAs = async (addr) => {
    setBusy(true); setNotice(null);
    try { go(await loginDev(addr)); }
    catch (err) { setNotice({ type: 'error', text: errorText(err) }); }
    finally { setBusy(false); }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="card space-y-5">
          <h1 className="text-2xl font-bold text-forest">Login</h1>
          <Notice notice={notice} onClose={() => setNotice(null)} />
          {firebaseEnabled ? (
            <form className="space-y-4" onSubmit={submitFirebase}>
              <div><label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className="label" htmlFor="password">Password</label>
                <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
              <p className="text-center text-sm"><Link className="text-forest underline" to="/reset">Forgot password?</Link></p>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Development mode: choose a demo account. Set VITE_AUTH_MODE=firebase for real sign-in.
              </div>
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button key={a.email} className="btn-ghost justify-between" disabled={busy} onClick={() => loginAs(a.email)}>
                    <span>{a.label}</span><span className="text-xs text-ink/50">{a.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-center text-sm text-ink/70">New here? <Link className="font-semibold text-forest underline" to="/register">Create an account</Link></p>
        </div>
      </div>
    </PublicLayout>
  );
}
