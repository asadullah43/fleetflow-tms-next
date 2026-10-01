'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import type { RpcError } from '../../lib/grpc/client';
import { Icon } from '../../components/icons';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err) {
      const rpcError = err as RpcError;
      setError(rpcError.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="auth-hero-icons">
          <span>
            <Icon.truck size={22} />
          </span>
          <span>
            <Icon.building size={22} />
          </span>
          <span>
            <Icon.box size={22} />
          </span>
          <span>
            <Icon.mapPin size={22} />
          </span>
        </div>
        <div>
          <div className="auth-hero-tag">Trucking &middot; Logistics &middot; Operations</div>
          <h2>Every trip, every truck, one screen.</h2>
        </div>
      </div>

      <div className="auth-form-side">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-brand">
            <span className="sidebar-brand-mark">
              <Icon.truck size={16} />
            </span>
            <strong>FleetFlow</strong>
          </div>
          <h1>Sign in</h1>
          <p className="subtitle">Use your FleetFlow credentials.</p>
          {error && <div className="error-banner">{error}</div>}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
