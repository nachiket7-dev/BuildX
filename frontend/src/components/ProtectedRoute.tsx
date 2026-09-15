import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './Logo';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, authReady, sessionError, retrySession } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return <div className="route-loading"><Logo size="lg" />{sessionError ? <><p role="alert">We couldn’t verify your session. Check your connection and try again.</p><button className="ui-button ui-button--primary" onClick={retrySession}>Try again</button></> : <p role="status">Verifying your session…</p>}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
