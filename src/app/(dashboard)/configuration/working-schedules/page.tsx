'use client';

import React, { useEffect, useState } from 'react';
import { attendanceService } from '@/services/attendance.service';
import { WorkingSchedule } from '@/types/attendance.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { WorkingSchedulePatternEditor } from '@/components/features/WorkingSchedulePatternEditor';
import { formatHours } from '@/lib/formatters';
import { Plus } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function WorkingSchedulesPage() {
  const router = useRouter();
  const { role } = useAuth();
  const caps = role ? getRoleCapabilities(role) : null;
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<WorkingSchedule | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceService.getWorkingSchedules();
      if (res.success && res.data) {
        setSchedules(res.data);
        if (res.data.length > 0) {
          setSelectedSchedule(res.data[0]);
        }
      } else {
        setError(res.error || 'Failed to retrieve working schedules from backend.');
      }
    } catch {
      setError('Network communication failure loading working schedules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    attendanceService
      .getWorkingSchedules()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setSchedules(res.data);
          if (res.data.length > 0) {
            setSelectedSchedule(res.data[0]);
          }
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve working schedules from backend.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure loading working schedules.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!caps || !caps.canManageSchedules) {
    return (
      <div>
        <ActionRibbon title="Working Schedules Setup" subtitle="Weekly shift patterns & hours" />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="unauthorized"
            title="Schedule Configuration Restricted"
            description="Employees cannot modify organizational shift expectations."
            actionText="Go to My Workspace"
            onAction={() => router.push('/dashboard')}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ActionRibbon
        title="Working Schedules Setup"
        subtitle="Define weekly shift patterns and automatic hours calculation for attendance expectations"
        leftActions={
          <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
            New Schedule
          </Button>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading working schedules..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Schedules"
            description={error}
            onRetry={loadData}
          />
        ) : schedules.length === 0 ? (
          <StateContainer
            type="empty"
            title="No Working Schedules Found"
            description="No working schedules have been configured yet."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Left list of schedules */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Configured Schedules ({schedules.length})
              </h3>

              {schedules.map((sch) => {
                const isSelected = selectedSchedule?.id === sch.id;

                return (
                  <Card
                    key={sch.id}
                    padding="sm"
                    onClick={() => setSelectedSchedule(sch)}
                    style={{
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                      backgroundColor: isSelected ? '#fafbff' : '#ffffff',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {sch.name}
                      </span>
                      <code style={{ fontSize: '0.6875rem', padding: '0.1rem 0.35rem', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
                        {sch.code}
                      </code>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>{sch.assignedEmployeesCount} Staff Assigned</span>
                      <strong style={{ color: 'var(--color-primary)' }}>{formatHours(sch.totalWeeklyHours)} / wk</strong>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Right Editor for Weekly Pattern */}
            <div>
              {selectedSchedule && (
                <WorkingSchedulePatternEditor
                  key={selectedSchedule.id}
                  initialPatterns={selectedSchedule.patterns}
                  onChange={(patterns, total) => {
                    setSchedules(
                      schedules.map((s) =>
                        s.id === selectedSchedule.id
                          ? { ...s, patterns, totalWeeklyHours: total }
                          : s
                      )
                    );
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
