'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ROLE_DEFINITIONS } from '@/lib/permissions';
import { Clock, User as UserIcon, CheckCircle2, LogOut } from 'lucide-react';
import { attendanceService } from '@/services/attendance.service';

type ShiftStatus = 'not_started' | 'active' | 'completed';

export const AppHeader: React.FC = () => {
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>('not_started');
  const [clockTime, setClockTime] = useState<string | null>(null);
  const [clockLoading, setClockLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (user?.employee) {
      attendanceService
        .getAttendanceRecords()
        .then((res) => {
          if (!isMounted) return;
          if (res.success && res.data) {
            const todayUtc = new Date().toISOString().split('T')[0];
            const todayRec = res.data.find((r) => r.date === todayUtc);
            if (todayRec) {
              if (todayRec.checkIn && !todayRec.checkOut) {
                setShiftStatus('active');
                setClockTime(todayRec.checkIn);
              } else if (todayRec.checkOut) {
                setShiftStatus('completed');
                setClockTime(todayRec.checkIn);
              }
            } else {
              setShiftStatus('not_started');
              setClockTime(null);
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleToggleClock = async () => {
    if (clockLoading || shiftStatus === 'completed') return;
    setClockLoading(true);
    try {
      if (shiftStatus === 'not_started') {
        const res = await attendanceService.checkIn();
        if (res.success && res.data) {
          setShiftStatus('active');
          setClockTime(res.data.checkIn);
        }
      } else if (shiftStatus === 'active') {
        const res = await attendanceService.checkOut();
        if (res.success && res.data) {
          setShiftStatus('completed');
          setClockTime(res.data.checkIn);
        }
      }
    } catch {
      // Handled gracefully
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
          disabled={clockLoading || shiftStatus === 'completed'}
          title={
            shiftStatus === 'completed'
              ? 'Shift completed for today'
              : shiftStatus === 'active'
              ? `Checked in at ${clockTime}. Click to Check Out.`
              : 'Click to Check In'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: '1px solid',
            backgroundColor:
              shiftStatus === 'completed'
                ? '#f1f5f9'
                : shiftStatus === 'active'
                ? 'var(--color-success-light)'
                : '#f8fafc',
            borderColor:
              shiftStatus === 'completed'
                ? 'var(--border-color)'
                : shiftStatus === 'active'
                ? 'var(--color-success-border)'
                : 'var(--border-color)',
            color:
              shiftStatus === 'completed'
                ? 'var(--text-muted)'
                : shiftStatus === 'active'
                ? 'var(--color-success-text)'
                : 'var(--text-secondary)',
            cursor:
              clockLoading
                ? 'wait'
                : shiftStatus === 'completed'
                ? 'default'
                : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {shiftStatus === 'completed' ? (
            <CheckCircle2 size={14} color="var(--text-muted)" />
          ) : shiftStatus === 'active' ? (
            <CheckCircle2 size={14} color="var(--color-success)" />
          ) : (
            <Clock size={14} />
          )}
          <span>
            {clockLoading
              ? 'Syncing...'
              : shiftStatus === 'completed'
              ? 'Checked Out (Done)'
              : shiftStatus === 'active'
              ? `Checked In (${clockTime})`
              : 'Check In'}
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
            {user?.employee ? user.employee.firstName.charAt(0) : (user?.email ? user.email.charAt(0).toUpperCase() : <UserIcon size={16} />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email || 'User'}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {role ? ROLE_DEFINITIONS[role]?.roleLabel : 'User'}
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
