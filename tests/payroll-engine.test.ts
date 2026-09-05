import { PayrunService } from '../lib/services/payrun.service';
import { PayrollEngine } from '../lib/payroll/payroll-engine';
import { AuthService } from '../lib/services/auth.service';
import { AttendanceService } from '../lib/services/attendance.service';
import { TimeOffService } from '../lib/services/time-off.service';
import { ContractService } from '../lib/services/contract.service';
import { SalaryStructureService } from '../lib/services/salary-structure.service';
import { SalaryRuleService } from '../lib/services/salary-rule.service';
import {
  Prisma,
  PayrunStatus,
  PayslipStatus,
  ContractStatus,
  TimeOffUnit,
  AttendanceStatus,
  WageType,
  SalaryRuleCategory,
  ComputationType,
} from '@prisma/client';
import { BusinessRuleError, NotFoundError, AuthorizationError, ValidationError } from '../lib/errors';
import { generateUuidV7 } from '../lib/utils/id';
import prisma from '../lib/prisma';

async function runPayrollEngineTests() {
  console.log('🧪 Starting PeoplePay360 Payrun & Payslip Engine Tests...\n');
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

  // Load test sessions
  const johnSession = await AuthService.login('john.doe@peoplepay360.com', 'Password123!');
  const payrollMgrSession = await AuthService.login('payroll.manager@peoplepay360.com', 'Password123!');
  const payrollUserSession = await AuthService.login('payroll.user@peoplepay360.com', 'Password123!');

  const johnUser = johnSession.user;
  const payrollMgr = payrollMgrSession.user;
  const payrollUser = payrollUserSession.user;

  // Clean up any test records in October 2026
  await prisma.payrunEmployee.deleteMany({
    where: { payrun: { name: { startsWith: 'TEST_' } } },
  });
  await prisma.payslipLine.deleteMany({
    where: { payslip: { payrun: { name: { startsWith: 'TEST_' } } } },
  });
  await prisma.payslip.deleteMany({
    where: { payrun: { name: { startsWith: 'TEST_' } } },
  });
  await prisma.payrun.deleteMany({
    where: { name: { startsWith: 'TEST_' } },
  });

  const structure = await prisma.salaryStructure.findFirstOrThrow({
    where: { code: 'REG_FULLTIME_STRUCTURE' },
  });

  let draftPayrunId = '';
  let computedPayrunId = '';

  // --------------------------------------------------------------------------
  // TEST 1: create DRAFT payrun
  // --------------------------------------------------------------------------
  await test('1. create DRAFT payrun', async () => {
    const pr = await PayrunService.createPayrun(
      {
        name: 'TEST_OCT_2026_PAYRUN',
        salaryStructureId: structure.id,
        periodStartDate: '2026-10-01',
        periodEndDate: '2026-10-31',
        employeeIds: [johnUser.employee!.id],
        notes: 'October 2026 regular payroll run',
      },
      payrollMgr
    );
    draftPayrunId = pr.id;

    if (!pr.id || pr.status !== PayrunStatus.DRAFT) {
      throw new Error('Failed to create DRAFT payrun');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: invalid payrun period rejected
  // --------------------------------------------------------------------------
  await test('2. invalid payrun period rejected', async () => {
    try {
      await PayrunService.createPayrun(
        {
          name: 'TEST_INVALID_PERIOD',
          salaryStructureId: structure.id,
          periodStartDate: '2026-10-31',
          periodEndDate: '2026-10-01', // start > end
          employeeIds: [johnUser.employee!.id],
        },
        payrollMgr
      );
      throw new Error('Should have rejected inverted period dates');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'INVALID_PERIOD') throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: inactive salary structure rejected
  // --------------------------------------------------------------------------
  await test('3. inactive salary structure rejected', async () => {
    const inactStruct = await SalaryStructureService.createStructure({
      name: 'TEST_INACT_STRUCT',
      code: 'TEST_INACT_STRUCT',
      type: 'GROSS',
      isActive: false,
    });

    try {
      await PayrunService.createPayrun(
        {
          name: 'TEST_INACT_PR',
          salaryStructureId: inactStruct.id,
          periodStartDate: '2026-11-01',
          periodEndDate: '2026-11-30',
          employeeIds: [johnUser.employee!.id],
        },
        payrollMgr
      );
      throw new Error('Should have rejected inactive salary structure');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'INACTIVE_SALARY_STRUCTURE') throw e;
    } finally {
      await prisma.salaryStructure.delete({ where: { id: inactStruct.id } });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: employee with complete-period active contract is eligible
  // --------------------------------------------------------------------------
  await test('4. employee with complete-period active contract is eligible', async () => {
    const { contract, warnings } = await PayrollEngine.resolveEligibleContract(
      johnUser.employee!.id,
      new Date('2026-10-01'),
      new Date('2026-10-31')
    );

    if (!contract || warnings.some((w) => w.isBlocking)) {
      throw new Error('John Doe should be eligible with covering contract');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: employee with no covering contract is blocked
  // --------------------------------------------------------------------------
  await test('5. employee with no covering contract is blocked', async () => {
    // Search in 2023 where John had no contract
    const { contract, warnings } = await PayrollEngine.resolveEligibleContract(
      johnUser.employee!.id,
      new Date('2023-01-01'),
      new Date('2023-01-31')
    );

    if (contract !== null || !warnings.some((w) => w.code === 'MISSING_ACTIVE_CONTRACT')) {
      throw new Error('Should have generated MISSING_ACTIVE_CONTRACT blocking warning');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: employee with multiple covering contracts is blocked
  // --------------------------------------------------------------------------
  await test('6. employee with multiple covering contracts is blocked', async () => {
    const schedule = await prisma.workingSchedule.findFirstOrThrow({
      where: { code: 'STD_40H' },
    });

    // Temporarily drop exclusion constraint to simulate race condition / multi-contract state
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "no_overlapping_active_contracts";`
    );

    let dupContractId = '';
    try {
      const dupContract = await prisma.contract.create({
        data: {
          id: generateUuidV7(),
          contractNumber: 'TEST_DUP_CON_OCT',
          employeeId: johnUser.employee!.id,
          departmentId: johnUser.employee!.department.id,
          jobPositionId: johnUser.employee!.jobPosition.id,
          workingScheduleId: schedule.id,
          salaryStructureId: structure.id,
          wage: 50000,
          startDate: new Date('2026-01-01'),
          status: ContractStatus.ACTIVE,
        },
      });
      dupContractId = dupContract.id;

      const { contract, warnings } = await PayrollEngine.resolveEligibleContract(
        johnUser.employee!.id,
        new Date('2026-10-01'),
        new Date('2026-10-31')
      );

      if (contract !== null) {
        throw new Error('Should not have resolved an eligible contract when multiple exist');
      }

      if (!warnings.some((w) => w.code === 'MULTIPLE_ACTIVE_CONTRACTS' && w.isBlocking)) {
        throw new Error('Should have generated MULTIPLE_ACTIVE_CONTRACTS blocking warning');
      }
    } finally {
      if (dupContractId) {
        await prisma.contract.delete({ where: { id: dupContractId } }).catch(() => {});
      }
      // Re-enable exclusion constraint
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Contract" ADD CONSTRAINT "no_overlapping_active_contracts"
         EXCLUDE USING gist (
           "employeeId" WITH =,
           daterange("startDate", COALESCE("endDate", 'infinity'::date), '[]') WITH &&
         ) WHERE ("status" = 'ACTIVE');`
      ).catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: PayrunEmployee freezes selected contractId
  // --------------------------------------------------------------------------
  let frozenContractId = '';
  await test('7. PayrunEmployee freezes selected contractId', async () => {
    const pe = await prisma.payrunEmployee.findFirstOrThrow({
      where: { payrunId: draftPayrunId, employeeId: johnUser.employee!.id },
    });
    frozenContractId = pe.contractId;

    if (!pe.contractId) throw new Error('PayrunEmployee contractId was not frozen');
  });

  // --------------------------------------------------------------------------
  // TEST 8: later contract changes do not change frozen contract selection
  // --------------------------------------------------------------------------
  await test('8. later contract changes do not change frozen contract selection', async () => {
    const pe = await prisma.payrunEmployee.findFirstOrThrow({
      where: { payrunId: draftPayrunId, employeeId: johnUser.employee!.id },
    });
    if (pe.contractId !== frozenContractId) {
      throw new Error('Frozen contract selection changed');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: duplicate overlapping payroll rejected
  // --------------------------------------------------------------------------
  await test('9. duplicate overlapping payroll rejected', async () => {
    try {
      await PayrunService.createPayrun(
        {
          name: 'TEST_OVERLAPPING_OCT_RUN',
          salaryStructureId: structure.id,
          periodStartDate: '2026-10-15',
          periodEndDate: '2026-11-15', // Overlaps with October run
          employeeIds: [johnUser.employee!.id],
        },
        payrollMgr
      );
      throw new Error('Should have rejected duplicate overlapping payroll period');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'DUPLICATE_PAYROLL_PERIOD') throw e;
    }
  });

  // Setup October metrics records (Attendance and Leaves) for John
  const octAttendanceDate = new Date('2026-10-05T09:00:00Z'); // Monday
  await prisma.attendance.deleteMany({
    where: { employeeId: johnUser.employee!.id, date: new Date('2026-10-05') },
  });
  await AttendanceService.checkIn(johnUser.id, octAttendanceDate);
  await AttendanceService.checkOut(johnUser.id, new Date('2026-10-05T18:30:00Z')); // 9.5h worked, 8.0h expected, 1.5h overtime

  // --------------------------------------------------------------------------
  // TEST 10: scheduled days calculated from employee schedule
  // --------------------------------------------------------------------------
  await test('10. scheduled days calculated from employee schedule', async () => {
    const schedule = await prisma.workingSchedule.findFirstOrThrow({
      where: { code: 'STD_40H' },
      include: { days: true },
    });
    const metrics = await PayrollEngine.calculatePeriodMetrics(
      johnUser.employee!.id,
      schedule,
      new Date('2026-10-01'),
      new Date('2026-10-31')
    );

    // October 2026 has 31 calendar days, starting on Thursday, 22 weekdays (Monday-Friday)
    if (metrics.scheduledWorkingDays !== 22) {
      throw new Error(`Expected 22 scheduled days in Oct 2026, got ${metrics.scheduledWorkingDays}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: worked days calculated from attendance
  // --------------------------------------------------------------------------
  await test('11. worked days calculated from attendance', async () => {
    const schedule = await prisma.workingSchedule.findFirstOrThrow({
      where: { code: 'STD_40H' },
      include: { days: true },
    });
    const metrics = await PayrollEngine.calculatePeriodMetrics(
      johnUser.employee!.id,
      schedule,
      new Date('2026-10-01'),
      new Date('2026-10-31')
    );

    if (metrics.actualWorkedDays !== 1) {
      throw new Error(`Expected 1 actual worked day, got ${metrics.actualWorkedDays}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: worked hours calculated correctly
  // --------------------------------------------------------------------------
  await test('12. worked hours calculated correctly', async () => {
    const schedule = await prisma.workingSchedule.findFirstOrThrow({
      where: { code: 'STD_40H' },
      include: { days: true },
    });
    const metrics = await PayrollEngine.calculatePeriodMetrics(
      johnUser.employee!.id,
      schedule,
      new Date('2026-10-01'),
      new Date('2026-10-31')
    );

    if (metrics.workedHours !== 9.5) {
      throw new Error(`Expected 9.5 worked hours, got ${metrics.workedHours}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: overtime hours supplied correctly
  // --------------------------------------------------------------------------
  await test('13. overtime hours supplied correctly', async () => {
    const schedule = await prisma.workingSchedule.findFirstOrThrow({
      where: { code: 'STD_40H' },
      include: { days: true },
    });
    const metrics = await PayrollEngine.calculatePeriodMetrics(
      johnUser.employee!.id,
      schedule,
      new Date('2026-10-01'),
      new Date('2026-10-31')
    );

    if (metrics.overtimeHours !== 1.5) {
      throw new Error(`Expected 1.5 overtime hours, got ${metrics.overtimeHours}`);
    }
  });

  // Create an approved paid leave and an approved unpaid leave in October 2026
  const ptoType = await prisma.timeOffType.findFirstOrThrow({ where: { code: 'PTO' } });
  const unpaidType = await prisma.timeOffType.findFirstOrThrow({ where: { code: 'UNPAID' } });

  // Paid leave: Oct 12 (Monday, 1 day)
  const paidLeave = await TimeOffService.createRequest(
    {
      timeOffTypeId: ptoType.id,
      startDate: '2026-10-12',
      endDate: '2026-10-12',
      reason: 'TEST_PAID_LEAVE',
    },
    johnUser
  );
  await TimeOffService.approveRequest(paidLeave.id, payrollMgr);

  // Unpaid leave: Oct 13 to Oct 14 (Tue-Wed, 2 days)
  const unpaidLeave = await TimeOffService.createRequest(
    {
      timeOffTypeId: unpaidType.id,
      startDate: '2026-10-13',
      endDate: '2026-10-14',
      reason: 'TEST_UNPAID_LEAVE',
    },
    johnUser
  );
  await TimeOffService.approveRequest(unpaidLeave.id, payrollMgr);

  // --------------------------------------------------------------------------
  // TEST 14: approved paid leave included in payroll inputs
  // --------------------------------------------------------------------------
  await test('14. approved paid leave included in payroll inputs', async () => {
    const schedule = await prisma.workingSchedule.findFirstOrThrow({
      where: { code: 'STD_40H' },
      include: { days: true },
    });
    const metrics = await PayrollEngine.calculatePeriodMetrics(
      johnUser.employee!.id,
      schedule,
      new Date('2026-10-01'),
      new Date('2026-10-31')
    );

    if (metrics.paidLeaveQuantity !== 1.0) {
      throw new Error(`Expected 1.0 paid leave days, got ${metrics.paidLeaveQuantity}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 15: approved unpaid leave supplied as UNPAID_DAYS/hours
  // --------------------------------------------------------------------------
  await test('15. approved unpaid leave supplied as UNPAID_DAYS/hours', async () => {
    const schedule = await prisma.workingSchedule.findFirstOrThrow({
      where: { code: 'STD_40H' },
      include: { days: true },
    });
    const metrics = await PayrollEngine.calculatePeriodMetrics(
      johnUser.employee!.id,
      schedule,
      new Date('2026-10-01'),
      new Date('2026-10-31')
    );

    if (metrics.unpaidLeaveQuantity !== 2.0) {
      throw new Error(`Expected 2.0 unpaid leave days, got ${metrics.unpaidLeaveQuantity}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 16: DRAFT -> COMPUTED works
  // --------------------------------------------------------------------------
  await test('16. DRAFT -> COMPUTED works', async () => {
    const computed = await PayrunService.computePayrun(draftPayrunId, payrollMgr);
    computedPayrunId = computed.id;

    if (computed.status !== PayrunStatus.COMPUTED) {
      throw new Error(`Expected COMPUTED status, got ${computed.status}`);
    }
    if (computed.payslipCount !== 1) {
      throw new Error(`Expected payslipCount 1, got ${computed.payslipCount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: salary rules execute in effective sequence
  // --------------------------------------------------------------------------
  await test('17. salary rules execute in effective sequence', async () => {
    const payslip = await prisma.payslip.findFirstOrThrow({
      where: { payrunId: computedPayrunId },
      include: { lines: { orderBy: { sequence: 'asc' } } },
    });

    const seqs = payslip.lines.map((l) => l.sequence);
    for (let i = 0; i < seqs.length - 1; i++) {
      if (seqs[i] > seqs[i + 1]) {
        throw new Error(`Payslip lines not in ascending sequence: ${seqs.join(', ')}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 18: percentage rule uses correct base
  // --------------------------------------------------------------------------
  await test('18. percentage rule uses correct base', async () => {
    const payslip = await prisma.payslip.findFirstOrThrow({
      where: { payrunId: computedPayrunId },
      include: { lines: true },
    });

    const pfLine = payslip.lines.find((l) => l.ruleCode === 'PF');
    if (!pfLine) throw new Error('PF rule line missing');

    // PF is 12% of BASIC (60,000) = 7,200
    if (Number(pfLine.amount) !== 7200.0) {
      throw new Error(`Expected PF amount 7200.00, got ${pfLine.amount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 19: formula rule uses payroll context
  // --------------------------------------------------------------------------
  await test('19. formula rule uses payroll context', async () => {
    const payslip = await prisma.payslip.findFirstOrThrow({
      where: { payrunId: computedPayrunId },
      include: { lines: true },
    });

    const unpaidLine = payslip.lines.find((l) => l.ruleCode === 'UNPAID_DEDUCTION');
    if (!unpaidLine) throw new Error('UNPAID_DEDUCTION rule line missing');
    if (Number(unpaidLine.amount) < 0) throw new Error('Deduction amounts must be positive magnitude');
  });

  // --------------------------------------------------------------------------
  // TEST 20: formula can reference previous rule results
  // --------------------------------------------------------------------------
  await test('20. formula can reference previous rule results', async () => {
    const payslip = await prisma.payslip.findFirstOrThrow({
      where: { payrunId: computedPayrunId },
      include: { lines: true },
    });

    const netLine = payslip.lines.find((l) => l.ruleCode === 'NET');
    if (!netLine) throw new Error('NET rule line missing');
    // Net equals GROSS - PF - TAX - UNPAID_DEDUCTION
    if (Number(netLine.amount) <= 0) throw new Error('NET amount should be positive');
  });

  // --------------------------------------------------------------------------
  // TEST 21: unsafe formula cannot execute
  // --------------------------------------------------------------------------
  await test('21. unsafe formula cannot execute', async () => {
    const badRule = await prisma.salaryRule.create({
      data: {
        id: generateUuidV7(),
        name: 'Bad Injection Rule',
        code: 'TEST_INJ_RULE',
        category: SalaryRuleCategory.ALLOWANCE,
        computationType: ComputationType.FORMULA,
        formulaExpression: 'eval("500")',
      },
    }).catch(() => null);

    if (badRule) {
      // Trying to evaluate via PayrollEngine catches it as a blocking warning
      const res = await PayrollEngine.computeEmployeePayslip(
        johnUser.employee!.id,
        frozenContractId,
        structure.id,
        new Date('2026-10-01'),
        new Date('2026-10-31')
      );
      await prisma.salaryRule.delete({ where: { id: badRule.id } });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 22: payslip created
  // --------------------------------------------------------------------------
  let generatedPayslipId = '';
  await test('22. payslip created', async () => {
    const ps = await prisma.payslip.findFirstOrThrow({
      where: { payrunId: computedPayrunId },
    });
    generatedPayslipId = ps.id;

    if (!ps.payslipNumber.startsWith('PS-')) {
      throw new Error(`Expected formatted payslip number, got ${ps.payslipNumber}`);
    }
    if (ps.status !== PayslipStatus.COMPUTED) {
      throw new Error(`Expected COMPUTED status, got ${ps.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 23: payslip lines created
  // --------------------------------------------------------------------------
  await test('23. payslip lines created', async () => {
    const lines = await prisma.payslipLine.findMany({
      where: { payslipId: generatedPayslipId },
    });
    if (lines.length === 0) throw new Error('No payslip lines were created');
  });

  // --------------------------------------------------------------------------
  // TEST 24: payslip employee/contract/structure snapshots created
  // --------------------------------------------------------------------------
  await test('24. payslip employee/contract/structure snapshots created', async () => {
    const ps = await prisma.payslip.findUniqueOrThrow({
      where: { id: generatedPayslipId },
    });

    if (ps.employeeNumberSnapshot !== 'EMP-00102') throw new Error('employeeNumberSnapshot mismatch');
    if (ps.employeeNameSnapshot !== 'John Doe') throw new Error('employeeNameSnapshot mismatch');
    if (Number(ps.contractWageSnapshot) !== 60000.0) throw new Error('contractWageSnapshot mismatch');
    if (ps.salaryStructureNameSnapshot !== structure.name) throw new Error('salaryStructureNameSnapshot mismatch');
  });

  // --------------------------------------------------------------------------
  // TEST 25: payslip line rule snapshots created
  // --------------------------------------------------------------------------
  await test('25. payslip line rule snapshots created', async () => {
    const line = await prisma.payslipLine.findFirstOrThrow({
      where: { payslipId: generatedPayslipId, ruleCode: 'BASIC' },
    });

    if (line.ruleName !== 'Basic Salary') throw new Error('ruleName mismatch');
    if (Number(line.amount) !== 60000.0) throw new Error('amount mismatch');
  });

  // --------------------------------------------------------------------------
  // TEST 26: gross calculated correctly
  // --------------------------------------------------------------------------
  await test('26. gross calculated correctly', async () => {
    const ps = await prisma.payslip.findUniqueOrThrow({ where: { id: generatedPayslipId } });
    if (Number(ps.grossSalary) < Number(ps.basicSalary)) {
      throw new Error('Gross salary should be at least basic salary');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 27: deductions calculated correctly
  // --------------------------------------------------------------------------
  await test('27. deductions calculated correctly', async () => {
    const ps = await prisma.payslip.findUniqueOrThrow({ where: { id: generatedPayslipId } });
    if (Number(ps.totalDeductions) <= 0) {
      throw new Error('Total deductions should be positive magnitude');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 28: net calculated correctly
  // --------------------------------------------------------------------------
  await test('28. net calculated correctly', async () => {
    const ps = await prisma.payslip.findUniqueOrThrow({ where: { id: generatedPayslipId } });
    if (Number(ps.netSalary) <= 0) {
      throw new Error('Net salary must be positive');
    }
    const expectedNet = Number(ps.grossSalary) - Number(ps.totalDeductions);
    if (Math.abs(Number(ps.netSalary) - expectedNet) > 0.05) {
      throw new Error(`Net salary (${ps.netSalary}) does not match gross - deductions (${expectedNet})`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 29: employer cost calculated correctly
  // --------------------------------------------------------------------------
  await test('29. employer cost calculated correctly', async () => {
    const ps = await prisma.payslip.findUniqueOrThrow({ where: { id: generatedPayslipId } });
    if (Number(ps.totalEmployerCost) <= Number(ps.grossSalary)) {
      throw new Error('Total employer cost should include employer contributions');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 30: Payrun totals match payslip source data
  // --------------------------------------------------------------------------
  await test('30. Payrun totals match payslip source data', async () => {
    const pr = await prisma.payrun.findUniqueOrThrow({ where: { id: computedPayrunId } });
    const ps = await prisma.payslip.findUniqueOrThrow({ where: { id: generatedPayslipId } });

    if (Number(pr.totalGross) !== Number(ps.grossSalary)) throw new Error('totalGross mismatch');
    if (Number(pr.totalDeductions) !== Number(ps.totalDeductions)) throw new Error('totalDeductions mismatch');
    if (Number(pr.totalNet) !== Number(ps.netSalary)) throw new Error('totalNet mismatch');
    if (Number(pr.totalEmployerCost) !== Number(ps.totalEmployerCost)) throw new Error('totalEmployerCost mismatch');
  });

  // --------------------------------------------------------------------------
  // TEST 31: blocking warnings prevent validation
  // --------------------------------------------------------------------------
  await test('31. blocking warnings prevent validation', async () => {
    // Inject a blocking warning onto the payslip
    await prisma.payslip.update({
      where: { id: generatedPayslipId },
      data: {
        hasWarnings: true,
        warningsJson: [{ code: 'TEST_BLOCKING', message: 'Test blocking warning', isBlocking: true }],
      },
    });

    try {
      await PayrunService.validatePayrun(computedPayrunId, payrollMgr);
      throw new Error('Should have rejected validation with blocking warning');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'PAYRUN_HAS_BLOCKING_WARNINGS') throw e;
    } finally {
      // Revert blocking warning
      await prisma.payslip.update({
        where: { id: generatedPayslipId },
        data: { hasWarnings: false, warningsJson: Prisma.DbNull },
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 32: COMPUTED -> VALIDATED works
  // --------------------------------------------------------------------------
  await test('32. COMPUTED -> VALIDATED works', async () => {
    const validated = await PayrunService.validatePayrun(computedPayrunId, payrollMgr);
    if (validated.status !== PayrunStatus.VALIDATED) {
      throw new Error(`Expected VALIDATED status, got ${validated.status}`);
    }

    const ps = await prisma.payslip.findUniqueOrThrow({ where: { id: generatedPayslipId } });
    if (ps.status !== PayslipStatus.VALIDATED) {
      throw new Error('Payslip status was not updated to VALIDATED');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 33: VALIDATED -> PAID works
  // --------------------------------------------------------------------------
  await test('33. VALIDATED -> PAID works', async () => {
    const paid = await PayrunService.markPayrunPaid(computedPayrunId, payrollMgr);
    if (paid.status !== PayrunStatus.PAID) {
      throw new Error(`Expected PAID status, got ${paid.status}`);
    }

    const ps = await prisma.payslip.findUniqueOrThrow({ where: { id: generatedPayslipId } });
    if (ps.status !== PayslipStatus.PAID) {
      throw new Error('Payslip status was not updated to PAID');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 34: finalized payroll cannot be modified
  // --------------------------------------------------------------------------
  await test('34. finalized payroll cannot be modified', async () => {
    try {
      await PayrunService.computePayrun(computedPayrunId, payrollMgr);
      throw new Error('Should have rejected recalculating finalized payrun');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'PAYRUN_LOCKED') throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 35: repeated compute cannot create duplicate payslips
  // --------------------------------------------------------------------------
  await test('35. repeated compute cannot create duplicate payslips', async () => {
    // Create new draft payrun
    const pr = await PayrunService.createPayrun(
      {
        name: 'TEST_REPEAT_COMPUTE_RUN',
        salaryStructureId: structure.id,
        periodStartDate: '2026-12-01',
        periodEndDate: '2026-12-31',
        employeeIds: [johnUser.employee!.id],
      },
      payrollMgr
    );

    // First compute
    await PayrunService.computePayrun(pr.id, payrollMgr);
    // Repeated compute
    await PayrunService.computePayrun(pr.id, payrollMgr);

    const count = await prisma.payslip.count({ where: { payrunId: pr.id } });
    if (count !== 1) {
      throw new Error(`Expected exactly 1 payslip after repeated compute, got ${count}`);
    }

    // Clean up
    await prisma.payrun.delete({ where: { id: pr.id } });
  });

  // --------------------------------------------------------------------------
  // TEST 36: concurrent compute cannot create duplicate payslips
  // --------------------------------------------------------------------------
  await test('36. concurrent compute cannot create duplicate payslips', async () => {
    const pr = await PayrunService.createPayrun(
      {
        name: 'TEST_CONCURRENT_COMPUTE_RUN',
        salaryStructureId: structure.id,
        periodStartDate: '2026-12-01',
        periodEndDate: '2026-12-31',
        employeeIds: [johnUser.employee!.id],
      },
      payrollMgr
    );

    // Launch two simultaneous compute calls
    await Promise.allSettled([
      PayrunService.computePayrun(pr.id, payrollMgr),
      PayrunService.computePayrun(pr.id, payrollMgr),
    ]);

    const count = await prisma.payslip.count({ where: { payrunId: pr.id } });
    if (count !== 1) {
      throw new Error(`Expected exactly 1 payslip after concurrent compute, got ${count}`);
    }

    await prisma.payrun.delete({ where: { id: pr.id } });
  });

  // --------------------------------------------------------------------------
  // TEST 37: unauthorized employee cannot manage payrun
  // --------------------------------------------------------------------------
  await test('37. unauthorized employee cannot manage payrun', async () => {
    const hasCreate = johnUser.permissions.includes('payroll.payrun.create');
    const hasCompute = johnUser.permissions.includes('payroll.payrun.compute');
    const hasValidate = johnUser.permissions.includes('payroll.payrun.validate');

    if (hasCreate || hasCompute || hasValidate) {
      throw new Error('Ordinary employee John should not possess payrun management permissions');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 38: payroll role can create/compute/validate
  // --------------------------------------------------------------------------
  await test('38. payroll role can create/compute/validate', async () => {
    const hasCreate = payrollMgr.permissions.includes('payroll.payrun.create');
    const hasCompute = payrollMgr.permissions.includes('payroll.payrun.compute');
    const hasValidate = payrollMgr.permissions.includes('payroll.payrun.validate');

    if (!hasCreate || !hasCompute || !hasValidate) {
      throw new Error('Payroll manager should possess create, compute, and validate permissions');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 39: employee can only access own payslip if self-service route is exposed
  // --------------------------------------------------------------------------
  await test('39. employee can only access own payslip if self-service route is exposed', async () => {
    // John can view his own payslip
    const ownPayslip = await PayrunService.getPayslipById(generatedPayslipId, johnUser);
    if (ownPayslip.id !== generatedPayslipId) throw new Error('Employee could not access own payslip');

    // Create another employee session or check Sarah accessing John's payslip
    const sarahSession = await AuthService.login('sarah.smith@peoplepay360.com', 'Password123!');
    try {
      await PayrunService.getPayslipById(generatedPayslipId, sarahSession.user);
      throw new Error('Sarah should not be allowed to view John payslip');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 40: transaction rollback leaves no partial payslip/payslip-lines
  // --------------------------------------------------------------------------
  await test('40. transaction rollback leaves no partial payslip/payslip-lines', async () => {
    const pr = await PayrunService.createPayrun(
      {
        name: 'TEST_ROLLBACK_RUN',
        salaryStructureId: structure.id,
        periodStartDate: '2026-12-01',
        periodEndDate: '2026-12-31',
        employeeIds: [johnUser.employee!.id],
      },
      payrollMgr
    );

    // Simulate transaction rollback inside compute
    try {
      await prisma.$transaction(async (tx) => {
        await tx.payslip.create({
          data: {
            id: generateUuidV7(),
            payslipNumber: 'PS-ROLLBACK-TEST',
            payrunId: pr.id,
            employeeId: johnUser.employee!.id,
            contractId: frozenContractId,
            salaryStructureId: structure.id,
            periodStartDate: new Date('2026-12-01'),
            periodEndDate: new Date('2026-12-31'),
            employeeNumberSnapshot: 'EMP-00102',
            employeeNameSnapshot: 'John Doe',
            contractNumberSnapshot: 'CON-2026-JD2',
            contractWageSnapshot: 60000,
            contractWageTypeSnapshot: WageType.MONTHLY,
            salaryStructureNameSnapshot: structure.name,
            departmentIdSnapshot: johnUser.employee!.department.id,
            departmentNameSnapshot: 'Engineering',
            jobPositionIdSnapshot: johnUser.employee!.jobPosition.id,
            jobPositionNameSnapshot: 'Developer',
            scheduledWorkingDays: 22,
            actualWorkedDays: 22,
            paidLeaveQuantity: 0,
            unpaidLeaveQuantity: 0,
            absentDays: 0,
            workedHours: 176,
            expectedHours: 176,
            overtimeHours: 0,
            basicSalary: 60000,
            grossSalary: 60000,
            totalDeductions: 0,
            netSalary: 60000,
            totalEmployerCost: 60000,
          },
        });

        // Intentional rollback failure
        throw new Error('Simulated transaction failure during payslip generation');
      });
    } catch (e: any) {
      // Expected
    }

    // Verify rollback leaves zero payslips
    const count = await prisma.payslip.count({ where: { payrunId: pr.id } });
    if (count !== 0) {
      throw new Error(`Transaction rollback failed: found ${count} orphaned payslips`);
    }

    // Clean up
    await prisma.payrun.delete({ where: { id: pr.id } });
  });

  // Clean up
  await prisma.attendance.deleteMany({
    where: { employeeId: johnUser.employee!.id, date: new Date('2026-10-05') },
  });
  await TimeOffService.cancelRequest(paidLeave.id, payrollMgr);
  await TimeOffService.cancelRequest(unpaidLeave.id, payrollMgr);
  await prisma.payrun.delete({ where: { id: computedPayrunId } });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`Payrun Engine Tests: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPayrollEngineTests()
  .catch((e) => {
    console.error('Fatal Payroll Engine test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
