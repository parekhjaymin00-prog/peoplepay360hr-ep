'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { payrollService } from '@/services/payroll.service';
import { Payrun } from '@/types/payroll.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { PayrunWizardModal } from '@/components/features/PayrunWizardModal';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Plus, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function PayrunsPage() {
  const router = useRouter();
  const { role } = useAuth();
  const caps = getRoleCapabilities(role);
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollService.getPayruns();
      if (res.success && res.data) {
        setPayruns(res.data);
      } else {
        setError(res.error || 'Failed to retrieve payruns from the server.');
      }
    } catch {
      setError('Network connection failure retrieving payruns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    payrollService
      .getPayruns()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setPayruns(res.data);
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve payruns from the server.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network connection failure retrieving payruns.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Check if role has payroll access
  if (!caps.canAccessPayroll) {
    return (
      <div>
        <ActionRibbon title="Payroll Batches (Payruns)" subtitle="Batch payroll execution & processing" />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="unauthorized"
            title="Payroll Administration Restricted"
            description="Your current role does not have authorization to view or execute Payrun batches. HR Managers and Employees are restricted from payroll processing."
            actionText="Return to Dashboard"
            onAction={() => router.push('/dashboard')}
          />
        </div>
      </div>
    );
  }

  const handleWizardComplete = async (batchData: {
    name: string;
    periodStart: string;
    periodEnd: string;
    structureId: string;
    selectedEmployeeIds: string[];
  }) => {
    try {
      const res = await payrollService.createPayrun({
        name: batchData.name,
        periodStart: batchData.periodStart,
        periodEnd: batchData.periodEnd,
        salaryStructureId: batchData.structureId,
      });

      if (res.success && res.data) {
        setWizardOpen(false);
        router.push(`/payroll/payruns/${res.data.id}`);
      } else {
        alert(res.error || 'Failed to create payrun batch on backend.');
      }
    } catch {
      alert('Network failure attempting to create payrun batch.');
    }
  };

  return (
    <div>
      <ActionRibbon
        title="Payroll Batches (Payruns)"
        subtitle="Manage batch payroll execution, rule computation, validation, and disbursements"
        leftActions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
            onClick={() => setWizardOpen(true)}
          >
            New Payrun
          </Button>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading payroll batches..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Payruns"
            description={error}
            onRetry={loadData}
          />
        ) : payruns.length === 0 ? (
          <StateContainer
            type="empty"
            title="No Payroll Batches Found"
            description="There are no payrun batches created yet. Click 'New Payrun' to initiate your first payroll execution batch."
            actionText="Create New Payrun"
            onAction={() => setWizardOpen(true)}
          />
        ) : (
          <div className="erp-table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Batch Name</th>
                  <th>Period</th>
                  <th>Salary Structure</th>
                  <th>Payslips</th>
                  <th style={{ textAlign: 'right' }}>Total Net Paid</th>
                  <th>Warnings</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payruns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link
                        href={`/payroll/payruns/${run.id}`}
                        style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {run.name}
                      </Link>
                    </td>
                    <td>
                      {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
                    </td>
                    <td>{run.salaryStructureName}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{run.payslipsCount}</span> Employees
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {run.totalNet > 0 ? formatCurrency(run.totalNet) : '—'}
                    </td>
                    <td>
                      {run.warnings && run.warnings.length > 0 ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color: 'var(--color-warning-text)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          <AlertTriangle size={13} color="var(--color-warning)" />
                          {run.warnings.length} Warning(s)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-success-text)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={13} color="var(--color-success)" />
                          Clean
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge status={run.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/payroll/payruns/${run.id}`} style={{ textDecoration: 'none' }}>
                        <Button variant="outline" size="sm" rightIcon={<ArrowRight size={13} />}>
                          Open Processing
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


      {/* Payrun 2-Step Wizard Modal */}
      <PayrunWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
