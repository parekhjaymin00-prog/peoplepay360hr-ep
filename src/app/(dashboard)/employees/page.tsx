'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { employeeService } from '@/services/employee.service';
import { Employee } from '@/types/employee.types';
import { ViewMode } from '@/types/common.types';
import { ActionRibbon } from '@/components/layout/ActionRibbon';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateContainer } from '@/components/ui/StateContainer';
import { Search, Plus, Mail, Phone, ArrowRight } from 'lucide-react';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const { role } = useAuth();
  const router = useRouter();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeeService.getEmployees();
      if (res.success && res.data) {
        setEmployees(res.data);
      } else {
        setError(res.error || 'Failed to retrieve employee records from backend.');
      }
    } catch {
      setError('Network communication failure loading employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    employeeService
      .getEmployees()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setEmployees(res.data);
          setError(null);
        } else {
          setError(res.error || 'Failed to retrieve employee records from backend.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure loading employees.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Employee role does not have access to manage organization directory
  if (role === 'employee') {
    return (
      <div>
        <ActionRibbon title="Employees Directory" subtitle="Administrative employee master records" />
        <div style={{ marginTop: '1.5rem' }}>
          <StateContainer
            type="unauthorized"
            title="Administrative Directory Restricted"
            description="Employees do not have access to organizational employee administration. You can view your personal profile in My Workspace."
            actionText="Go to My Workspace"
            onAction={() => router.push('/dashboard')}
          />
        </div>
      </div>
    );
  }

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.jobPosition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept =
      departmentFilter === 'all' ||
      emp.department.toLowerCase() === departmentFilter.toLowerCase();

    return matchesSearch && matchesDept;
  });

  return (
    <div>
      <ActionRibbon
        title="Employee Directory"
        subtitle={`${filteredEmployees.length} staff records found`}
        leftActions={
          <Link href="/employees/new" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
              New Employee
            </Button>
          </Link>
        }
        rightActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Search Input */}
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
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  backgroundColor: 'transparent',
                  width: '160px',
                }}
              />
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.8125rem',
              }}
            >
              <option value="all">All Departments</option>
              <option value="engineering">Engineering</option>
              <option value="product & design">Product & Design</option>
              <option value="executive">Executive</option>
              <option value="finance & payroll">Finance & Payroll</option>
              <option value="sales & ops">Sales & Ops</option>
            </select>

            <ViewSwitcher currentMode={viewMode} onModeChange={setViewMode} />
          </div>
        }
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <StateContainer type="loading" description="Loading employee master records..." />
        ) : error ? (
          <StateContainer
            type="error"
            title="Failed to Load Employees"
            description={error}
            onRetry={loadData}
          />
        ) : filteredEmployees.length === 0 ? (
          <StateContainer
            type="empty"
            title="No employees found"
            description="Try changing your search terms or filter."
          />
        ) : viewMode === 'kanban' ? (
          /* Kanban Cards View */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {filteredEmployees.map((emp) => (
              <Link
                key={emp.id}
                href={`/employees/${emp.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Card
                  padding="md"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--color-primary-border)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div>
                    {/* Avatar & Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary-light)',
                            color: 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '1rem',
                          }}
                        >
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {emp.name}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {emp.employeeCode} • {emp.jobPosition}
                          </span>
                        </div>
                      </div>
                      <Badge status={emp.status} />
                    </div>

                    {/* Department & Info */}
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Mail size={13} color="var(--text-muted)" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.workEmail}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Phone size={13} color="var(--text-muted)" />
                        <span>{emp.workPhone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Smart Pill Summary Footer */}
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                      {emp.department}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
                      <span>Hub Details</span>
                      <ArrowRight size={13} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          /* Table List View */
          <div className="erp-table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Job Position</th>
                  <th>Work Email</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{emp.employeeCode}</code>
                    </td>
                    <td>
                      <Link
                        href={`/employees/${emp.id}`}
                        style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {emp.name}
                      </Link>
                    </td>
                    <td>{emp.department}</td>
                    <td>{emp.jobPosition}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{emp.workEmail}</td>
                    <td>
                      <Badge status={emp.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/employees/${emp.id}`} style={{ textDecoration: 'none' }}>
                        <Button variant="outline" size="sm">
                          Open Hub
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
