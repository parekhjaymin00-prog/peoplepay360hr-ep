'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { payrollService } from '@/services/payroll.service';
import { Payrun, Payslip } from '@/types/payroll.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  ArrowLeft,
  Calculator,
  CheckCircle,
  CreditCard,
  Send,
  AlertTriangle,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function PayrunProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const caps = getRoleCapabilities(role);
  const payrunId = params?.id as string;

  const [payrun, setPayrun] = useState<Payrun | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadPayrun = async () => {
    setLoading(true);
    setError(null);
    try {
      const [runRes, slipsRes] = await Promise.all([
        payrollService.getPayrunById(payrunId),
        payrollService.getPayslips(payrunId),
      ]);

      if (runRes.success && runRes.data) {
        setPayrun(runRes.data);
      } else {
        setError(runRes.error || `Failed to fetch payrun batch #${payrunId} from backend.`);
      }

      if (slipsRes.success && slipsRes.data) {
        setPayslips(slipsRes.data);
      }
    } catch {
      setError('Network failure connecting to payroll API service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!payrunId) return;

    Promise.all([
      payrollService.getPayrunById(payrunId),
      payrollService.getPayslips(payrunId),
    ])
      .then(([runRes, slipsRes]) => {
        if (!isMounted) return;
        if (runRes.success && runRes.data) {
          setPayrun(runRes.data);
          setError(null);
        } else {
          setError(runRes.error || `Failed to fetch payrun batch #${payrunId} from backend.`);
        }

        if (slipsRes.success && slipsRes.data) {
          setPayslips(slipsRes.data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network failure connecting to payroll API service.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [payrunId]);

  if (!caps.canAccessPayroll) {
    return (
      <div>
        <ActionRibbon title="Payrun Processing" subtitle="Payroll calculation & validation" />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="unauthorized"
            title="Payroll Processing Restricted"
            description="Your current role does not have authorization to view or execute Payrun batches. HR Managers and Employees are restricted from payroll processing."
            actionText="Return to Dashboard"
            onAction={() => router.push('/dashboard')}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return <StateContainer type="loading" description="Loading payrun processing batch..." />;
  }

  if (error || !payrun) {
    return (
      <div>
        <ActionRibbon
          title="Payrun Batch Error"
          leftActions={
            <Link href="/payroll/payruns" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={15} />}>
                All Payruns
              </Button>
            </Link>
          }
        />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="error"
            title="Unable to Load Payrun Batch"
            description={error || 'The requested payrun batch could not be retrieved from the backend service.'}
            onRetry={loadPayrun}
          />
        </div>
      </div>
    );
  }

  // Real Backend Processing Action Handlers
  const handleCompute = async () => {
    setActionInProgress('compute');
    setActionNotice(null);
    try {
      const res = await payrollService.computePayrun(payrunId);
      if (res.success && res.data) {
        setPayrun(res.data);
        setActionNotice({ type: 'success', message: 'Payrun successfully computed against active contracts and schedules.' });
        await loadPayrun();
      } else {
        setActionNotice({ type: 'error', message: res.error || 'Failed to compute payrun on backend.' });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network communication error during computation.' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleValidate = async () => {
    setActionInProgress('validate');
    setActionNotice(null);
    try {
      const res = await payrollService.validatePayrun(payrunId);
      if (res.success && res.data) {
        setPayrun(res.data);
        setActionNotice({ type: 'success', message: 'Payrun successfully validated and locked.' });
        await loadPayrun();
      } else {
        setActionNotice({ type: 'error', message: res.error || 'Failed to validate payrun.' });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network communication error during validation.' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMarkPaid = async () => {
    setActionInProgress('paid');
    setActionNotice(null);
    try {
      const res = await payrollService.markPaidPayrun(payrunId);
      if (res.success && res.data) {
        setPayrun(res.data);
        setActionNotice({ type: 'success', message: 'Payrun batch marked as paid.' });
        await loadPayrun();
      } else {
        setActionNotice({ type: 'error', message: res.error || 'Failed to mark payrun as paid.' });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network communication error during disbursement update.' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSendPayslips = async () => {
    setActionInProgress('email');
    setActionNotice(null);
    try {
      const res = await payrollService.emailPayslips(payrunId);
      if (res.success) {
        setActionNotice({ type: 'success', message: `Delivered payslips successfully to employees.` });
      } else {
        setActionNotice({ type: 'error', message: res.error || 'Failed to trigger payslip emails.' });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error sending payslip emails.' });
    } finally {
      setActionInProgress(null);
    }
  };


  return (
    <div>
      <ActionRibbon
        title={payrun.name}
        subtitle={`${formatDate(payrun.periodStart)} – ${formatDate(payrun.periodEnd)} • ${payrun.salaryStructureName}`}
        statusBadge={<Badge status={payrun.status} />}
        leftActions={
          <Link href="/payroll/payruns" style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={15} />}>
              All Payruns
            </Button>
          </Link>
        }
        rightActions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {payrun.status === 'draft' && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Calculator size={15} />}
                onClick={handleCompute}
                disabled={Boolean(actionInProgress)}
              >
                {actionInProgress === 'compute' ? 'Computing...' : 'Compute Payslips'}
              </Button>
            )}

            {payrun.status === 'computed' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Calculator size={15} />}
                  onClick={handleCompute}
                  disabled={Boolean(actionInProgress)}
                >
                  {actionInProgress === 'compute' ? 'Computing...' : 'Recompute'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle size={15} />}
                  onClick={handleValidate}
                  disabled={Boolean(actionInProgress)}
                >
                  {actionInProgress === 'validate' ? 'Validating...' : 'Validate Batch'}
                </Button>
              </>
            )}

            {payrun.status === 'validated' && (
              <Button
                variant="success"
                size="sm"
                leftIcon={<CreditCard size={15} />}
                onClick={handleMarkPaid}
                disabled={Boolean(actionInProgress)}
              >
                {actionInProgress === 'paid' ? 'Processing...' : 'Mark as Paid'}
              </Button>
            )}

            {(payrun.status === 'validated' || payrun.status === 'paid') && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Send size={15} />}
                onClick={handleSendPayslips}
                disabled={Boolean(actionInProgress)}
              >
                {actionInProgress === 'email' ? 'Sending...' : 'Send Payslips (Email)'}
              </Button>
            )}
          </div>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {/* Action Notice Toast */}
        {actionNotice && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: actionNotice.type === 'error' ? 'var(--color-danger-light)' : 'var(--color-primary-light)',
              border: `1px solid ${actionNotice.type === 'error' ? 'var(--color-danger-border)' : 'var(--color-primary-border)'}`,
              borderRadius: 'var(--radius-md)',
              color: actionNotice.type === 'error' ? 'var(--color-danger-text)' : 'var(--color-primary)',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{actionNotice.type === 'error' ? '⚠ ' : '✓ '}{actionNotice.message}</span>
            <button
              onClick={() => setActionNotice(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
            >
              ×
            </button>
          </div>
        )}

        {/* Pre-Finalization Warnings Box (Mandatory Requirement) */}
        {payrun.warnings && payrun.warnings.length > 0 && (
          <WarningBanner
            type="warning"
            title="Payroll Validation Warnings Surface"
            items={payrun.warnings}
          />
        )}

        {/* Batch Financial Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <Card padding="md">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Employees In Batch</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {payslips.length} Staff
            </div>
          </Card>

          <Card padding="md">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Gross Earnings</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(payrun.totalGross)}
            </div>
          </Card>

          <Card padding="md">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Deductions (Tax & PF)</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>
              -{formatCurrency(payrun.totalDeductions)}
            </div>
          </Card>

          <Card padding="md">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net Total Disbursed</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {formatCurrency(payrun.totalNet)}
            </div>
          </Card>
        </div>

        {/* Payslips Table */}
        <Card padding="none">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Generated Payslips for this Payrun
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Click any employee to inspect rule breakdowns or generate individual PDF
            </span>
          </div>

          <table className="erp-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Contract Ref</th>
                <th>Worked Days</th>
                <th style={{ textAlign: 'right' }}>Gross</th>
                <th style={{ textAlign: 'right' }}>Deductions</th>
                <th style={{ textAlign: 'right' }}>Net Salary</th>
                <th>Warnings</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((slip) => (
                <tr key={slip.id}>
                  <td>
                    <Link
                      href={`/payroll/payslips/${slip.id}`}
                      style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
                    >
                      {slip.employeeName}
                    </Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {slip.jobPosition} ({slip.department})
                    </div>
                  </td>
                  <td>
                    <code>{slip.contractReference}</code>
                  </td>
                  <td>{slip.workedDays} days ({slip.workedHours}h)</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {formatCurrency(slip.grossSalary)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>
                    -{formatCurrency(slip.totalDeductions)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {formatCurrency(slip.netSalary)}
                  </td>
                  <td>
                    {slip.warnings && slip.warnings.length > 0 ? (
                      <span
                        title={slip.warnings[0]}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          color: 'var(--color-warning-text)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        <AlertTriangle size={13} color="var(--color-warning)" />
                        Bank Warning
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    <Badge status={slip.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/payroll/payslips/${slip.id}`} style={{ textDecoration: 'none' }}>
                      <Button variant="outline" size="sm">
                        View Payslip
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
