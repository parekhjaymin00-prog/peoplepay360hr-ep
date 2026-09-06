'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { employeeService } from '@/services/employee.service';
import { payrollService } from '@/services/payroll.service';
import { Employee } from '@/types/employee.types';
import { SalaryStructure } from '@/types/payroll.types';
import { Check, ChevronRight, Users, Settings } from 'lucide-react';

export interface PayrunWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (batchData: { name: string; periodStart: string; periodEnd: string; structureId: string; selectedEmployeeIds: string[] }) => void;
}

export const PayrunWizardModal: React.FC<PayrunWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 State: Scope & Period
  const [batchName, setBatchName] = useState('April 2026 Regular Batch');
  const [periodStart, setPeriodStart] = useState('2026-04-01');
  const [periodEnd, setPeriodEnd] = useState('2026-04-30');
  const [structureId, setStructureId] = useState('');
  const [structures, setStructures] = useState<SalaryStructure[]>([]);

  // Step 2 State: Explicit Employee Selection
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [filterDepartment, setFilterDepartment] = useState('all');

  useEffect(() => {
    async function loadData() {
      const [strRes, empRes] = await Promise.all([
        payrollService.getSalaryStructures(),
        employeeService.getEmployees(),
      ]);

      if (strRes.success && strRes.data && strRes.data.length > 0) {
        setStructures(strRes.data);
        setStructureId(strRes.data[0].id);
      }
      if (empRes.success && empRes.data) {
        setEmployees(empRes.data);
        setSelectedEmployeeIds(empRes.data.map((e) => e.id));
      }
    }
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const toggleEmployee = (id: string) => {
    if (selectedEmployeeIds.includes(id)) {
      setSelectedEmployeeIds(selectedEmployeeIds.filter((item) => item !== id));
    } else {
      setSelectedEmployeeIds([...selectedEmployeeIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((e) => e.id));
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (filterDepartment === 'all') return true;
    return emp.department.toLowerCase() === filterDepartment.toLowerCase();
  });

  const handleFinish = () => {
    onComplete({
      name: batchName,
      periodStart,
      periodEnd,
      structureId,
      selectedEmployeeIds,
    });
    setStep(1);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Payrun Batch Setup Wizard"
      subtitle={
        step === 1
          ? 'Step 1 of 2: Define payroll scope, period, and salary structure'
          : `Step 2 of 2: Select eligible staff (${selectedEmployeeIds.length} of ${filteredEmployees.length} selected)`
      }
      maxWidth="680px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div>
            {step === 2 && (
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                Back to Scope
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {step === 1 ? (
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ChevronRight size={16} />}
                onClick={() => setStep(2)}
              >
                Continue to Employee Selection
              </Button>
            ) : (
              <Button
                variant="success"
                size="sm"
                leftIcon={<Check size={16} />}
                disabled={selectedEmployeeIds.length === 0}
                onClick={handleFinish}
              >
                Initialize Batch ({selectedEmployeeIds.length} Staff)
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Stepper indicator */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: step === 1 ? 'var(--color-primary-light)' : '#f1f5f9',
            border: `1px solid ${step === 1 ? 'var(--color-primary-border)' : 'var(--border-color)'}`,
            color: step === 1 ? 'var(--color-primary)' : 'var(--text-muted)',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          <Settings size={16} />
          <span>1. Payroll Scope & Dates</span>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: step === 2 ? 'var(--color-primary-light)' : '#f1f5f9',
            border: `1px solid ${step === 2 ? 'var(--color-primary-border)' : 'var(--border-color)'}`,
            color: step === 2 ? 'var(--color-primary)' : 'var(--text-muted)',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          <Users size={16} />
          <span>2. Employee Selection</span>
        </div>
      </div>

      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Payrun Batch Name"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g. April 2026 Regular Batch"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Input
              type="date"
              label="Payroll Period Start"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <Input
              type="date"
              label="Payroll Period End"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>

          <Select
            label="Salary Structure to Apply"
            value={structureId}
            onChange={(e) => setStructureId(e.target.value)}
            options={structures.map((str) => ({
              value: str.id,
              label: `${str.name} (${str.rulesCount} Rules)`,
            }))}
          />

          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
            }}
          >
            <strong>Note:</strong> Clicking continue moves forward to explicitly select eligible staff members without creating the batch in the database yet.
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedEmployeeIds.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
              </Button>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {selectedEmployeeIds.length} employees will be included
              </span>
            </div>

            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              style={{
                fontSize: '0.8125rem',
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <option value="all">All Departments</option>
              <option value="engineering">Engineering</option>
              <option value="product & design">Product & Design</option>
              <option value="executive">Executive</option>
              <option value="finance & payroll">Finance & Payroll</option>
            </select>
          </div>

          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {filteredEmployees.map((emp) => {
              const isChecked = selectedEmployeeIds.includes(emp.id);
              const hasBank = !!emp.bankDetails?.accountNumber;
              return (
                <div
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 1rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: isChecked ? '#fafbff' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {emp.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {emp.employeeCode} • {emp.jobPosition} ({emp.department})
                      </div>
                    </div>
                  </div>

                  <div>
                    {!hasBank && (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--color-warning-text)', backgroundColor: 'var(--color-warning-light)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                        No Bank Info
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
};
