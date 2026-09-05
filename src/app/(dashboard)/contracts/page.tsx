'use client';

import React, { useEffect, useState } from 'react';
import { employeeService } from '@/services/employee.service';
import { Contract } from '@/types/employee.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Plus, Search, CheckCircle2 } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getRoleCapabilities } from '@/lib/permissions';

export default function ContractsPage() {
  const router = useRouter();
  const { role } = useAuth();
  const caps = role ? getRoleCapabilities(role) : null;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeeService.getContracts();
      if (res.success && res.data) {
        setContracts(res.data);
      } else {
        setError(res.error || 'Failed to retrieve contracts from backend.');
      }
    } catch {
      setError('Network communication failure loading contracts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    employeeService
      .getContracts()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setContracts(res.data);
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve contracts from backend.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure loading contracts.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!caps || !caps.canManageContracts) {
    return (
      <div>
        <ActionRibbon title="Employee Contracts" subtitle="Employment terms & wage agreements" />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="unauthorized"
            title="Contracts Administration Restricted"
            description="Employee accounts are restricted from managing organizational employment contracts."
            actionText="Go to My Workspace"
            onAction={() => router.push('/dashboard')}
          />
        </div>
      </div>
    );
  }

  const filteredContracts = contracts.filter((c) => {
    const matchesSearch =
      c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      c.contractReference.toLowerCase().includes(search.toLowerCase()) ||
      c.salaryStructureName.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <ActionRibbon
        title="Employee Contracts"
        subtitle="Manage employment terms, salary structures, and historical wage changes"
        leftActions={
          <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
            New Contract
          </Button>
        }
        rightActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                placeholder="Search contracts..."
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

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.8125rem',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="running">Running (Active)</option>
              <option value="expired">Expired (Historical)</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading contracts records..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Contracts"
            description={error}
            onRetry={loadData}
          />
        ) : filteredContracts.length === 0 ? (
          <StateContainer type="empty" title="No contracts found" />
        ) : (
          <div className="erp-table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Reference</th>
                  <th>Employee</th>
                  <th>Department & Role</th>
                  <th>Salary Structure</th>
                  <th style={{ textAlign: 'right' }}>Wage</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((cnt) => {
                  const isActive = cnt.status === 'running';

                  return (
                    <tr
                      key={cnt.id}
                      style={{
                        backgroundColor: isActive ? '#f8fafc' : 'transparent',
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {cnt.contractReference}
                          </code>
                          {isActive && (
                            <span title="Period-applicable active contract">
                              <CheckCircle2 size={13} color="var(--color-success)" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{cnt.employeeName}</td>
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>{cnt.jobPosition}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cnt.department}</div>
                      </td>
                      <td style={{ color: 'var(--color-primary)' }}>{cnt.salaryStructureName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrency(cnt.wage)} / {cnt.wageType === 'monthly' ? 'mo' : 'hr'}
                      </td>
                      <td>{formatDate(cnt.startDate)}</td>
                      <td>
                        {cnt.endDate ? (
                          formatDate(cnt.endDate)
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Indefinite</span>
                        )}
                      </td>
                      <td>
                        <Badge status={cnt.status}>
                          {isActive ? 'Active (Running)' : cnt.status}
                        </Badge>
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
