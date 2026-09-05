'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { employeeService } from '@/services/employee.service';
import { attendanceService } from '@/services/attendance.service';
import { timeoffService } from '@/services/timeoff.service';
import { Contract, Employee } from '@/types/employee.types';
import { AttendanceRecord } from '@/types/attendance.types';
import { TimeOffAllocation, TimeOffRequest } from '@/types/timeoff.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { SmartButton } from '@/components/ui/SmartButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatCurrency, formatDate, formatHours } from '@/lib/formatters';
import {
  FileText,
  Clock,
  CalendarCheck,
  CalendarClock,
  ArrowLeft,
  Briefcase,
  UserCheck,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function EmployeeHubPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const caps = getRoleCapabilities(role);
  const employeeId = params?.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'work' | 'private' | 'hr_settings' | 'contracts' | 'attendance' | 'timeoff' | 'allocations'
  const [activeTab, setActiveTab] = useState('work');

  const loadHubData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, cntRes, attRes, toRes, alcRes] = await Promise.all([
        employeeService.getEmployeeById(employeeId),
        employeeService.getContractsByEmployeeId(employeeId),
        attendanceService.getAttendanceByEmployeeId(employeeId),
        timeoffService.getTimeOffRequestsByEmployeeId(employeeId),
        timeoffService.getAllocationsByEmployeeId(employeeId),
      ]);

      if (empRes.success && empRes.data) {
        setEmployee(empRes.data);
      } else {
        setError(empRes.error || 'Employee record could not be retrieved.');
      }
      if (cntRes.success && cntRes.data) setContracts(cntRes.data);
      if (attRes.success && attRes.data) setAttendanceLogs(attRes.data);
      if (toRes.success && toRes.data) setTimeOffRequests(toRes.data);
      if (alcRes.success && alcRes.data) setAllocations(alcRes.data);
    } catch {
      setError('Network communication error loading employee hub.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!employeeId) return;

    Promise.all([
      employeeService.getEmployeeById(employeeId),
      employeeService.getContractsByEmployeeId(employeeId),
      attendanceService.getAttendanceByEmployeeId(employeeId),
      timeoffService.getTimeOffRequestsByEmployeeId(employeeId),
      timeoffService.getAllocationsByEmployeeId(employeeId),
    ])
      .then(([empRes, cntRes, attRes, toRes, alcRes]) => {
        if (!isMounted) return;
        if (empRes.success && empRes.data) {
          setEmployee(empRes.data);
          setError(null);
        } else {
          setError(empRes.error || 'Employee record could not be retrieved.');
        }
        if (cntRes.success && cntRes.data) setContracts(cntRes.data);
        if (attRes.success && attRes.data) setAttendanceLogs(attRes.data);
        if (toRes.success && toRes.data) setTimeOffRequests(toRes.data);
        if (alcRes.success && alcRes.data) setAllocations(alcRes.data);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication error loading employee hub.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [employeeId]);

  if (loading) {
    return <StateContainer type="loading" description="Loading employee operational hub..." />;
  }

  if (error) {
    return (
      <StateContainer
        type="error"
        title="Failed to Load Employee"
        description={error}
        onRetry={loadHubData}
      />
    );
  }

  if (!employee) {
    return (
      <StateContainer
        type="empty"
        title="Employee record not found"
        description="The requested employee ID does not exist in the database."
        actionText="Back to Directory"
        onAction={() => router.push('/employees')}
      />
    );
  }

  const tabs = [
    { id: 'work', label: 'Work Information', icon: <Briefcase size={15} /> },
    { id: 'private', label: 'Private Information', icon: <UserCheck size={15} /> },
    { id: 'hr_settings', label: 'HR & Bank Settings', icon: <CreditCard size={15} /> },
    { id: 'contracts', label: 'Related Contracts', count: contracts.length, icon: <FileText size={15} /> },
    { id: 'attendance', label: 'Attendance Records', count: attendanceLogs.length, icon: <Clock size={15} /> },
    { id: 'timeoff', label: 'Time Off Requests', count: timeOffRequests.length, icon: <CalendarCheck size={15} /> },
    { id: 'allocations', label: 'Allocations', count: allocations.length, icon: <CalendarClock size={15} /> },
  ];

  return (
    <div>
      <ActionRibbon
        title={employee.name}
        subtitle={`${employee.employeeCode} • ${employee.jobPosition}`}
        statusBadge={<Badge status={employee.status} />}
        leftActions={
          <Link href={role === 'employee' ? '/dashboard' : '/employees'} style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={15} />}>
              {role === 'employee' ? 'My Workspace' : 'Employees Directory'}
            </Button>
          </Link>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        <Card padding="lg" style={{ marginBottom: '1.5rem' }}>
          {/* Top Hub Bar: Avatar + Name + 4 Odoo Smart Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1.5rem',
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-light)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  border: '2px solid var(--color-primary-border)',
                }}
              >
                {employee.name.charAt(0)}
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {employee.name}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {employee.jobPosition} • <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{employee.department}</span>
                </p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Assigned Schedule: {employee.scheduleName}
                </span>
              </div>
            </div>

            {/* ODOO SMART BUTTONS (Direct linked stat counters) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <SmartButton
                label="Contracts"
                value={`${employee.smartCounters.contractsCount} Active`}
                subtext={employee.smartCounters.activeContractWage ? formatCurrency(employee.smartCounters.activeContractWage) + '/mo' : 'No contract'}
                icon={<FileText size={18} />}
                active={activeTab === 'contracts'}
                onClick={() => setActiveTab('contracts')}
              />

              <SmartButton
                label="Attendance"
                value={`${employee.smartCounters.attendanceRate}%`}
                subtext={`${employee.smartCounters.attendanceWorkedHours} hrs`}
                icon={<Clock size={18} />}
                active={activeTab === 'attendance'}
                onClick={() => setActiveTab('attendance')}
              />

              <SmartButton
                label="Time Off"
                value={`${employee.smartCounters.timeOffApprovedDays}d Approved`}
                subtext={`${employee.smartCounters.timeOffPendingCount} Pending`}
                icon={<CalendarCheck size={18} />}
                active={activeTab === 'timeoff'}
                onClick={() => setActiveTab('timeoff')}
              />

              <SmartButton
                label="Allocations"
                value={`${employee.smartCounters.remainingLeaveDays}d Remaining`}
                subtext="Available balance"
                icon={<CalendarClock size={18} />}
                active={activeTab === 'allocations'}
                onClick={() => setActiveTab('allocations')}
              />
            </div>
          </div>

          {/* Form Tabs */}
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content 1: Work Information */}
          {activeTab === 'work' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  Position & Hierarchy
                </h4>
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Department:</strong> {employee.department}</div>
                  <div><strong>Job Position:</strong> {employee.jobPosition}</div>
                  <div><strong>Manager:</strong> {employee.managerName || 'None'}</div>
                  <div><strong>Hire Date:</strong> {formatDate(employee.hireDate)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  Schedule & Location
                </h4>
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Working Schedule:</strong> {employee.scheduleName}</div>
                  <div><strong>Work Email:</strong> {employee.workEmail}</div>
                  <div><strong>Work Phone:</strong> {employee.workPhone}</div>
                  <div><strong>Status:</strong> <Badge status={employee.status} /></div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: Private Information */}
          {activeTab === 'private' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  Personal Details
                </h4>
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Legal Full Name:</strong> {employee.name}</div>
                  <div><strong>Nationality:</strong> United States</div>
                  <div><strong>Identification No:</strong> ID-{employee.employeeCode}-902</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  Emergency Contact
                </h4>
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Emergency Contact:</strong> Primary Family Contact</div>
                  <div><strong>Contact Phone:</strong> +1 (555) 998-1200</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: HR & Bank Settings */}
          {activeTab === 'hr_settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '540px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                Payroll Banking Account Details
              </h4>
              {employee.bankDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <div><strong>Bank Name:</strong> {employee.bankDetails.bankName}</div>
                  <div><strong>Account Number:</strong> {employee.bankDetails.accountNumber}</div>
                  <div><strong>Routing / IFSC:</strong> {employee.bankDetails.routingNumber}</div>
                  <div><strong>Account Holder:</strong> {employee.bankDetails.accountHolderName}</div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-warning-light)',
                    border: '1px solid var(--color-warning-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-warning-text)',
                    fontSize: '0.8125rem',
                  }}
                >
                  ⚠️ <strong>Missing Bank Account Details:</strong> Direct payroll bank transfers will require manual check disbursement until bank details are registered.
                </div>
              )}
            </div>
          )}

          {/* Tab Content 4: Related Contracts */}
          {activeTab === 'contracts' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Employee Contracts History</h4>
                {caps.canManageContracts && (
                  <Link href="/contracts" style={{ textDecoration: 'none' }}>
                    <Button variant="outline" size="sm">Manage Contracts</Button>
                  </Link>
                )}
              </div>
              <div className="erp-table-wrapper">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Ref</th>
                      <th>Structure</th>
                      <th>Wage</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((cnt) => (
                      <tr key={cnt.id}>
                        <td><code>{cnt.contractReference}</code></td>
                        <td>{cnt.salaryStructureName}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(cnt.wage)} / mo</td>
                        <td>{formatDate(cnt.startDate)}</td>
                        <td>{cnt.endDate ? formatDate(cnt.endDate) : 'Indefinite'}</td>
                        <td><Badge status={cnt.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Content 5: Attendance */}
          {activeTab === 'attendance' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Recent Attendance Entries</h4>
                <Link href="/attendance" style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm">View All Attendance</Button>
                </Link>
              </div>
              <div className="erp-table-wrapper">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Worked Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.date)}</td>
                        <td>{log.checkIn}</td>
                        <td>{log.checkOut || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{formatHours(log.workedHours)}</td>
                        <td><Badge status={log.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Content 6: Time Off Requests */}
          {activeTab === 'timeoff' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Leave Requests</h4>
                <Link href="/time-off/requests" style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm">Open Requests</Button>
                </Link>
              </div>
              <div className="erp-table-wrapper">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Request #</th>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Duration</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeOffRequests.map((req) => (
                      <tr key={req.id}>
                        <td><code>{req.requestNumber}</code></td>
                        <td>{req.timeOffTypeName}</td>
                        <td>{formatDate(req.startDate)} – {formatDate(req.endDate)}</td>
                        <td>{req.duration} {req.unit}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{req.reason || '—'}</td>
                        <td><Badge status={req.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Content 7: Allocations */}
          {activeTab === 'allocations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Leave Balance Allocations</h4>
                <Link href="/time-off/allocations" style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm">Allocations Ledger</Button>
                </Link>
              </div>
              <div className="erp-table-wrapper">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Total Quota</th>
                      <th>Days Taken</th>
                      <th>Remaining</th>
                      <th>Validity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((alc) => (
                      <tr key={alc.id}>
                        <td style={{ fontWeight: 600 }}>{alc.timeOffTypeName}</td>
                        <td>{alc.totalDays} Days</td>
                        <td style={{ color: 'var(--color-warning-text)' }}>{alc.takenDays} Days</td>
                        <td style={{ color: 'var(--color-success-text)', fontWeight: 700 }}>{alc.remainingDays} Days</td>
                        <td>{formatDate(alc.validityStart)} – {formatDate(alc.validityEnd)}</td>
                        <td><Badge status={alc.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
