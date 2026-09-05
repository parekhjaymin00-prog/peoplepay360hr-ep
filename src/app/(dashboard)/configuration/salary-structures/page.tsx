'use client';

import React, { useEffect, useState } from 'react';
import { payrollService } from '@/services/payroll.service';
import { SalaryStructure, SalaryRule } from '@/types/payroll.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { Plus } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function SalaryStructuresPage() {
  const router = useRouter();
  const { role } = useAuth();
  const caps = getRoleCapabilities(role);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<SalaryStructure | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [strRes, rulRes] = await Promise.all([
        payrollService.getSalaryStructures(),
        payrollService.getSalaryRules(),
      ]);

      if (strRes.success && strRes.data) {
        setStructures(strRes.data);
        if (strRes.data.length > 0) {
          setSelectedStructure(strRes.data[0]);
        }
      } else {
        setError(strRes.error || 'Failed to retrieve salary structures from backend.');
      }
      if (rulRes.success && rulRes.data) {
        setRules(rulRes.data);
      }
    } catch {
      setError('Network communication failure loading salary structures.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      payrollService.getSalaryStructures(),
      payrollService.getSalaryRules(),
    ])
      .then(([strRes, rulRes]) => {
        if (!isMounted) return;
        if (strRes.success && strRes.data) {
          setStructures(strRes.data);
          if (strRes.data.length > 0) {
            setSelectedStructure(strRes.data[0]);
          }
          setError(null);
        } else {
          setError(strRes.error || 'Failed to retrieve salary structures from backend.');
        }
        if (rulRes.success && rulRes.data) {
          setRules(rulRes.data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure loading salary structures.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Employees and HR Managers cannot access salary structures
  if (!caps.canAccessPayroll) {
    return (
      <div>
        <ActionRibbon title="Salary Structures Setup" subtitle="Salary calculation rule collections" />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="unauthorized"
            title="Salary Configuration Restricted"
            description="Your authenticated role does not have authorization to view or configure salary structures."
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
        title="Salary Structures Setup"
        subtitle="Manage collections of salary calculation rules and execution sequences for Payrun computation"
        leftActions={
          <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
            New Salary Structure
          </Button>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading salary structures..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Salary Structures"
            description={error}
            onRetry={loadData}
          />
        ) : structures.length === 0 ? (
          <StateContainer
            type="empty"
            title="No Salary Structures Found"
            description="No salary calculation structures have been defined in the system."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Left list of structures */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Structures ({structures.length})
              </h3>

              {structures.map((str) => {
                const isSelected = selectedStructure?.id === str.id;

                return (
                  <Card
                    key={str.id}
                    padding="sm"
                    onClick={() => setSelectedStructure(str)}
                    style={{
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                      backgroundColor: isSelected ? '#fafbff' : '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {str.name}
                      </span>
                      <Badge status={str.active ? 'active' : 'inactive'} size="sm" />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <code>{str.code}</code>
                      <span>{str.rulesCount} Rules • {str.assignedEmployeesCount} Staff</span>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Right: Structure Detail & Ordered Rules */}
            <div>
              {selectedStructure && (
                <Card padding="md">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {selectedStructure.name}
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Code: <code>{selectedStructure.code}</code> • Applied in Payruns to calculate employee payslips
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button variant="outline" size="sm">Add Rule to Structure</Button>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Execution Sequence of Rules in this Structure
                  </h4>

                  <div className="erp-table-wrapper">
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px' }}>Seq</th>
                          <th>Rule Code</th>
                          <th>Rule Name</th>
                          <th>Category</th>
                          <th>Computation Expression</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map((rule) => (
                          <tr key={rule.id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rule.sequence}</td>
                            <td><code>{rule.code}</code></td>
                            <td style={{ fontWeight: 600 }}>{rule.name}</td>
                            <td>
                              <Badge status={rule.category}>{rule.category}</Badge>
                            </td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                              <code>{rule.formulaDescription || `${rule.amountOrPercentage}%`}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
