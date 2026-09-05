'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { payrollService } from '@/services/payroll.service';
import { Payslip } from '@/types/payroll.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { StateContainer } from '@/components/ui/StateContainer';
import { PayslipBreakdownTable } from '@/components/features/PayslipBreakdownTable';
import { formatCurrency, formatDate, formatHours } from '@/lib/formatters';
import { ArrowLeft, Printer, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PayslipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const payslipId = params?.id as string;

  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [emailing, setEmailing] = useState(false);

  const loadPayslip = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollService.getPayslipById(payslipId);
      if (res.success && res.data) {
        setPayslip(res.data);
      } else {
        setError(res.error || `Payslip #${payslipId} could not be retrieved from the backend.`);
      }
    } catch {
      setError('Network failure communicating with payroll API service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!payslipId) return;

    payrollService
      .getPayslipById(payslipId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setPayslip(res.data);
          setError(null);
        } else {
          setError(res.error || `Payslip #${payslipId} could not be retrieved from the backend.`);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network failure communicating with payroll API service.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [payslipId]);

  if (loading) {
    return <StateContainer type="loading" description="Loading payslip computation sheet..." />;
  }

  if (error || !payslip) {
    return (
      <div>
        <ActionRibbon
          title="Payslip Details"
          leftActions={
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft size={15} />}
              onClick={() => router.back()}
            >
              Back
            </Button>
          }
        />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="error"
            title="Unable to Load Payslip"
            description={error || 'The requested payslip record is unavailable.'}
            onRetry={loadPayslip}
          />
        </div>
      </div>
    );
  }

  const handleDownloadPdf = () => {
    const pdfUrl = payrollService.getPayslipPdfUrl(payslipId);
    window.open(pdfUrl, '_blank');
  };

  const handleSendEmail = async () => {
    setEmailing(true);
    setActionNotice(null);
    try {
      const res = await payrollService.emailPayslip(payslipId);
      if (res.success) {
        setActionNotice({
          type: 'success',
          message: `Payslip PDF successfully sent to ${payslip.employeeName}.`,
        });
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Failed to dispatch payslip email.',
        });
      }
    } catch {
      setActionNotice({
        type: 'error',
        message: 'Network error sending payslip email.',
      });
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div>
      <ActionRibbon
        title={`Payslip: ${payslip.employeeName}`}
        subtitle={`${payslip.payrunName} • Period ${formatDate(payslip.periodStart)} – ${formatDate(payslip.periodEnd)}`}
        statusBadge={<Badge status={payslip.status} />}
        leftActions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft size={15} />}
            onClick={() => router.back()}
          >
            Back
          </Button>
        }
        rightActions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Printer size={15} />}
              onClick={handleDownloadPdf}
            >
              Download Payslip PDF
            </Button>
            {role !== 'employee' && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Send size={15} />}
                onClick={handleSendEmail}
                disabled={emailing}
              >
                {emailing ? 'Sending...' : 'Send PDF to Employee'}
              </Button>
            )}
          </div>
        }
      />

      <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {actionNotice && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: actionNotice.type === 'error' ? 'var(--color-danger-light)' : '#eff6ff',
              border: `1px solid ${actionNotice.type === 'error' ? 'var(--color-danger-border)' : '#bfdbfe'}`,
              color: actionNotice.type === 'error' ? 'var(--color-danger-text)' : '#1e40af',
              fontSize: '0.8125rem',
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
        {payslip.warnings && payslip.warnings.length > 0 && (
          <WarningBanner
            type="warning"
            title="Warning on this Payslip"
            items={payslip.warnings}
          />
        )}

        {/* Payslip Header Card */}
        <Card padding="md">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Employee Information
              </span>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {payslip.employeeName}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {payslip.jobPosition} ({payslip.department})
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Contract & Period
              </span>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>
                Contract: <code>{payslip.contractReference}</code>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {formatDate(payslip.periodStart)} – {formatDate(payslip.periodEnd)}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Worked Units
              </span>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {payslip.workedDays} Days
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Total: {formatHours(payslip.workedHours)} recorded
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Net Disbursed
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.1rem' }}>
                {formatCurrency(payslip.netSalary)}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-success-text)' }}>
                Basic: {formatCurrency(payslip.basicSalary)}
              </p>
            </div>
          </div>
        </Card>

        {/* Salary Rule Computation Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Salary Computation & Rule Breakdown
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Computed according to assigned Salary Structure rule sequence
            </span>
          </div>

          <PayslipBreakdownTable
            ruleLines={payslip.ruleLines}
            netSalary={payslip.netSalary}
            grossSalary={payslip.grossSalary}
            totalDeductions={payslip.totalDeductions}
          />
        </div>
      </div>
    </div>
  );
}
