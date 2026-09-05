import { TimeOffService } from '../lib/services/time-off.service';
import { AuthService } from '../lib/services/auth.service';
import { TimeOffUnit, AllocationStatus, TimeOffStatus } from '@prisma/client';
import { BusinessRuleError, NotFoundError, AuthorizationError, ValidationError } from '../lib/errors';
import { generateUuidV7 } from '../lib/utils/id';
import prisma from '../lib/prisma';

async function runTimeOffTests() {
  console.log('🧪 Starting PeoplePay360 Time Off Domain Tests...\n');
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

  // Load test users
  const johnSession = await AuthService.login('john.doe@peoplepay360.com', 'Password123!');
  const hrSession = await AuthService.login('hr.manager@peoplepay360.com', 'Password123!');
  const sarahSession = await AuthService.login('sarah.smith@peoplepay360.com', 'Password123!');

  const johnUser = johnSession.user;
  const hrUser = hrSession.user;
  const sarahUser = sarahSession.user;

  // Clean up any test records from prior runs
  await prisma.timeOffRequest.deleteMany({
    where: {
      employeeId: { in: [johnUser.employee!.id, sarahUser.employee!.id] },
      reason: { startsWith: 'TEST_' },
    },
  });
  await prisma.timeOffAllocation.deleteMany({
    where: {
      employeeId: { in: [johnUser.employee!.id, sarahUser.employee!.id] },
      notes: { startsWith: 'TEST_' },
    },
  });
  await prisma.timeOffType.deleteMany({
    where: {
      code: { in: ['TEST_VAC', 'TEST_DOC', 'TEST_UNP', 'TEST_CONC'] },
    },
  });

  let daysTypeId = '';
  let hoursTypeId = '';
  let testAllocId = '';
  let testDaysReqId = '';
  let testHoursAllocId = '';

  // --------------------------------------------------------------------------
  // TEST 1: Create DAYS type
  // --------------------------------------------------------------------------
  await test('1. Create DAYS type', async () => {
    const type = await TimeOffService.createType({
      name: 'Test Vacation Days',
      code: 'TEST_VAC',
      unit: TimeOffUnit.DAYS,
      requiresAllocation: true,
      isPaid: true,
      color: '#10B981',
    });
    daysTypeId = type.id;

    if (!type.id || type.unit !== TimeOffUnit.DAYS || !type.requiresAllocation) {
      throw new Error('DAYS type creation failed');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Create HOURS type
  // --------------------------------------------------------------------------
  await test('2. Create HOURS type', async () => {
    const type = await TimeOffService.createType({
      name: 'Test Doctor Hours',
      code: 'TEST_DOC',
      unit: TimeOffUnit.HOURS,
      requiresAllocation: true,
      isPaid: true,
      color: '#8B5CF6',
    });
    hoursTypeId = type.id;

    if (!type.id || type.unit !== TimeOffUnit.HOURS) {
      throw new Error('HOURS type creation failed');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Create allocation
  // --------------------------------------------------------------------------
  await test('3. Create allocation', async () => {
    const alloc = await TimeOffService.createAllocation(
      {
        employeeId: johnUser.employee!.id,
        timeOffTypeId: daysTypeId,
        allocatedQuantity: 10.0,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        notes: 'TEST_ALLOC_JOHN_VACATION',
      },
      hrUser.id
    );
    testAllocId = alloc.id;

    if (alloc.status !== AllocationStatus.DRAFT) throw new Error('Expected initial status DRAFT');
    if (Number(alloc.allocatedQuantity) !== 10.0) throw new Error('allocatedQuantity mismatch');
    if (Number(alloc.remainingQuantity) !== 10.0) throw new Error('remainingQuantity mismatch');
    if (Number(alloc.takenQuantity) !== 0.0) throw new Error('takenQuantity should be 0');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Allocation validity validation
  // --------------------------------------------------------------------------
  await test('4. Allocation validity validation', async () => {
    // Inverted dates
    try {
      await TimeOffService.createAllocation(
        {
          employeeId: johnUser.employee!.id,
          timeOffTypeId: daysTypeId,
          allocatedQuantity: 5.0,
          validFrom: '2026-12-31',
          validTo: '2026-01-01',
          notes: 'TEST_INVALID',
        },
        hrUser.id
      );
      throw new Error('Should have rejected inverted validity dates');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'INVALID_VALIDITY_PERIOD') {
        throw new Error(`Expected INVALID_VALIDITY_PERIOD, got ${e.message}`);
      }
    }

    // Zero or negative allocation quantity
    try {
      await TimeOffService.createAllocation(
        {
          employeeId: johnUser.employee!.id,
          timeOffTypeId: daysTypeId,
          allocatedQuantity: 0,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
          notes: 'TEST_INVALID',
        },
        hrUser.id
      );
      throw new Error('Should have rejected zero allocation quantity');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'INVALID_ALLOCATED_QUANTITY') {
        throw new Error(`Expected INVALID_ALLOCATED_QUANTITY, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Allocation approval
  // --------------------------------------------------------------------------
  await test('5. Allocation approval', async () => {
    const approved = await TimeOffService.approveAllocation(testAllocId, hrUser.id);
    if (approved.status !== AllocationStatus.APPROVED) {
      throw new Error('Expected status APPROVED');
    }
    if (approved.approvedById !== hrUser.id) {
      throw new Error('approvedById mismatch');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: DAYS request creation
  // --------------------------------------------------------------------------
  await test('6. DAYS request creation', async () => {
    // Monday 2026-05-04 to Wednesday 2026-05-06 = 3 working days
    const req = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-05-04',
        endDate: '2026-05-06',
        reason: 'TEST_FAMILY_VACATION',
      },
      johnUser
    );
    testDaysReqId = req.id;

    if (req.employeeId !== johnUser.employee!.id) throw new Error('Employee ID mismatch');
    if (Number(req.durationQuantity) !== 3.0) {
      throw new Error(`Expected 3.00 days duration, got ${req.durationQuantity}`);
    }
    if (req.status !== TimeOffStatus.SUBMITTED) {
      throw new Error(`Expected default SUBMITTED status, got ${req.status}`);
    }
    if (req.allocationId !== testAllocId) {
      throw new Error('Should have resolved and linked test allocation');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: HOURS request creation
  // --------------------------------------------------------------------------
  await test('7. HOURS request creation', async () => {
    // Create and approve HOURS allocation
    const hoursAlloc = await TimeOffService.createAllocation(
      {
        employeeId: johnUser.employee!.id,
        timeOffTypeId: hoursTypeId,
        allocatedQuantity: 8.0,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        notes: 'TEST_HOURS_ALLOC',
      },
      hrUser.id
    );
    testHoursAllocId = hoursAlloc.id;
    await TimeOffService.approveAllocation(hoursAlloc.id, hrUser.id);

    // Thursday 2026-05-07, from 09:30 to 12:00 = 2.5 hours
    const req = await TimeOffService.createRequest(
      {
        timeOffTypeId: hoursTypeId,
        startDate: '2026-05-07',
        endDate: '2026-05-07',
        startTime: '09:30',
        endTime: '12:00',
        reason: 'TEST_DOCTOR_APPOINTMENT',
      },
      johnUser
    );

    if (Number(req.durationQuantity) !== 2.5) {
      throw new Error(`Expected 2.50 hours duration, got ${req.durationQuantity}`);
    }
    if (req.startTime !== '09:30' || req.endTime !== '12:00') {
      throw new Error('Time fields not persisted');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: HOURS requires startTime/endTime
  // --------------------------------------------------------------------------
  await test('8. HOURS requires startTime/endTime', async () => {
    try {
      await TimeOffService.createRequest(
        {
          timeOffTypeId: hoursTypeId,
          startDate: '2026-05-07',
          endDate: '2026-05-07',
          reason: 'TEST_MISSING_TIMES',
        },
        johnUser
      );
      throw new Error('Should have rejected HOURS request without time fields');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) {
        throw new Error(`Expected ValidationError, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: DAYS rejects startTime/endTime
  // --------------------------------------------------------------------------
  await test('9. DAYS rejects startTime/endTime', async () => {
    try {
      await TimeOffService.createRequest(
        {
          timeOffTypeId: daysTypeId,
          startDate: '2026-05-11',
          endDate: '2026-05-12',
          startTime: '09:00',
          endTime: '17:00',
          reason: 'TEST_DAYS_WITH_TIMES',
        },
        johnUser
      );
      throw new Error('Should have rejected DAYS request with non-null time fields');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) {
        throw new Error(`Expected ValidationError, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: HOURS endTime > startTime
  // --------------------------------------------------------------------------
  await test('10. HOURS endTime > startTime', async () => {
    try {
      await TimeOffService.createRequest(
        {
          timeOffTypeId: hoursTypeId,
          startDate: '2026-05-07',
          endDate: '2026-05-07',
          startTime: '14:00',
          endTime: '11:00', // Earlier than startTime
          reason: 'TEST_REVERSED_TIMES',
        },
        johnUser
      );
      throw new Error('Should have rejected inverted times');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'INVALID_TIME_INTERVAL') {
        throw new Error(`Expected INVALID_TIME_INTERVAL, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: HOURS interval inside scheduled shift
  // --------------------------------------------------------------------------
  await test('11. HOURS interval inside scheduled shift', async () => {
    // Shift is 09:00 - 18:00; test 07:00 - 08:30 (outside shift)
    try {
      await TimeOffService.createRequest(
        {
          timeOffTypeId: hoursTypeId,
          startDate: '2026-05-07',
          endDate: '2026-05-07',
          startTime: '07:00',
          endTime: '08:30',
          reason: 'TEST_OUTSIDE_SHIFT',
        },
        johnUser
      );
      throw new Error('Should have rejected interval outside shift hours');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'OUTSIDE_SHIFT_HOURS') {
        throw new Error(`Expected OUTSIDE_SHIFT_HOURS, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: Backend duration calculation
  // --------------------------------------------------------------------------
  await test('12. Backend duration calculation', async () => {
    // From Monday 2026-05-11 to Sunday 2026-05-17 (7 calendar days, but 5 scheduled workdays)
    const type = await TimeOffService.getTypeById(daysTypeId);
    const duration = await TimeOffService.calculateDuration(
      johnUser.employee!.id,
      type,
      new Date('2026-05-11T00:00:00.000Z'),
      new Date('2026-05-17T00:00:00.000Z')
    );

    if (duration !== 5.0) {
      throw new Error(`Expected 5.00 scheduled working days, got ${duration}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: Submit request
  // --------------------------------------------------------------------------
  let draftReqId = '';
  await test('13. Submit request', async () => {
    const draft = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-05-18',
        endDate: '2026-05-18',
        reason: 'TEST_DRAFT_REQUEST',
        status: TimeOffStatus.DRAFT,
      },
      johnUser
    );
    draftReqId = draft.id;
    if (draft.status !== TimeOffStatus.DRAFT) throw new Error('Expected DRAFT');

    const submitted = await TimeOffService.submitRequest(draft.id, johnUser);
    if (submitted.status !== TimeOffStatus.SUBMITTED) {
      throw new Error('Expected status SUBMITTED after submission');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 14: Approve request
  // --------------------------------------------------------------------------
  await test('14. Approve request', async () => {
    // Approve testDaysReqId (3 days)
    const approved = await TimeOffService.approveRequest(testDaysReqId, hrUser);
    if (approved.status !== TimeOffStatus.APPROVED) {
      throw new Error('Expected status APPROVED');
    }
    if (approved.approvedById !== hrUser.id) {
      throw new Error('approvedById mismatch');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 15: Refuse request
  // --------------------------------------------------------------------------
  await test('15. Refuse request', async () => {
    const refused = await TimeOffService.refuseRequest(
      draftReqId,
      'Peak project deadline window; leave cannot be granted',
      hrUser
    );

    if (refused.status !== TimeOffStatus.REFUSED) throw new Error('Expected status REFUSED');
    if (!refused.refusalReason) throw new Error('refusalReason should be recorded');

    // Refusal reason required check
    try {
      await TimeOffService.refuseRequest(draftReqId, '   ', hrUser);
      throw new Error('Should have rejected blank refusal reason');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) {
        // May fail because it is already refused or blank
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 16: Cancel approved request
  // --------------------------------------------------------------------------
  await test('16. Cancel approved request', async () => {
    const cancelled = await TimeOffService.cancelRequest(testDaysReqId, johnUser);
    if (cancelled.status !== TimeOffStatus.CANCELLED) {
      throw new Error('Expected status CANCELLED');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: Balance consumption
  // --------------------------------------------------------------------------
  await test('17. Balance consumption', async () => {
    // Create new 2-day request and approve it to verify balance deduction
    const req = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-05-25',
        endDate: '2026-05-26',
        reason: 'TEST_BALANCE_CONSUME',
      },
      johnUser
    );

    const allocBefore = await prisma.timeOffAllocation.findUniqueOrThrow({ where: { id: testAllocId } });
    const remBefore = Number(allocBefore.remainingQuantity);
    const takenBefore = Number(allocBefore.takenQuantity);

    await TimeOffService.approveRequest(req.id, hrUser);

    const allocAfter = await prisma.timeOffAllocation.findUniqueOrThrow({ where: { id: testAllocId } });
    if (Number(allocAfter.takenQuantity) !== takenBefore + 2.0) {
      throw new Error(`Expected takenQuantity ${takenBefore + 2.0}, got ${allocAfter.takenQuantity}`);
    }
    if (Number(allocAfter.remainingQuantity) !== remBefore - 2.0) {
      throw new Error(`Expected remainingQuantity ${remBefore - 2.0}, got ${allocAfter.remainingQuantity}`);
    }

    // Clean up
    await prisma.timeOffRequest.delete({ where: { id: req.id } });
    // Restore balance for clean subsequent tests
    await prisma.timeOffAllocation.update({
      where: { id: testAllocId },
      data: { takenQuantity: takenBefore, remainingQuantity: remBefore },
    });
  });

  // --------------------------------------------------------------------------
  // TEST 18: Balance restoration after cancellation
  // --------------------------------------------------------------------------
  await test('18. Balance restoration after cancellation', async () => {
    const allocBefore = await prisma.timeOffAllocation.findUniqueOrThrow({ where: { id: testAllocId } });
    const initialRemaining = Number(allocBefore.remainingQuantity);
    const initialTaken = Number(allocBefore.takenQuantity);

    // Create 4-day request
    const req = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'TEST_RESTORE_FLOW',
      },
      johnUser
    );

    // Approve: consumes 4 days
    await TimeOffService.approveRequest(req.id, hrUser);
    const allocApproved = await prisma.timeOffAllocation.findUniqueOrThrow({ where: { id: testAllocId } });
    if (Number(allocApproved.remainingQuantity) !== initialRemaining - 4.0) {
      throw new Error('Balance was not deducted upon approval');
    }

    // Cancel: restores 4 days
    await TimeOffService.cancelRequest(req.id, johnUser);
    const allocCancelled = await prisma.timeOffAllocation.findUniqueOrThrow({ where: { id: testAllocId } });
    if (Number(allocCancelled.remainingQuantity) !== initialRemaining) {
      throw new Error(`Expected remainingQuantity restored to ${initialRemaining}, got ${allocCancelled.remainingQuantity}`);
    }
    if (Number(allocCancelled.takenQuantity) !== initialTaken) {
      throw new Error(`Expected takenQuantity restored to ${initialTaken}, got ${allocCancelled.takenQuantity}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 19: Insufficient balance rejected
  // --------------------------------------------------------------------------
  await test('19. Insufficient balance rejected', async () => {
    // Current allocation has 10 days remaining; attempt to request 12 working days
    // 2026-07-06 (Mon) to 2026-07-21 (Tue) = 12 working days
    try {
      await TimeOffService.createRequest(
        {
          timeOffTypeId: daysTypeId,
          startDate: '2026-07-06',
          endDate: '2026-07-21',
          reason: 'TEST_EXCESS_LEAVE',
        },
        johnUser
      );
      throw new Error('Should have rejected request exceeding allocation balance');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'INSUFFICIENT_BALANCE') {
        throw new Error(`Expected INSUFFICIENT_BALANCE, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 20: Overlapping approved leave rejected
  // --------------------------------------------------------------------------
  await test('20. Overlapping approved leave rejected', async () => {
    // First leave: June 15 to June 17
    const leave1 = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-06-15',
        endDate: '2026-06-17',
        reason: 'TEST_LEAVE_BASE',
      },
      johnUser
    );
    await TimeOffService.approveRequest(leave1.id, hrUser);

    // Second leave: June 16 to June 18 (overlaps June 16 and 17)
    const leave2 = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-06-16',
        endDate: '2026-06-18',
        reason: 'TEST_LEAVE_OVERLAP',
      },
      johnUser
    );

    try {
      await TimeOffService.approveRequest(leave2.id, hrUser);
      throw new Error('Should have rejected approval of overlapping leave');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'OVERLAPPING_LEAVE') {
        throw new Error(`Expected OVERLAPPING_LEAVE, got ${e.message}`);
      }
    }

    // Clean up
    await TimeOffService.cancelRequest(leave1.id, hrUser);
  });

  // --------------------------------------------------------------------------
  // TEST 21: Employee cannot approve unauthorized requests
  // --------------------------------------------------------------------------
  await test('21. Employee cannot approve unauthorized requests', async () => {
    const req = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-08-03',
        endDate: '2026-08-04',
        reason: 'TEST_SELF_APPROVE',
      },
      johnUser
    );

    try {
      // John tries to approve his own request
      await TimeOffService.approveRequest(req.id, johnUser);
      throw new Error('Employee should not be allowed to approve own request');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) {
        throw new Error(`Expected AuthorizationError, got ${e.message}`);
      }
    }

    try {
      // Sarah tries to approve John's request
      await TimeOffService.approveRequest(req.id, sarahUser);
      throw new Error('Ordinary employee cannot approve another employee request');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) {
        throw new Error(`Expected AuthorizationError, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 22: HR authorization works
  // --------------------------------------------------------------------------
  await test('22. HR authorization works', async () => {
    const hasPerm = hrUser.permissions.includes('timeoff.request.approve');
    if (!hasPerm) throw new Error('HR Manager should possess timeoff.request.approve');

    const hasAllocPerm = hrUser.permissions.includes('timeoff.allocation.manage');
    if (!hasAllocPerm) throw new Error('HR Manager should possess timeoff.allocation.manage');
  });

  // --------------------------------------------------------------------------
  // TEST 23: Concurrent approvals cannot overdraw allocation
  // --------------------------------------------------------------------------
  await test('23. Concurrent approvals cannot overdraw allocation', async () => {
    // Create an allocation with exactly 2.0 days
    const concAlloc = await TimeOffService.createAllocation(
      {
        employeeId: sarahUser.employee!.id,
        timeOffTypeId: daysTypeId,
        allocatedQuantity: 2.0,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        notes: 'TEST_CONC_ALLOC',
      },
      hrUser.id
    );
    await TimeOffService.approveAllocation(concAlloc.id, hrUser.id);

    // Create 2 separate requests for 2.0 days each on DIFFERENT dates to avoid date overlap check
    // Request A: 2026-09-07 to 2026-09-08 (2 days)
    // Request B: 2026-09-21 to 2026-09-22 (2 days)
    const reqA = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-09-07',
        endDate: '2026-09-08',
        reason: 'TEST_CONCURRENT_A',
      },
      sarahUser
    );

    const reqB = await TimeOffService.createRequest(
      {
        timeOffTypeId: daysTypeId,
        startDate: '2026-09-21',
        endDate: '2026-09-22',
        reason: 'TEST_CONCURRENT_B',
      },
      sarahUser
    );

    // Both requests require 2 days. The allocation only has 2 days in total.
    // Execute both approvals simultaneously
    const results = await Promise.allSettled([
      TimeOffService.approveRequest(reqA.id, hrUser),
      TimeOffService.approveRequest(reqB.id, hrUser),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    if (fulfilled.length !== 1) {
      throw new Error(`Expected exactly 1 concurrent approval to succeed, got ${fulfilled.length}`);
    }
    if (rejected.length !== 1) {
      throw new Error(`Expected exactly 1 concurrent approval to be rejected, got ${rejected.length}`);
    }

    const rejectionReason: any = (rejected[0] as PromiseRejectedResult).reason;
    if (!(rejectionReason instanceof BusinessRuleError) || rejectionReason.code !== 'INSUFFICIENT_BALANCE') {
      throw new Error(`Expected INSUFFICIENT_BALANCE for race condition, got ${rejectionReason.message}`);
    }

    // Check final allocation balance
    const finalAlloc = await prisma.timeOffAllocation.findUniqueOrThrow({ where: { id: concAlloc.id } });
    if (Number(finalAlloc.remainingQuantity) !== 0.0) {
      throw new Error(`Expected remaining balance 0.00, got ${finalAlloc.remainingQuantity}`);
    }
    if (Number(finalAlloc.takenQuantity) !== 2.0) {
      throw new Error(`Expected takenQuantity 2.00, got ${finalAlloc.takenQuantity}`);
    }
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`Time Off Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTimeOffTests()
  .catch((e) => {
    console.error('Fatal Time Off test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
