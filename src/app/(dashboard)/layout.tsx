'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { StateContainer } from '@/components/ui/StateContainer';

/**
 * Dashboard Shell Layout.
 * Ensures the user has an active session before displaying the workspace.
 * If unauthenticated, gracefully redirects to /login.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <StateContainer type="loading" description="Redirecting to login..." />
      </div>
    );
  }

  return (
    <div className="erp-container">
      <AppSidebar />
      <div className="erp-main">
        <AppHeader />
        <main className="erp-content">{children}</main>
      </div>
    </div>
  );
}
