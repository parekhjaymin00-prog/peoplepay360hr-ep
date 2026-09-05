'use client';

import React, { useEffect, useState } from 'react';
import { timeoffService } from '@/services/timeoff.service';
import { TimeOffRequest, TimeOffType } from '@/types/timeoff.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatDate } from '@/lib/formatters';
import { Plus, Check, X, AlertCircle } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function TimeOffRequestsPage() {
  const { user, role } = useAuth();
  const caps = getRoleCapabilities(role);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Request Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await timeoffService.getTimeOffRequests();
      if (res.success && res.data) {
        if (role === 'EMPLOYEE') {
          const myId = user?.employee?.id;
          setRequests(myId ? res.data.filter((r) => r.employeeId === myId) : res.data);
        } else {
          setRequests(res.data);
        }
      } else {
        setError(res.error || 'Failed to retrieve time off requests.');
      }
    } catch {
      setError('Network communication failure loading time off requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    timeoffService
      .getTimeOffRequests()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          if (role === 'EMPLOYEE') {
            const myId = user?.employee?.id;
            setRequests(myId ? res.data.filter((r) => r.employeeId === myId) : res.data);
          } else {
            setRequests(res.data);
          }
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve time off requests.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure loading time off requests.');
          setLoading(false);
        }
      });

    timeoffService.getTimeOffTypes().then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setTypes(res.data);
        setSelectedTypeId(res.data[0].id);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [role, user]);

  const handleOpenModal = () => {
    setFormError(null);
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setReason('');
    if (types.length > 0 && !selectedTypeId) {
      setSelectedTypeId(types[0].id);
    }
    setIsModalOpen(true);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeId || !startDate || !endDate) {
      setFormError('Please select a leave type and provide start and end dates.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await timeoffService.createTimeOffRequest({
        timeOffTypeId: selectedTypeId,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });

      if (res.success) {
        setIsModalOpen(false);
        await loadData();
      } else {
        setFormError(res.error || 'Unable to submit time off request.');
      }
    } catch {
      setFormError('Network error submitting time off request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await timeoffService.approveRequest(id);
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || 'Failed to approve request on backend.');
      }
    } catch {
      alert('Network error approving time off request.');
    }
  };

  const handleRefuse = async (id: string) => {
    try {
      const res = await timeoffService.refuseRequest(id);
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || 'Failed to refuse request on backend.');
      }
    } catch {
      alert('Network error refusing time off request.');
    }
  };

  return (
    <div>
      <ActionRibbon
        title="Time Off Requests"
        subtitle="Manage leave requests, medical absences, and supervisor approval workflow"
        leftActions={
          <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={handleOpenModal}>
            New Time Off Request
          </Button>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading time off requests..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Time Off Requests"
            description={error}
            onRetry={loadData}
          />
        ) : requests.length === 0 ? (
          <StateContainer
            type="empty"
            title="No Time Off Requests Found"
            description={role === 'EMPLOYEE' ? 'You have not submitted any time off requests.' : 'No employee leave requests are currently registered in the system.'}
          />
        ) : (
          <div className="erp-table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Request #</th>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Date Range</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Approval Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const isPending = req.status === 'submitted';

                  return (
                    <tr key={req.id}>
                      <td>
                        <code>{req.requestNumber}</code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{req.employeeName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.department}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{req.timeOffTypeName}</span>
                      </td>
                      <td>
                        {formatDate(req.startDate)} – {formatDate(req.endDate)}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {req.duration} {req.unit}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '240px' }}>
                        {req.reason || '—'}
                      </td>
                      <td>
                        <Badge status={req.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isPending && caps.canApproveTimeOff ? (
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <Button
                              variant="success"
                              size="sm"
                              leftIcon={<Check size={14} />}
                              onClick={() => handleApprove(req.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              leftIcon={<X size={14} />}
                              onClick={() => handleRefuse(req.id)}
                            >
                              Refuse
                            </Button>
                          </div>
                        ) : isPending ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-text)', fontWeight: 600 }}>
                            Pending Approval
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {req.status === 'approved' ? `Approved by ${req.approvedBy || 'HR'}` : 'Refused'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Time Off Request Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)',
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                New Time Off Request
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 0.875rem',
                  backgroundColor: 'var(--color-danger-light)',
                  border: '1px solid var(--color-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-danger-text)',
                  fontSize: '0.8125rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label
                  htmlFor="timeOffTypeSelect"
                  style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Time Off Type
                </label>
                <select
                  id="timeOffTypeSelect"
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.875rem',
                    backgroundColor: '#ffffff',
                  }}
                  required
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.unit.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Input
                  id="startDate"
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={submitting}
                />
                <Input
                  id="endDate"
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="timeOffReason"
                  style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Reason / Notes
                </label>
                <textarea
                  id="timeOffReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Optional context for your manager..."
                  disabled={submitting}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
