import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './Logo';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Logo size="lg" />
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin-slow"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
        <p className="font-mono text-xs tracking-tight" style={{ color: 'var(--text3)' }}>
          Verifying session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
