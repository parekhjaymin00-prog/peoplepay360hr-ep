'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { employeeService } from '@/services/employee.service';
import { payrollService } from '@/services/payroll.service';
import { attendanceService } from '@/services/attendance.service';
import { Employee } from '@/types/employee.types';
import { Payslip } from '@/types/payroll.types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatCurrency, formatDate, formatHours } from '@/lib/formatters';
import {
  Clock,
  CalendarCheck,
  CalendarClock,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockLoading, setClockLoading] = useState(false);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [myRecentPayslip, setMyRecentPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const empId = user?.employee?.id;

    Promise.all([
      empId ? employeeService.getEmployeeById(empId) : employeeService.getEmployees(),
      payrollService.getPayslips(),
    ])
      .then(([empRes, slipsRes]) => {
        if (!isMounted) return;
        if (empRes.success && empRes.data) {
          if (Array.isArray(empRes.data)) {
            setEmployee(empRes.data[0] || null);
          } else {
            setEmployee(empRes.data);
          }
        }
        if (slipsRes.success && slipsRes.data && slipsRes.data.length > 0) {
          const userSlip = empId ? slipsRes.data.find((s) => s.employeeId === empId) : slipsRes.data[0];
          setMyRecentPayslip(userSlip || slipsRes.data[0]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleClockToggle = async () => {
    if (clockLoading) return;
    setClockLoading(true);
    try {
      if (!clockedIn) {
        await attendanceService.checkIn();
        setClockedIn(true);
        setClockInTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        await attendanceService.checkOut();
        setClockedIn(false);
        setClockInTime(null);
      }
    } catch {
      // Handled gracefully
    } finally {
      setClockLoading(false);
    }
  };

  if (loading) {
    return <StateContainer type="loading" description="Loading employee workspace..." />;
  }

  const empName = employee?.name || user?.employee?.firstName || 'Employee';
  const empCode = employee?.employeeCode || user?.employee?.employeeNumber || 'EMP';
  const empJob = employee?.jobPosition || user?.employee?.jobPosition?.title || 'Staff Member';
  const empDept = employee?.department || user?.employee?.department?.name || 'Operations';


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Welcome Banner */}
      <Card padding="md" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', color: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>
                Employee Workspace
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>ID: {empCode}</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Welcome back, {empName}
            </h2>
            <p style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.25rem' }}>
              {empJob} • {empDept}
            </p>
          </div>

          {/* Quick Clock Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Today&apos;s Presence</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                {clockedIn ? `Clocked in at ${clockInTime}` : 'Not clocked in yet'}
              </div>
            </div>
            <Button
              variant={clockedIn ? 'danger' : 'success'}
              size="md"
              leftIcon={<Clock size={16} />}
              onClick={handleClockToggle}
              disabled={clockLoading}
            >
              {clockLoading ? 'Updating...' : clockedIn ? 'Clock Out' : 'Clock In Now'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Personal KPI / Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Attendance Summary */}
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              My Attendance
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {employee?.smartCounters?.attendanceWorkedHours ? formatHours(employee.smartCounters.attendanceWorkedHours) : '—'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--color-success-text)', fontWeight: 600 }}>
              {employee?.smartCounters?.attendanceRate !== undefined ? `${employee.smartCounters.attendanceRate}% On-Time` : 'Schedule Synced'}
            </span>
            <Link href="/attendance" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
              View Logs &rarr;
            </Link>
          </div>
        </Card>

        {/* Leave Balance */}
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Leave Balance
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
              <CalendarClock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {employee?.smartCounters?.remainingLeaveDays !== undefined ? `${employee.smartCounters.remainingLeaveDays} Days` : '—'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {employee?.smartCounters?.timeOffApprovedDays !== undefined ? `${employee.smartCounters.timeOffApprovedDays}d used this year` : 'Quotas tracked'}
            </span>
            <Link href="/time-off/allocations" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
              Allocations &rarr;
            </Link>
          </div>
        </Card>

        {/* Pending Requests */}
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Time Off Requests
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-warning-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
              <CalendarCheck size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {employee?.smartCounters?.timeOffPendingCount !== undefined ? `${employee.smartCounters.timeOffPendingCount} Pending` : '0 Pending'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Supervisor review status</span>
            <Link href="/time-off/requests" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
              My Requests &rarr;
            </Link>
          </div>
        </Card>

        {/* Latest Payslip */}
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Latest Payslip
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <FileSpreadsheet size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {myRecentPayslip ? formatCurrency(myRecentPayslip.netSalary) : '—'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {myRecentPayslip?.periodStart ? `Period: ${formatDate(myRecentPayslip.periodStart)}` : 'Archived records'}
            </span>
            {myRecentPayslip ? (
              <Link href={`/payroll/payslips/${myRecentPayslip.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                View Payslip &rarr;
              </Link>
            ) : (
              <Link href="/payroll/payslips" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                Payslips &rarr;
              </Link>
            )}
          </div>
        </Card>
      </div>

      {/* Two-Column Grid: My Information & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Profile & Schedule Overview */}
        <Card padding="md">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Employment Context
            </h3>
            {employee && (
              <Link href={`/employees/${employee.id}`} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                Full Profile Hub
              </Link>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Work Schedule:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{employee?.scheduleName || 'Standard Schedule (40h)'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Reporting Manager:</span>
              <span>{employee?.managerName || 'Operations Manager'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Official Work Email:</span>
              <span>{employee?.workEmail || user?.email || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Hire Date:</span>
              <span>{employee?.hireDate ? formatDate(employee.hireDate) : 'Active'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Employment Status:</span>
              {employee?.status ? <Badge status={employee.status} size="sm" /> : <Badge status="active" size="sm" />}
            </div>
          </div>
        </Card>

        {/* Quick Shortcuts */}
        <Card padding="md">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Employee Self-Service Shortcuts
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link href="/time-off/requests" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <CalendarCheck size={16} color="var(--color-primary)" />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Request Time Off / Leave
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Submit paid vacation, sick leave, or absence request
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} color="var(--text-muted)" />
              </div>
            </Link>

            <Link href="/attendance" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Clock size={16} color="var(--color-primary)" />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      View Attendance Timesheet
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Review check-in history, total worked hours, and break periods
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} color="var(--text-muted)" />
              </div>
            </Link>

            <Link href={myRecentPayslip ? `/payroll/payslips/${myRecentPayslip.id}` : '/payroll/payslips'} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <FileSpreadsheet size={16} color="var(--color-primary)" />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Print / Download Latest Payslip
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      March 2026 Salary Computation breakdown & PDF
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} color="var(--text-muted)" />
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
