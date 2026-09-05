import { DepartmentService } from '../lib/services/department.service';
import { JobPositionService } from '../lib/services/job-position.service';
import { WorkingScheduleService } from '../lib/services/schedule.service';
import { EmployeeService } from '../lib/services/employee.service';
import { ContractService } from '../lib/services/contract.service';
import { generateUuidV7 } from '../lib/utils/id';
import { DayOfWeek, EmploymentType, EmployeeStatus, ContractStatus, WageType } from '@prisma/client';
import { ValidationError, BusinessRuleError } from '../lib/errors';
import prisma from '../lib/prisma';

async function runHrCoreTests() {
  console.log('🧪 Starting PeoplePay360 Employee & HR Core Domain Tests...\n');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (error: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${error.message || error}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Department Lifecycle & Self-Parent Rejection
  // --------------------------------------------------------------------------
  let testDeptId = '';
  await test('DepartmentService: create, list, and reject self-parent hierarchy', async () => {
    const dept = await DepartmentService.createDepartment({
      name: `Test Dept ${Date.now()}`,
      code: `TD-${Date.now().toString().slice(-4)}`,
    });
    testDeptId = dept.id;

    if (!dept.id || !dept.name) throw new Error('Failed to create department');

    // Reject self-parent
    try {
      await DepartmentService.updateDepartment(dept.id, {
        parentDepartmentId: dept.id,
      });
      throw new Error('Should have rejected self-parent relationship');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError)) throw e;
    }

    const list = await DepartmentService.listDepartments();
    if (list.length === 0) throw new Error('Department list empty');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Job Position Creation & Department Validation
  // --------------------------------------------------------------------------
  let testJobId = '';
  await test('JobPositionService: create and validate department relationship', async () => {
    const job = await JobPositionService.createJobPosition({
      title: `Software Test Lead ${Date.now()}`,
      code: `TL-${Date.now().toString().slice(-4)}`,
      departmentId: testDeptId,
    });
    testJobId = job.id;

    if (!job.id || job.departmentId !== testDeptId) throw new Error('Job position creation mismatch');

    // Non-existent department should fail
    try {
      await JobPositionService.createJobPosition({
        title: 'Ghost Position',
        code: `GP-${Date.now().toString().slice(-4)}`,
        departmentId: generateUuidV7(),
      });
      throw new Error('Should have rejected non-existent department ID');
    } catch (e: any) {
      if (e.statusCode !== 404) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Working Schedule Hours & Shift Validation
  // --------------------------------------------------------------------------
  let testScheduleId = '';
  await test('WorkingScheduleService: calculate total weekly hours and reject invalid shifts', async () => {
    const schedule = await WorkingScheduleService.createSchedule({
      name: `Test 35h Schedule ${Date.now()}`,
      code: `SCH-35H-${Date.now().toString().slice(-4)}`,
      days: [
        { dayOfWeek: DayOfWeek.MONDAY, startTime: '09:00', endTime: '17:00', breakMinutes: 60 }, // 7h
        { dayOfWeek: DayOfWeek.TUESDAY, startTime: '09:00', endTime: '17:00', breakMinutes: 60 }, // 7h
        { dayOfWeek: DayOfWeek.WEDNESDAY, startTime: '09:00', endTime: '17:00', breakMinutes: 60 }, // 7h
        { dayOfWeek: DayOfWeek.THURSDAY, startTime: '09:00', endTime: '17:00', breakMinutes: 60 }, // 7h
        { dayOfWeek: DayOfWeek.FRIDAY, startTime: '09:00', endTime: '17:00', breakMinutes: 60 }, // 7h
      ],
    });
    testScheduleId = schedule.id;

    if (Number(schedule.totalWeeklyHours) !== 35.0) {
      throw new Error(`Expected 35.00 hours, got ${schedule.totalWeeklyHours}`);
    }

    // Overnight shift rejection (endTime <= startTime)
    try {
      await WorkingScheduleService.createSchedule({
        name: 'Invalid Overnight Schedule',
        code: `SCH-OVER-${Date.now().toString().slice(-4)}`,
        days: [
          { dayOfWeek: DayOfWeek.MONDAY, startTime: '22:00', endTime: '06:00', breakMinutes: 60 },
        ],
      });
      throw new Error('Should have rejected overnight shift');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError)) throw e;
    }

    // Break duration >= shift duration rejection
    try {
      await WorkingScheduleService.createSchedule({
        name: 'Excessive Break Schedule',
        code: `SCH-BRK-${Date.now().toString().slice(-4)}`,
        days: [
          { dayOfWeek: DayOfWeek.MONDAY, startTime: '09:00', endTime: '10:00', breakMinutes: 90 },
        ],
      });
      throw new Error('Should have rejected break >= shift duration');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Employee Creation, Mismatch Validation, and Search
  // --------------------------------------------------------------------------
  let testEmployeeId = '';
  await test('EmployeeService: create employee, reject position-dept mismatch, search employees', async () => {
    const email = `test.employee.${Date.now()}@peoplepay360.com`;
    const employeeNumber = `EMP-TEST-${Date.now().toString().slice(-5)}`;

    const emp = await EmployeeService.createEmployee({
      employeeNumber,
      firstName: 'Alice',
      lastName: 'Wonderland',
      email,
      departmentId: testDeptId,
      jobPositionId: testJobId,
      workingScheduleId: testScheduleId,
      employmentType: EmploymentType.FULL_TIME,
      hireDate: '2026-01-01',
    });
    testEmployeeId = emp.id;

    if (!emp.id || emp.employeeNumber !== employeeNumber) {
      throw new Error('Employee creation failed');
    }

    // Duplicate email rejection
    try {
      await EmployeeService.createEmployee({
        employeeNumber: `EMP-DUP-${Date.now().toString().slice(-4)}`,
        firstName: 'Bob',
        lastName: 'Duplicate',
        email, // Same email
        departmentId: testDeptId,
        jobPositionId: testJobId,
        workingScheduleId: testScheduleId,
        employmentType: EmploymentType.FULL_TIME,
        hireDate: '2026-01-01',
      });
      throw new Error('Should have rejected duplicate email');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) throw e;
    }

    // Job position not in department rejection
    const otherDept = await prisma.department.findFirstOrThrow({ where: { code: 'ENG' } });
    try {
      await EmployeeService.createEmployee({
        employeeNumber: `EMP-MISMATCH-${Date.now().toString().slice(-4)}`,
        firstName: 'Charlie',
        lastName: 'Mismatch',
        email: `charlie.${Date.now()}@example.com`,
        departmentId: otherDept.id,
        jobPositionId: testJobId, // Belongs to testDeptId, not ENG!
        workingScheduleId: testScheduleId,
        employmentType: EmploymentType.FULL_TIME,
        hireDate: '2026-01-01',
      });
      throw new Error('Should have rejected job position belonging to different department');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) throw e;
    }

    // Search employee
    const found = await EmployeeService.listEmployees({ search: 'Wonderland' });
    if (found.length === 0 || !found.some((e) => e.id === emp.id)) {
      throw new Error('Employee search by name failed');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Employee Termination Transaction & Auto-Contract Expiration
  // --------------------------------------------------------------------------
  await test('EmployeeService: terminate employee and auto-expire active contracts', async () => {
    const structure = await prisma.salaryStructure.findFirstOrThrow();

    // Create an active contract for this employee
    const contract = await ContractService.createContract({
      contractNumber: `CON-TERM-${Date.now().toString().slice(-5)}`,
      employeeId: testEmployeeId,
      departmentId: testDeptId,
      jobPositionId: testJobId,
      workingScheduleId: testScheduleId,
      salaryStructureId: structure.id,
      wage: 50000.0,
      startDate: '2026-01-01',
      status: ContractStatus.ACTIVE,
    });

    if (contract.status !== ContractStatus.ACTIVE) throw new Error('Contract not active');

    // Terminate employee
    const termDate = '2026-06-30';
    const terminatedEmp = await EmployeeService.terminateEmployee(testEmployeeId, termDate);
    if (terminatedEmp.status !== EmployeeStatus.TERMINATED) {
      throw new Error('Employee status was not set to TERMINATED');
    }

    // Verify contract was auto-expired
    const updatedContract = await ContractService.getContractById(contract.id);
    if (updatedContract.status !== ContractStatus.EXPIRED) {
      throw new Error(`Contract status should be EXPIRED, got ${updatedContract.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Contract Complete-Period Eligibility Function
  // --------------------------------------------------------------------------
  await test('ContractService: verify complete-period eligibility matching', async () => {
    const emp = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: 'EMP-00102' } });

    // March 2026 period
    const eligible = await ContractService.getEligibleContractForPeriod(
      emp.id,
      new Date('2026-03-01'),
      new Date('2026-03-31')
    );

    if (!eligible || eligible.contractNumber !== 'CON-2026-JD2') {
      throw new Error('Failed to match eligible contract covering the complete March 2026 period');
    }

    // Historical 2024 period (before contract start)
    const noneEligible = await ContractService.getEligibleContractForPeriod(
      emp.id,
      new Date('2024-01-01'),
      new Date('2024-01-31')
    );
    if (noneEligible !== null) {
      throw new Error('Should return null for period preceding active contract start');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Contract Immutability Guard
  // --------------------------------------------------------------------------
  await test('ContractService: immutability guard blocks modifications when referenced by payslips', async () => {
    const emp = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: 'EMP-00102' } });
    const contract = await prisma.contract.findFirstOrThrow({ where: { contractNumber: 'CON-2026-JD2' } });
    const structure = await prisma.salaryStructure.findFirstOrThrow();

    // Create a dummy payrun and COMPUTED payslip referencing this contract
    const payrun = await prisma.payrun.create({
      data: {
        id: generateUuidV7(),
        name: 'Immutability Test Payrun',
        reference: `PAY-IMMUT-${Date.now()}`,
        salaryStructureId: structure.id,
        periodStartDate: new Date('2026-03-01'),
        periodEndDate: new Date('2026-03-31'),
        status: 'COMPUTED',
      },
    });

    const payslip = await prisma.payslip.create({
      data: {
        id: generateUuidV7(),
        payslipNumber: `SLIP-IMMUT-${Date.now()}`,
        payrunId: payrun.id,
        employeeId: emp.id,
        contractId: contract.id, // References contract!
        salaryStructureId: structure.id,
        periodStartDate: new Date('2026-03-01'),
        periodEndDate: new Date('2026-03-31'),
        status: 'COMPUTED',
        employeeNumberSnapshot: emp.employeeNumber,
        employeeNameSnapshot: `${emp.firstName} ${emp.lastName}`,
        contractNumberSnapshot: contract.contractNumber,
        contractWageSnapshot: contract.wage,
        contractWageTypeSnapshot: contract.wageType,
        salaryStructureNameSnapshot: structure.name,
        departmentIdSnapshot: emp.departmentId,
        departmentNameSnapshot: 'Engineering',
        jobPositionIdSnapshot: emp.jobPositionId,
        jobPositionNameSnapshot: 'Senior Software Engineer',
        scheduledWorkingDays: 22,
        actualWorkedDays: 22,
        paidLeaveQuantity: 0,
        unpaidLeaveQuantity: 0,
        absentDays: 0,
        workedHours: 176,
        expectedHours: 176,
        overtimeHours: 0,
        basicSalary: 60000,
        grossSalary: 87000,
        totalDeductions: 15900,
        netSalary: 71100,
        totalEmployerCost: 94200,
      },
    });

    try {
      // Attempting to change the wage on contract CON-2026-JD2 MUST BE REJECTED
      await ContractService.updateContract(contract.id, {
        wage: 99999.0,
      });
      throw new Error('Immutability guard failed to block wage modification on payslip-referenced contract');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'CONTRACT_IMMUTABLE') {
        throw new Error(`Expected CONTRACT_IMMUTABLE BusinessRuleError, got ${e.message}`);
      }
    }

    // However, updating non-payroll fields like notes is allowed
    const updatedWithNotes = await ContractService.updateContract(contract.id, {
      notes: 'Added administrative note without changing payroll numbers',
    });
    if (updatedWithNotes.notes !== 'Added administrative note without changing payroll numbers') {
      throw new Error('Failed to update non-payroll fields');
    }

    // Cleanup test records
    await prisma.payslip.delete({ where: { id: payslip.id } });
    await prisma.payrun.delete({ where: { id: payrun.id } });
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`HR Core Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runHrCoreTests()
  .catch((e) => {
    console.error('Fatal HR Core test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
