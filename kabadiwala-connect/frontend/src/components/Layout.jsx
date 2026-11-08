import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Recycle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { fmtDate } from '../lib/constants.js';
import { DEMO_ACCOUNTS } from '../lib/constants.js';
import { firebaseEnabled } from '../lib/firebase.js';

export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;

export function Logo({ light = false }) {
  return (
    <Link to="/" className="flex items-center gap-2 font-bold">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-forest">
        <Recycle className="h-5 w-5" />
      </span>
      <span className={light ? 'text-white' : 'text-forest'}>Kabadiwala Connect</span>
    </Link>
  );
}

const PUBLIC_LINKS = [
  ['#home', 'Home'], ['#about', 'About Us'], ['#how', 'How It Works'], ['#services', 'Services'],
  ['#prices', 'Scrap Prices'], ['#contact', 'Contact'],
];

export function PublicLayout({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3" aria-label="Main">
          <Logo />
          <ul className="hidden items-center gap-5 text-sm font-medium text-ink/80 lg:flex">
            {PUBLIC_LINKS.map(([href, label]) => (
              <li key={href}><a className="hover:text-forest" href={href}>{label}</a></li>
            ))}
          </ul>
          <div className="hidden gap-2 lg:flex">
            {user ? (
              <Link className="btn-primary" to="/app">Go to dashboard</Link>
            ) : (
              <>
                <Link className="btn-ghost" to="/login">Login</Link>
                <Link className="btn-primary" to="/register">Register</Link>
              </>
            )}
          </div>
          <button className="btn-ghost lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        {open && (
          <div className="border-t border-emerald-100 bg-white px-4 py-3 lg:hidden">
            {PUBLIC_LINKS.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="block py-2 text-ink/80">{label}</a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link className="btn-ghost flex-1" to="/login">Login</Link>
              <Link className="btn-primary flex-1" to="/register">Register</Link>
            </div>
          </div>
        )}
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 bg-forest text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-3 text-sm text-white/70">Connecting Waste to Wealth, Empowering Every Collector.</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold">Company</p>
          <ul className="space-y-1 text-white/80">
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold">Legal</p>
          <ul className="space-y-1 text-white/80">
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/terms">Terms and Conditions</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold">Follow</p>
          <p className="text-white/70">Add your official social links in the footer component before launch.</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Kabadiwala Connect · Maatram HackForge 2026–27 · MH26-28
      </div>
    </footer>
  );
}

function NotificationBell() {
  const [data, setData] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const load = () => api('/notifications').then(setData).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); load(); };
  const markOne = async (n) => {
    if (!n.read) await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    load();
  };
  return (
    <div className="relative">
      <button className="btn-ghost relative !p-2.5" onClick={() => setOpen(!open)} aria-label={`Notifications, ${data.unread} unread`}>
        <Bell className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs text-white">
            {data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-emerald-100 bg-white p-3 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-forest">Notifications</p>
            <button className="text-xs text-emerald-700 hover:underline" onClick={readAll}>Mark all read</button>
          </div>
          <ul className="max-h-80 space-y-2 overflow-auto">
            {data.items.length === 0 && <li className="text-sm text-ink/60">You're all caught up.</li>}
            {data.items.map((n) => (
              <li key={n.id} className={`rounded-xl p-2 text-sm ${n.read ? 'bg-white' : 'bg-emerald-50'}`}>
                <button className="text-left" onClick={() => markOne(n)}>
                  <p>{n.message}</p>
                  <p className="text-xs text-ink/50">{fmtDate(n.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DashboardLayout({ title, nav }) {
  const { user, logout, loginDev } = useAuth();
  const navigate = useNavigate();
  const onLogout = async () => { await logout(); navigate('/'); };
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-emerald-100 bg-white md:fixed md:inset-y-0 md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 md:block md:p-6">
          <Logo />
          <p className="hidden text-xs text-ink/50 md:mt-2 md:block">{title}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1" aria-label="Dashboard">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'bg-emerald-50 text-forest' : 'text-ink/70 hover:bg-surface'}`}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 md:ml-60">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-emerald-100 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/50">{title}</p>
            <p className="font-semibold text-forest">{user?.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {!firebaseEnabled && <DevSwitcher current={user?.email} onSwitch={loginDev} />}
            <button className="btn-ghost !p-2.5" onClick={onLogout} aria-label="Log out"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Dev mode only: quickly switch between demo accounts to test each role.
function DevSwitcher({ current, onSwitch }) {
  const navigate = useNavigate();
  return (
    <select
      aria-label="Switch demo account"
      className="input hidden !w-auto py-1.5 text-xs md:block"
      value={current || ''}
      onChange={async (e) => {
        const profile = await onSwitch(e.target.value);
        navigate(profile.role === 'household' ? '/app/household' : `/app/${profile.role}`);
      }}
    >
      {DEMO_ACCOUNTS.map((a) => <option key={a.email} value={a.email}>{a.label}</option>)}
    </select>
  );
}
