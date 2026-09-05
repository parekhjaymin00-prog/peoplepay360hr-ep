'use client';

import { useEffect, useState } from 'react';
import { attendanceService } from '@/services/attendance.service';
import { AttendanceRecord } from '@/types/attendance.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatDate, formatHours } from '@/lib/formatters';
import { Plus, Edit3, CheckCircle } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

export default function AttendancePage() {
  const { user, hasPermission } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Permission checks
  const canCorrectAttendance = hasPermission('attendance.correct');
  const canViewAllAttendance = hasPermission('attendance.read');
  const isEmployee = user?.role?.code === 'EMPLOYEE';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceService.getAttendanceRecords();
      if (res.success && res.data) {
        // Employees see only their own data
        if (isEmployee && user?.employee) {
          setRecords(res.data.filter((r) => r.employeeId === user.employee!.id));
        } else {
          setRecords(res.data);
        }
      } else {
        setError(res.error || 'Failed to retrieve attendance logs from backend.');
      }
    } catch {
      setError('Network failure connecting to attendance service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    attendanceService
      .getAttendanceRecords()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          // Employees see only their own data
          if (isEmployee && user?.employee) {
            setRecords(res.data.filter((r) => r.employeeId === user.employee!.id));
          } else {
            setRecords(res.data);
          }
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve attendance logs from backend.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network failure connecting to attendance service.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isEmployee, user]);

  const openCorrection = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setCorrectionReason(rec.manualCorrectionReason || '');
    setIsModalOpen(true);
  };

  const handleSaveCorrection = () => {
    if (selectedRecord) {
      setRecords(
        records.map((r) =>
          r.id === selectedRecord.id
            ? { ...r, status: 'manual_edit', isCorrected: true, manualCorrectionReason: correctionReason }
            : r
        )
      );
    }
    setIsModalOpen(false);
  };

  return (
    <div>
      <ActionRibbon
        title={isEmployee ? 'My Attendance Register' : 'Daily Attendance Register'}
        subtitle={
          isEmployee
            ? 'Review your daily clock-ins, worked hours, and verified attendance records'
            : 'Review clock-ins, worked hours, missing checkouts, and overtime exceptions'
        }
        leftActions={
          canCorrectAttendance ? (
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
              Manual Attendance Entry
            </Button>
          ) : undefined
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading attendance register..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Attendance"
            description={error}
            onRetry={loadData}
          />
        ) : records.length === 0 ? (
          <StateContainer
            type="empty"
            title="No Attendance Records"
            description={isEmployee ? 'You have no attendance check-ins logged yet.' : 'No employee attendance logs recorded for this period.'}
          />
        ) : (
          <div className="erp-table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th style={{ textAlign: 'right' }}>Worked Hours</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td>{formatDate(rec.date)}</td>
                    <td style={{ fontWeight: 600 }}>{rec.employeeName}</td>
                    <td>{rec.department}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{rec.checkIn}</span>
                    </td>
                    <td>
                      {rec.checkOut ? (
                        <span style={{ fontWeight: 500 }}>{rec.checkOut}</span>
                      ) : (
                        <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem', fontWeight: 600 }}>
                          Missing Check-out
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatHours(rec.workedHours)}
                    </td>
                    <td>
                      <Badge status={rec.status}>
                        {rec.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {canCorrectAttendance ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Edit3 size={14} />}
                          onClick={() => openCorrection(rec)}
                        >
                          Correct
                        </Button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Logged
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Correction Dialog */}
      {selectedRecord && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Manual Attendance Correction: ${selectedRecord.employeeName}`}
          subtitle={`Entry for date: ${formatDate(selectedRecord.date)}`}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" leftIcon={<CheckCircle size={15} />} onClick={handleSaveCorrection}>
                Save Authorized Correction
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Input label="Check In Time" defaultValue={selectedRecord.checkIn} />
              <Input label="Check Out Time" defaultValue={selectedRecord.checkOut || '06:00 PM'} />
            </div>

            <Input
              label="Worked Hours (Auto-adjusted)"
              defaultValue={selectedRecord.workedHours.toString()}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Mandatory Correction Reason (Audit Trail)
              </label>
              <textarea
                rows={3}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Explain why manual correction was approved (e.g. badge terminal malfunction, field work)..."
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
