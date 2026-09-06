'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import { attendanceService } from '@/services/attendance.service';
import { apiClient } from '@/services/api.client';
import { WorkingSchedule } from '@/types/attendance.types';

export default function NewEmployeePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [jobPosition, setJobPosition] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchedules() {
      const res = await attendanceService.getWorkingSchedules();
      if (res.success && res.data && res.data.length > 0) {
        setSchedules(res.data);
        setScheduleId(res.data[0].id);
      }
    }
    loadSchedules();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post('/api/employees', {
        name,
        workEmail: email,
        phone,
        department,
        jobPosition,
        scheduleId,
        bankName,
        accountNumber,
      });

      if (res.success) {
        router.push('/employees');
      } else {
        setError(res.error || 'Failed to create employee record on backend.');
      }
    } catch {
      setError('Network failure while saving employee.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <ActionRibbon
        title="Create New Employee"
        subtitle="Capture identity, work assignment, schedule, and payroll details"
        leftActions={
          <Link href="/employees" style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={15} />}>
              Back to Directory
            </Button>
          </Link>
        }
      />

      <div style={{ marginTop: '1.25rem', maxWidth: '800px' }}>
        <form onSubmit={handleSubmit}>
          <Card padding="lg">
            {error && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-danger-light)',
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger-text)',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Employee Master Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <Input
                label="Full Name"
                placeholder="e.g. Rachel Adams"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Job Position"
                placeholder="e.g. Frontend Architect"
                value={jobPosition}
                onChange={(e) => setJobPosition(e.target.value)}
                required
              />
              <Input
                label="Work Email"
                type="email"
                placeholder="rachel.adams@peoplepay360.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Work Phone"
                placeholder="+1 (555) 019-2834"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Select
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={[
                  { value: 'Engineering', label: 'Engineering' },
                  { value: 'Product & Design', label: 'Product & Design' },
                  { value: 'Executive', label: 'Executive' },
                  { value: 'Finance & Payroll', label: 'Finance & Payroll' },
                  { value: 'Sales & Ops', label: 'Sales & Ops' },
                ]}
              />
              <Select
                label="Assigned Working Schedule"
                value={scheduleId}
                onChange={(e) => setScheduleId(e.target.value)}
                options={schedules.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.totalWeeklyHours}h)`,
                }))}
              />
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Bank Account (For Direct Deposit)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <Input
                label="Bank Name"
                placeholder="e.g. Chase Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <Input
                label="Account Number"
                placeholder="e.g. 1048291039"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button type="button" variant="ghost" onClick={() => router.push('/employees')} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" leftIcon={<Save size={16} />} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Employee Record'}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}
