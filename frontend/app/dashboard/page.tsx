'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

/**
 * Placeholder landing page proving the full stack: Next.js -> Envoy
 * (grpc-web) -> Node gRPC backend -> Postgres, with a real JWT session.
 * Each ported module gets its own route here, mirroring the old
 * Flutter app's screens (frontend/lib/screens/* in the legacy app).
 */
export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className="centered-screen">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ padding: 32 }}>
      <h1>Welcome, {user.name}</h1>
      <p style={{ color: 'var(--color-muted)' }}>
        Role: {user.role ?? 'None'} &middot; Language: {user.language}
      </p>
      <button className="primary" style={{ width: 'auto', marginTop: 24 }} onClick={logout}>
        Sign out
      </button>
    </div>
  );
}
