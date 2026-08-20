import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME, type UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, userRole, initialising } = useAuth();
  const location = useLocation();

  // Wait for the stored token to be validated, otherwise a page refresh
  // bounces the user to /login before the session is restored.
  if (initialising) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admins are allowed everywhere.
  if (allowedRoles && userRole && userRole !== 'ADMIN' && !allowedRoles.includes(userRole)) {
    return <Navigate to={ROLE_HOME[userRole]} replace />;
  }

  return <>{children}</>;
}
