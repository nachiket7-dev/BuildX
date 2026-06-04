import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  viewKey: string;
}

export function PageTransition({ children, viewKey }: PageTransitionProps) {
  return (
    <div key={viewKey} className="page-view page-view--stagger">
      {children}
    </div>
  );
}
