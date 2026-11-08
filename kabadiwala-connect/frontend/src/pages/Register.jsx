import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { api, session } from '../lib/api.js';
import { firebaseAuth, firebaseEnabled } from '../lib/firebase.js';
import { ROLES, ROLE_HOME } from '../lib/constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Notice, errorText } from '../components/ui.jsx';
import { PublicLayout } from '../components/Layout.jsx';

const EMPTY = {
  full_name: '', email: '', phone: '', password: '', confirm: '', address: '', city: '', pin_code: '',
  role: 'household', organization_name: '', lat: null, lng: null,
};

export function validate(f) {
  const errs = {};
  if (f.full_name.trim().length < 2) errs.full_name = 'Enter your full name';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) errs.email = 'Enter a valid email address';
  if (!/^\+?\d{10,15}$/.test(f.phone.replace(/[\s-]/g, ''))) errs.phone = 'Enter a 10–15 digit mobile number';
  if (firebaseEnabled && f.password.length < 8) errs.password = 'Use at least 8 characters';
  if (firebaseEnabled && f.password !== f.confirm) errs.confirm = 'Passwords do not match';
  if (f.address.trim().length < 5) errs.address = 'Enter your address';
  if (f.city.trim().length < 2) errs.city = 'Enter your city';
  if (!/^\d{6}$/.test(f.pin_code)) errs.pin_code = 'PIN code must be 6 digits';
  return errs;
}

export default function Register() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [form, setForm] = useState({ ...EMPTY, role: ROLES.some((r) => r.value === params.get('role')) ? params.get('role') : 'household' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const useLocation = () => {
    if (!navigator.geolocation) return setNotice({ type: 'info', text: 'Location is not available. Enter your address manually.' });
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })); setNotice({ type: 'success', text: 'Location saved for pickup matching.' }); },
      () => setNotice({ type: 'info', text: 'Location permission denied. You can enter your address manually.' }),
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return setNotice({ type: 'error', text: 'Please correct the highlighted fields.' });
    setBusy(true); setNotice(null);
    const payload = {
      full_name: form.full_name.trim(), email: form.email.trim(), phone: form.phone.replace(/[\s-]/g, ''),
      address: form.address.trim(), city: form.city.trim(), pin_code: form.pin_code, role: form.role,
      organization_name: form.organization_name.trim() || null, lat: form.lat, lng: form.lng,
    };
    try {
      if (firebaseEnabled) {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, payload.email, form.password);
        await sendEmailVerification(cred.user);
        session.getToken = () => cred.user.getIdToken();
        await api('/auth/register', { method: 'POST', body: payload });
        await signOut(firebaseAuth);
        session.getToken = async () => null;
        setDone(true);
      } else {
        await api('/auth/register', { method: 'POST', body: payload });
        setNotice({ type: 'success', text: 'Account created (development mode). Choose a demo account to sign in, or log in with this email.' });
        setDone(true);
      }
    } catch (err) {
      setNotice({ type: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const field = (id, label, props = {}) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={form[id]} onChange={set(id)} aria-invalid={!!errors[id]} {...props} />
      {errors[id] && <p className="mt-1 text-xs text-red-700">{errors[id]}</p>}
    </div>
  );

  if (user) return <Navigate to={ROLE_HOME[user.role] || '/app'} replace />;

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card space-y-5">
          <h1 className="text-2xl font-bold text-forest">Create your account</h1>
          <Notice notice={notice} onClose={() => setNotice(null)} />
          {done ? (
            <div className="space-y-3 text-sm text-ink/80">
              {firebaseEnabled && <p>We sent a verification link to <strong>{form.email}</strong>. Verify your email, then sign in.</p>}
              <Link className="btn-primary" to="/login">Go to login</Link>
            </div>
          ) : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
              <div className="md:col-span-2">
                <label className="label" htmlFor="role">I am a</label>
                <select id="role" className="input" value={form.role} onChange={set('role')}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {field('full_name', 'Full name', { autoComplete: 'name' })}
              {field('email', 'Email address', { type: 'email', autoComplete: 'email' })}
              {field('phone', 'Mobile number', { type: 'tel', autoComplete: 'tel' })}
              {firebaseEnabled && field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
              {firebaseEnabled && field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
              <div className="md:col-span-2">{field('address', 'Address (private: shared only for a confirmed pickup)')}</div>
              {field('city', 'City')}
              {field('pin_code', 'PIN code', { inputMode: 'numeric', maxLength: 6 })}
              {(form.role === 'dealer' || form.role === 'recycler') && (
                <div className="md:col-span-2">{field('organization_name', 'Organisation name')}</div>
              )}
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button type="button" className="btn-ghost" onClick={useLocation}>Use my location</button>
                <span className="text-xs text-ink/50">Optional. Used only to match nearby pickups.</span>
              </div>
              <div className="md:col-span-2">
                <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
              </div>
            </form>
          )}
          <p className="text-center text-sm text-ink/70">Already registered? <Link className="font-semibold text-forest underline" to="/login">Login</Link></p>
        </div>
      </div>
    </PublicLayout>
  );
}
