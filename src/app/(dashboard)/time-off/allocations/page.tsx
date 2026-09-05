'use client';

import React, { useEffect, useState } from 'react';
import { timeoffService } from '@/services/timeoff.service';
import { TimeOffAllocation } from '@/types/timeoff.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatDate } from '@/lib/formatters';
import { Plus } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

export default function TimeOffAllocationsPage() {
  const { user, role } = useAuth();
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await timeoffService.getTimeOffAllocations();
      if (res.success && res.data) {
        if (role === 'employee') {
          const myId = user?.employeeId || user?.id;
          setAllocations(myId ? res.data.filter((alc) => alc.employeeId === myId) : res.data);
        } else {
          setAllocations(res.data);
        }
      } else {
        setError(res.error || 'Failed to retrieve leave allocations.');
      }
    } catch {
      setError('Network communication failure loading leave allocations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    timeoffService
      .getTimeOffAllocations()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          if (role === 'employee') {
            const myId = user?.employeeId || user?.id;
            setAllocations(myId ? res.data.filter((alc) => alc.employeeId === myId) : res.data);
          } else {
            setAllocations(res.data);
          }
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve leave allocations.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure loading leave allocations.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [role, user]);

  return (
    <div>
      <ActionRibbon
        title={role === 'employee' ? 'My Leave Allocations' : 'Time Off Allocations'}
        subtitle={
          role === 'employee'
            ? 'Your active leave quotas, days taken, and remaining balance availability'
            : 'Manage employee leave quotas, valid availability periods, and remaining balances'
        }
        leftActions={
          role !== 'employee' ? (
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
              New Allocation Request
            </Button>
          ) : undefined
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading leave allocations..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Leave Allocations"
            description={error}
            onRetry={loadData}
          />
        ) : allocations.length === 0 ? (
          <StateContainer
            type="empty"
            title="No Allocations Available"
            description={role === 'employee' ? 'You have no leave quota allocations assigned.' : 'No employee leave quotas are configured in the system.'}
          />
        ) : (
          <div className="erp-table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Policy</th>
                  <th>Total Quota</th>
                  <th>Days Taken</th>
                  <th>Remaining Balance</th>
                  <th>Validity Period</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alc) => {
                  const pctRemaining = Math.round((alc.remainingDays / alc.totalDays) * 100);

                  return (
                    <tr key={alc.id}>
                      <td style={{ fontWeight: 600 }}>{alc.employeeName}</td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{alc.timeOffTypeName}</span>
                      </td>
                      <td>{alc.totalDays} Days</td>
                      <td style={{ color: 'var(--color-warning-text)' }}>
                        {alc.takenDays} Days
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ color: 'var(--color-success-text)', fontSize: '0.9375rem' }}>
                            {alc.remainingDays} Days
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ({pctRemaining}% left)
                          </span>
                        </div>
                      </td>
                      <td>
                        {formatDate(alc.validityStart)} – {formatDate(alc.validityEnd)}
                      </td>
                      <td>
                        <Badge status={alc.status} />
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
