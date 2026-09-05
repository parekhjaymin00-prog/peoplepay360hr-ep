'use client';

import React, { useEffect, useState } from 'react';
import { payrollService } from '@/services/payroll.service';
import { SalaryRule } from '@/types/payroll.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { Plus } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function SalaryRulesPage() {
  const router = useRouter();
  const { role } = useAuth();
  const caps = getRoleCapabilities(role);
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollService.getSalaryRules();
      if (res.success && res.data) {
        setRules(res.data);
      } else {
        setError(res.error || 'Failed to retrieve salary rules from backend.');
      }
    } catch {
      setError('Network communication failure loading salary rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    payrollService
      .getSalaryRules()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setRules(res.data);
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve salary rules from backend.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure loading salary rules.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Employees and HR Managers cannot access salary rules
  if (!caps.canAccessPayroll) {
    return (
      <div>
        <ActionRibbon title="Salary Rules Setup" subtitle="Salary calculation rules & formulas" />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="unauthorized"
            title="Salary Rules Restricted"
            description="Your authenticated role does not have authorization to view or configure salary rules."
            actionText="Return to Dashboard"
            onAction={() => router.push('/dashboard')}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ActionRibbon
        title="Salary Rules Setup"
        subtitle={
          caps.canModifySalaryConfig
            ? 'Define computation formulas, percentages, sequences, and earnings/deductions categories'
            : 'Read-only view for HR Payroll User. Full configuration requires HR Payroll Manager.'
        }
        statusBadge={
          !caps.canModifySalaryConfig ? (
            <span style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>
              Read Only
            </span>
          ) : undefined
        }
        leftActions={
          caps.canModifySalaryConfig ? (
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
              New Salary Rule
            </Button>
          ) : undefined
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading salary rules..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Salary Rules"
            description={error}
            onRetry={loadData}
          />
        ) : rules.length === 0 ? (
          <StateContainer
            type="empty"
            title="No Salary Rules Defined"
            description="No salary computation rules currently exist in the database."
          />
        ) : (
          <div className="erp-table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Sequence</th>
                  <th>Rule Code</th>
                  <th>Rule Name</th>
                  <th>Category</th>
                  <th>Computation Type</th>
                  <th>Formula / Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rule.sequence}</td>
                    <td>
                      <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{rule.code}</code>
                    </td>
                    <td style={{ fontWeight: 600 }}>{rule.name}</td>
                    <td>
                      <Badge status={rule.category}>{rule.category}</Badge>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{rule.computationType}</td>
                    <td>
                      <code
                        style={{
                          fontSize: '0.8125rem',
                          padding: '0.2rem 0.4rem',
                          backgroundColor: '#f8fafc',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {rule.formulaDescription || `${rule.amountOrPercentage}%`}
                      </code>
                    </td>
                    <td>
                      <Badge status={rule.active ? 'active' : 'inactive'} />
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
