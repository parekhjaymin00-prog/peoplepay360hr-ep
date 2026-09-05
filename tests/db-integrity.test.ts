import { PrismaClient, ContractStatus, TimeOffStatus, WageType, SalaryRuleCategory, ComputationType, TimeOffUnit, AllocationStatus } from '@prisma/client';
import { generateUuidV7 } from '../lib/utils/id';

const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Starting PeoplePay360 Database Integrity & Invariant Tests...\n');
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
  // TEST 1: Database Connection & Seed Data Availability
  // --------------------------------------------------------------------------
  await test('Verify seeded master roles, employees, and contracts exist', async () => {
    const roleCount = await prisma.role.count();
    if (roleCount < 5) throw new Error(`Expected at least 5 roles, got ${roleCount}`);

    const employeeCount = await prisma.employee.count();
    if (employeeCount < 3) throw new Error(`Expected at least 3 employees, got ${employeeCount}`);

    const activeContracts = await prisma.contract.count({ where: { status: ContractStatus.ACTIVE } });
    if (activeContracts < 3) throw new Error(`Expected at least 3 active contracts, got ${activeContracts}`);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Unique Constraints
  // --------------------------------------------------------------------------
  await test('Unique constraint rejects duplicate employee email', async () => {
    const existing = await prisma.employee.findFirstOrThrow();
    try {
      await prisma.employee.create({
        data: {
          id: generateUuidV7(),
          employeeNumber: `EMP-${Date.now()}`,
          firstName: 'Duplicate',
          lastName: 'Tester',
          email: existing.email, // duplicate email
          departmentId: existing.departmentId,
          jobPositionId: existing.jobPositionId,
          workingScheduleId: existing.workingScheduleId,
          employmentType: existing.employmentType,
          hireDate: new Date('2026-01-01'),
        },
      });
      throw new Error('Database failed to reject duplicate email');
    } catch (e: any) {
      if (!e.message.includes('Unique constraint failed') && !e.message.includes('duplicate key value')) {
        throw e;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Foreign Key Constraints
  // --------------------------------------------------------------------------
  await test('Foreign key constraint rejects non-existent departmentId', async () => {
    const fakeDeptId = generateUuidV7();
    const existing = await prisma.employee.findFirstOrThrow();
    try {
      await prisma.employee.create({
        data: {
          id: generateUuidV7(),
          employeeNumber: `EMP-FK-${Date.now()}`,
          firstName: 'FK',
          lastName: 'Tester',
          email: `fk.test.${Date.now()}@example.com`,
          departmentId: fakeDeptId,
          jobPositionId: existing.jobPositionId,
          workingScheduleId: existing.workingScheduleId,
          employmentType: existing.employmentType,
          hireDate: new Date('2026-01-01'),
        },
      });
      throw new Error('Database failed to reject invalid foreign key');
    } catch (e: any) {
      if (!e.message.includes('Foreign key constraint') && !e.message.includes('foreign key')) {
        throw e;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Check Constraints (Check positive amounts)
  // --------------------------------------------------------------------------
  await test('Check constraint rejects negative contract wage', async () => {
    const emp = await prisma.employee.findFirstOrThrow();
    const schedule = await prisma.workingSchedule.findFirstOrThrow();
    const structure = await prisma.salaryStructure.findFirstOrThrow();
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Contract" (
          "id", "contractNumber", "employeeId", "departmentId", "jobPositionId",
          "workingScheduleId", "salaryStructureId", "wage", "wageType", "startDate",
          "status", "createdAt", "updatedAt"
        ) VALUES (
          '${generateUuidV7()}', 'CON-INVALID-WAGE', '${emp.id}', '${emp.departmentId}',
          '${emp.jobPositionId}', '${schedule.id}', '${structure.id}', -500.00, 'MONTHLY',
          '2026-01-01', 'DRAFT', NOW(), NOW()
        )
      `);
      throw new Error('Database failed to reject negative contract wage');
    } catch (e: any) {
      if (!e.message.includes('chk_contract_wage_positive')) {
        throw e;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: PostgreSQL Exclusion Constraint (Contract Overlap Prevention)
  // --------------------------------------------------------------------------
  await test('PostgreSQL btree_gist exclusion constraint blocks overlapping ACTIVE contracts', async () => {
    const emp = await prisma.employee.findFirstOrThrow({
      where: { employeeNumber: 'EMP-00102' }, // John Doe
    });
    const schedule = await prisma.workingSchedule.findFirstOrThrow();
    const structure = await prisma.salaryStructure.findFirstOrThrow();

    // John Doe already has an ACTIVE contract from 2026-01-01 to infinity (CON-2026-JD2)
    // Attempting to insert another ACTIVE contract overlapping 2026-06-01 to 2026-12-31 MUST FAIL at DB level
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Contract" (
          "id", "contractNumber", "employeeId", "departmentId", "jobPositionId",
          "workingScheduleId", "salaryStructureId", "wage", "wageType", "startDate",
          "endDate", "status", "createdAt", "updatedAt"
        ) VALUES (
          '${generateUuidV7()}', 'CON-OVERLAP-FAIL', '${emp.id}', '${emp.departmentId}',
          '${emp.jobPositionId}', '${schedule.id}', '${structure.id}', 65000.00, 'MONTHLY',
          '2026-06-01', '2026-12-31', 'ACTIVE', NOW(), NOW()
        )
      `);
      throw new Error('Database failed to block overlapping ACTIVE contracts!');
    } catch (e: any) {
      if (!e.message.includes('no_overlapping_active_contracts') && !e.message.includes('conflicting key value violates exclusion constraint')) {
        throw e;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Complete-Period Contract Payroll Eligibility
  // --------------------------------------------------------------------------
  await test('Contract selection requires complete period coverage (not simple overlap)', async () => {
    const emp = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: 'EMP-00102' } });

    // Scenario A: Payrun for March 2026 (2026-03-01 to 2026-03-31)
    const periodStart = new Date('2026-03-01');
    const periodEnd = new Date('2026-03-31');

    // Query using the complete period rule
    const eligibleContracts = await prisma.contract.findMany({
      where: {
        employeeId: emp.id,
        status: ContractStatus.ACTIVE,
        startDate: { lte: periodStart },
        OR: [
          { endDate: null },
          { endDate: { gte: periodEnd } },
        ],
      },
    });

    if (eligibleContracts.length !== 1) {
      throw new Error(`Expected exactly 1 eligible contract for John Doe in March 2026, found ${eligibleContracts.length}`);
    }
    if (eligibleContracts[0].contractNumber !== 'CON-2026-JD2') {
      throw new Error(`Expected active contract CON-2026-JD2, got ${eligibleContracts[0].contractNumber}`);
    }

    // Scenario B: Period in 2025 (historical)
    const histPeriodStart = new Date('2025-06-01');
    const histPeriodEnd = new Date('2025-06-30');
    const eligible2025 = await prisma.contract.findMany({
      where: {
        employeeId: emp.id,
        status: ContractStatus.ACTIVE, // only active contracts qualify
        startDate: { lte: histPeriodStart },
        OR: [
          { endDate: null },
          { endDate: { gte: histPeriodEnd } },
        ],
      },
    });
    // The 2025 contract is EXPIRED, so 0 ACTIVE contracts qualify
    if (eligible2025.length !== 0) {
      throw new Error(`Expected 0 active contracts for 2025 historical period, found ${eligible2025.length}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Time Off DAYS and HOURS Behavior & Check Constraints
  // --------------------------------------------------------------------------
  await test('TimeOffRequest check constraints enforce time interval rules for DAYS and HOURS', async () => {
    const emp = await prisma.employee.findFirstOrThrow();
    const typeDays = await prisma.timeOffType.findFirstOrThrow({ where: { unit: TimeOffUnit.DAYS } });

    // Invalid interval: startTime without endTime must fail
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "TimeOffRequest" (
          "id", "requestNumber", "employeeId", "timeOffTypeId", "startDate", "endDate",
          "startTime", "endTime", "durationQuantity", "status", "createdAt", "updatedAt"
        ) VALUES (
          '${generateUuidV7()}', 'REQ-FAIL-TIME-1', '${emp.id}', '${typeDays.id}',
          '2026-04-01', '2026-04-01', '09:00', NULL, 1.0, 'SUBMITTED', NOW(), NOW()
        )
      `);
      throw new Error('Database failed to reject startTime without endTime');
    } catch (e: any) {
      if (!e.message.includes('chk_timeoff_req_time_interval')) throw e;
    }

    // Invalid interval: endTime <= startTime must fail
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "TimeOffRequest" (
          "id", "requestNumber", "employeeId", "timeOffTypeId", "startDate", "endDate",
          "startTime", "endTime", "durationQuantity", "status", "createdAt", "updatedAt"
        ) VALUES (
          '${generateUuidV7()}', 'REQ-FAIL-TIME-2', '${emp.id}', '${typeDays.id}',
          '2026-04-01', '2026-04-01', '14:00', '09:00', 5.0, 'SUBMITTED', NOW(), NOW()
        )
      `);
      throw new Error('Database failed to reject endTime <= startTime');
    } catch (e: any) {
      if (!e.message.includes('chk_timeoff_req_time_interval')) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Time Off Allocation Balance Constraints
  // --------------------------------------------------------------------------
  await test('Allocation check constraints prevent remainingQuantity overdrawing (< 0)', async () => {
    const emp = await prisma.employee.findFirstOrThrow();
    const type = await prisma.timeOffType.findFirstOrThrow();

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "TimeOffAllocation" (
          "id", "allocationNumber", "employeeId", "timeOffTypeId", "allocatedQuantity",
          "takenQuantity", "remainingQuantity", "validFrom", "validTo", "status",
          "createdAt", "updatedAt"
        ) VALUES (
          '${generateUuidV7()}', 'ALC-FAIL-BAL', '${emp.id}', '${type.id}', 10.0,
          15.0, -5.0, '2026-01-01', '2026-12-31', 'APPROVED', NOW(), NOW()
        )
      `);
      throw new Error('Database failed to reject negative remainingQuantity');
    } catch (e: any) {
      if (!e.message.includes('chk_allocation_remaining_nonnegative')) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Salary Rule Effective Sequence Determinism
  // --------------------------------------------------------------------------
  await test('Salary structure rules resolve effectiveSequence deterministically', async () => {
    const structure = await prisma.salaryStructure.findUniqueOrThrow({
      where: { code: 'REG_FULLTIME_STRUCTURE' },
      include: {
        structureRules: {
          include: { salaryRule: true },
        },
      },
    });

    const orderedRules = structure.structureRules.map((sr) => ({
      code: sr.salaryRule.code,
      effectiveSequence: sr.sequenceOverride ?? sr.salaryRule.sequence,
    })).sort((a, b) => a.effectiveSequence - b.effectiveSequence);

    // Verify ordering
    const codes = orderedRules.map((r) => r.code);
    const basicIdx = codes.indexOf('BASIC');
    const grossIdx = codes.indexOf('GROSS');
    const netIdx = codes.indexOf('NET');

    if (basicIdx >= grossIdx) throw new Error('BASIC must be evaluated before GROSS');
    if (grossIdx >= netIdx) throw new Error('GROSS must be evaluated before NET');
  });

  // --------------------------------------------------------------------------
  // TEST 10: Payrun Employee Contract Freezing & Payslip Snapshots
  // --------------------------------------------------------------------------
  await test('Payrun Employee contract freezing and immutable payslip snapshot persistence', async () => {
    const emp = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: 'EMP-00102' } });
    const contract = await prisma.contract.findFirstOrThrow({ where: { contractNumber: 'CON-2026-JD2' } });
    const structure = await prisma.salaryStructure.findFirstOrThrow({ where: { code: 'REG_FULLTIME_STRUCTURE' } });

    // Create a draft Payrun
    const payrun = await prisma.payrun.create({
      data: {
        id: generateUuidV7(),
        name: 'Test Payrun - March 2026',
        reference: `PAYRUN-TEST-${Date.now()}`,
        salaryStructureId: structure.id,
        periodStartDate: new Date('2026-03-01'),
        periodEndDate: new Date('2026-03-31'),
        totalGross: 87000.00,
        totalDeductions: 15900.00,
        totalNet: 71100.00,
        payslipCount: 1,
      },
    });

    // Bind employee with frozen contractId in PayrunEmployee
    const payrunEmp = await prisma.payrunEmployee.create({
      data: {
        id: generateUuidV7(),
        payrunId: payrun.id,
        employeeId: emp.id,
        contractId: contract.id, // Frozen authoritative contract
      },
    });

    // Create Payslip with full historical snapshots
    const payslip = await prisma.payslip.create({
      data: {
        id: generateUuidV7(),
        payslipNumber: `SLIP-TEST-${Date.now()}`,
        payrunId: payrun.id,
        employeeId: emp.id,
        contractId: payrunEmp.contractId, // Loaded directly from PayrunEmployee
        salaryStructureId: structure.id,
        periodStartDate: payrun.periodStartDate,
        periodEndDate: payrun.periodEndDate,
        status: 'DRAFT',
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
        scheduledWorkingDays: 22.0,
        actualWorkedDays: 20.0,
        paidLeaveQuantity: 2.0,
        unpaidLeaveQuantity: 0.0,
        absentDays: 0.0,
        workedHours: 160.0,
        expectedHours: 176.0,
        overtimeHours: 0.0,
        basicSalary: 60000.00,
        grossSalary: 87000.00,
        totalDeductions: 15900.00,
        netSalary: 71100.00,
        totalEmployerCost: 94200.00,
      },
    });

    // Add immutable lines
    await prisma.payslipLine.createMany({
      data: [
        {
          id: generateUuidV7(),
          payslipId: payslip.id,
          ruleCode: 'BASIC',
          ruleName: 'Basic Salary',
          category: SalaryRuleCategory.BASIC,
          sequence: 10,
          amount: 60000.00,
        },
        {
          id: generateUuidV7(),
          payslipId: payslip.id,
          ruleCode: 'HRA',
          ruleName: 'House Rent Allowance',
          category: SalaryRuleCategory.ALLOWANCE,
          sequence: 20,
          rate: 40.0,
          baseAmount: 60000.00,
          amount: 24000.00,
        },
        {
          id: generateUuidV7(),
          payslipId: payslip.id,
          ruleCode: 'NET',
          ruleName: 'Net Salary',
          category: SalaryRuleCategory.NET,
          sequence: 100,
          amount: 71100.00,
        },
      ],
    });

    // Verify retrieval
    const retrievedPayslip = await prisma.payslip.findUniqueOrThrow({
      where: { id: payslip.id },
      include: { lines: true },
    });

    if (retrievedPayslip.contractNumberSnapshot !== 'CON-2026-JD2') {
      throw new Error(`Contract snapshot mismatch: ${retrievedPayslip.contractNumberSnapshot}`);
    }
    if (retrievedPayslip.lines.length !== 3) {
      throw new Error(`Expected 3 payslip lines, got ${retrievedPayslip.lines.length}`);
    }

    // Clean up test payrun
    await prisma.payrun.delete({ where: { id: payrun.id } });
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test execution fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
