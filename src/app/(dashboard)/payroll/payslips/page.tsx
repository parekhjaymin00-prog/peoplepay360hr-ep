'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { payrollService } from '@/services/payroll.service';
import { Payslip } from '@/types/payroll.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Search, Eye } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

export default function PayslipsListPage() {
  const { user, role } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollService.getPayslips();
      if (res.success && res.data) {
        if (role === 'EMPLOYEE') {
          const myId = user?.employee?.id;
          setPayslips(myId ? res.data.filter((s) => s.employeeId === myId) : res.data);
        } else {
          setPayslips(res.data);
        }
      } else {
        setError(res.error || 'Failed to retrieve payslips from backend.');
      }
    } catch {
      setError('Network communication failure loading payslips.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    payrollService
      .getPayslips()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          if (role === 'EMPLOYEE') {
            const myId = user?.employee?.id;
            setPayslips(myId ? res.data.filter((s) => s.employeeId === myId) : res.data);
          } else {
            setPayslips(res.data);
          }
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve payslips from backend.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure loading payslips.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [role, user]);

  const filteredSlips = payslips.filter((s) => {
    return (
      s.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      s.payrunName.toLowerCase().includes(search.toLowerCase()) ||
      s.contractReference.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div>
      <ActionRibbon
        title={role === 'EMPLOYEE' ? 'My Payslips' : 'Employee Payslips Directory'}
        subtitle={
          role === 'EMPLOYEE'
            ? 'Your personal salary computation sheets and historical payslip records'
            : 'Individual salary computation sheets and historical payslips archive'
        }
        rightActions={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.25rem 0.65rem',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search payslips..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '0.8125rem',
                backgroundColor: 'transparent',
                width: '160px',
              }}
            />
          </div>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading payslips archive..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Payslips"
            description={error}
            onRetry={loadData}
          />
        ) : filteredSlips.length === 0 ? (
          <StateContainer
            type="empty"
            title={search ? 'No Matching Payslips' : 'No Payslips Available'}
            description={search ? 'No payslips matched your filter query.' : 'There are currently no payslip records recorded in the system.'}
          />
        ) : (
          <div className="erp-table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Parent Payrun</th>
                  <th>Contract</th>
                  <th>Period</th>
                  <th>Worked Days</th>
                  <th style={{ textAlign: 'right' }}>Gross</th>
                  <th style={{ textAlign: 'right' }}>Net Salary</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlips.map((slip) => (
                  <tr key={slip.id}>
                    <td>
                      <Link
                        href={`/payroll/payslips/${slip.id}`}
                        style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {slip.employeeName}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{slip.jobPosition}</div>
                    </td>
                    <td>{slip.payrunName}</td>
                    <td><code>{slip.contractReference}</code></td>
                    <td>{formatDate(slip.periodStart)} – {formatDate(slip.periodEnd)}</td>
                    <td>{slip.workedDays} Days</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(slip.grossSalary)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {formatCurrency(slip.netSalary)}
                    </td>
                    <td>
                      <Badge status={slip.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/payroll/payslips/${slip.id}`} style={{ textDecoration: 'none' }}>
                        <Button variant="outline" size="sm" leftIcon={<Eye size={13} />}>
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
