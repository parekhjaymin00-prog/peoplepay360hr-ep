'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ROLE_DEFINITIONS } from '@/lib/permissions';
import { Clock, User as UserIcon, CheckCircle2, LogOut } from 'lucide-react';
import { attendanceService } from '@/services/attendance.service';

export const AppHeader: React.FC = () => {
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const [clockedIn, setClockedIn] = useState(false);
  const [clockTime, setClockTime] = useState<string | null>(null);
  const [clockLoading, setClockLoading] = useState(false);

  const handleToggleClock = async () => {
    if (clockLoading) return;
    setClockLoading(true);
    try {
      if (!clockedIn) {
        await attendanceService.checkIn();
        setClockedIn(true);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setClockTime(timeStr);
      } else {
        await attendanceService.checkOut();
        setClockedIn(false);
        setClockTime(null);
      }
    } catch {
      // Backend error will be handled gracefully
    } finally {
      setClockLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="erp-header">
      {/* Left: Operations Workspace breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          PeoplePay360 Operations Workspace
        </span>
      </div>

      {/* Right: Real Attendance Check-in + Authenticated User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        {/* Real Attendance Check-in widget */}
        <button
          onClick={handleToggleClock}
          disabled={clockLoading}
          title={clockedIn ? `Checked in at ${clockTime}. Click to Check Out.` : 'Click to Check In'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: '1px solid',
            backgroundColor: clockedIn ? 'var(--color-success-light)' : '#f8fafc',
            borderColor: clockedIn ? 'var(--color-success-border)' : 'var(--border-color)',
            color: clockedIn ? 'var(--color-success-text)' : 'var(--text-secondary)',
            cursor: clockLoading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {clockedIn ? <CheckCircle2 size={14} color="var(--color-success)" /> : <Clock size={14} />}
          <span>
            {clockLoading ? 'Syncing...' : clockedIn ? `Checked In (${clockTime})` : 'Check In'}
          </span>
        </button>

        {/* Active Authenticated User Information */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '0.8125rem',
            }}
          >
            {user?.name ? user.name.charAt(0) : <UserIcon size={16} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.name || 'User'}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {ROLE_DEFINITIONS[role]?.roleLabel || role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out to Login Screen"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.35rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginLeft: '0.25rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-danger)';
              e.currentTarget.style.borderColor = 'var(--color-danger-border)';
              e.currentTarget.style.backgroundColor = 'var(--color-danger-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};

