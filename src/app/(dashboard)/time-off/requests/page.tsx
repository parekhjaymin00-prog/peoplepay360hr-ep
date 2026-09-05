'use client';

import React, { useEffect, useState } from 'react';
import { timeoffService } from '@/services/timeoff.service';
import { TimeOffRequest } from '@/types/timeoff.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatDate } from '@/lib/formatters';
import { Plus, Check, X } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function TimeOffRequestsPage() {
  const { user, role } = useAuth();
  const caps = getRoleCapabilities(role);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    return () => {
      isMounted = false;
    };
  }, [role, user]);

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
          <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
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
    </div>
  );
}
