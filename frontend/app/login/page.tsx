'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useCompanyBranding } from '../../lib/use-company-branding';
import { useT } from '../../lib/language-context';
import type { RpcError } from '../../lib/grpc/client';
import { Icon } from '../../components/icons';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export default function LoginPage() {
  const { login } = useAuth();
  const { companyName, logoUrl } = useCompanyBranding();
  const t = useT();
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
          <div className="auth-hero-tag">{t('Trucking · Logistics · Operations')}</div>
          <h2>{t('Every trip, every truck, one screen.')}</h2>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-lang-row">
          <LanguageSwitcher />
        </div>
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-brand">
            {logoUrl ? (
              <span className="sidebar-brand-mark sidebar-brand-mark-logo">
                <img src={logoUrl} alt={companyName} />
              </span>
            ) : (
              <span className="sidebar-brand-mark">
                <Icon.truck size={16} />
              </span>
            )}
            <strong>{companyName}</strong>
          </div>
          <h1>{t('Sign in')}</h1>
          <p className="subtitle">{t('Use your {company} credentials.').replace('{company}', companyName)}</p>
          {error && <div className="error-banner">{error}</div>}
          <div className="field">
            <label htmlFor="username">{t('Username')}</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t('Password')}</label>
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
            {submitting ? t('Signing in...') : t('Sign in')}
          </button>
        </form>
      </div>
    </div>
  );
}
