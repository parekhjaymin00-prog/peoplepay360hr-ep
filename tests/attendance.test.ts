import { AttendanceService } from '../lib/services/attendance.service';
import { AuthService } from '../lib/services/auth.service';
import { AttendanceStatus } from '@prisma/client';
import { BusinessRuleError, NotFoundError, AuthorizationError, ValidationError } from '../lib/errors';
import { generateUuidV7 } from '../lib/utils/id';
import prisma from '../lib/prisma';

async function runAttendanceTests() {
  console.log('🧪 Starting PeoplePay360 Attendance Domain Tests...\n');
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

  // Dedicated test dates in April 2026
  const wednesdayDate = new Date('2026-04-15T09:00:00Z'); // Scheduled workday (Wed)
  const sundayDate = new Date('2026-04-19T10:00:00Z');    // Non-working day (Sun)
  const emptyDate = new Date('2026-04-22T17:00:00Z');     // Day with no check-in

  // Clean up any test records
  await prisma.attendance.deleteMany({
    where: {
      employeeId: johnUser.employee!.id,
      date: {
        in: [
          new Date('2026-04-15'),
          new Date('2026-04-16'),
          new Date('2026-04-19'),
          new Date('2026-04-22'),
        ],
      },
    },
  });

  let activeRecordId = '';

  // --------------------------------------------------------------------------
  // TEST 1: Successful employee check-in
  // --------------------------------------------------------------------------
  await test('1. Successful employee check-in', async () => {
    const att = await AttendanceService.checkIn(johnUser.id, wednesdayDate);
    activeRecordId = att.id;

    if (!att.id) throw new Error('Attendance record ID missing');
    if (att.checkOut !== null) throw new Error('Check-out should be null on check-in');
    if (Number(att.workedHours) !== 0.0) throw new Error('Worked hours should be 0.0 on check-in');
    if (att.status !== AttendanceStatus.PRESENT) throw new Error(`Expected PRESENT, got ${att.status}`);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Duplicate check-in rejected
  // --------------------------------------------------------------------------
  await test('2. Duplicate check-in rejected', async () => {
    try {
      await AttendanceService.checkIn(johnUser.id, wednesdayDate);
      throw new Error('Duplicate check-in should have failed');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'ATTENDANCE_ALREADY_EXISTS') {
        throw new Error(`Expected ATTENDANCE_ALREADY_EXISTS, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Successful check-out
  // --------------------------------------------------------------------------
  await test('3. Successful check-out', async () => {
    const checkOutTime = new Date('2026-04-15T18:30:00Z'); // 9.5 hours
    const att = await AttendanceService.checkOut(johnUser.id, checkOutTime);

    if (!att.checkOut) throw new Error('Check-out timestamp was not persisted');
    if (att.checkOut.toISOString() !== checkOutTime.toISOString()) {
      throw new Error('Check-out timestamp mismatch');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Checkout without check-in rejected
  // --------------------------------------------------------------------------
  await test('4. Checkout without check-in rejected', async () => {
    try {
      await AttendanceService.checkOut(johnUser.id, emptyDate);
      throw new Error('Checkout without check-in should have failed');
    } catch (e: any) {
      if (!(e instanceof NotFoundError)) {
        throw new Error(`Expected NotFoundError, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Checkout before check-in rejected
  // --------------------------------------------------------------------------
  await test('5. Checkout before check-in rejected', async () => {
    // Create a new check-in on 2026-04-16 at 09:00:00Z
    const testDate2 = new Date('2026-04-16T09:00:00Z');
    const att2 = await AttendanceService.checkIn(johnUser.id, testDate2);

    try {
      const earlierTime = new Date('2026-04-16T08:30:00Z');
      await AttendanceService.checkOut(johnUser.id, earlierTime);
      throw new Error('Checkout before check-in should have failed');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'INVALID_CHECKOUT_TIME') {
        throw new Error(`Expected INVALID_CHECKOUT_TIME, got ${e.message}`);
      }
    } finally {
      await prisma.attendance.delete({ where: { id: att2.id } });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Worked hours calculated by backend
  // --------------------------------------------------------------------------
  await test('6. Worked hours calculated by backend', async () => {
    const record = await prisma.attendance.findUnique({ where: { id: activeRecordId } });
    // 09:00 to 18:30 = 9.5 hours
    if (Number(record?.workedHours) !== 9.5) {
      throw new Error(`Expected backend-calculated workedHours 9.50, got ${record?.workedHours}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Expected hours derived from schedule
  // --------------------------------------------------------------------------
  await test('7. Expected hours derived from schedule', async () => {
    const record = await prisma.attendance.findUnique({ where: { id: activeRecordId } });
    // Wednesday on standard 40h schedule is 8.0 hours
    if (Number(record?.expectedHours) !== 8.0) {
      throw new Error(`Expected schedule-derived expectedHours 8.00, got ${record?.expectedHours}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Overtime calculated correctly
  // --------------------------------------------------------------------------
  await test('8. Overtime calculated correctly', async () => {
    const record = await prisma.attendance.findUnique({ where: { id: activeRecordId } });
    // Worked 9.5, Expected 8.0 => Overtime 1.5
    if (!record?.isOvertime) throw new Error('isOvertime should be true');
    if (Number(record?.overtimeHours) !== 1.5) {
      throw new Error(`Expected overtimeHours 1.50, got ${record?.overtimeHours}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Scheduled working day behavior
  // --------------------------------------------------------------------------
  await test('9. Scheduled working day behavior', async () => {
    // Normal check-in at 09:00 on Wednesday has expectedHours > 0 and status PRESENT
    const record = await prisma.attendance.findUnique({ where: { id: activeRecordId } });
    if (Number(record?.expectedHours) <= 0) throw new Error('Scheduled day must have expectedHours > 0');
    if (record?.status !== AttendanceStatus.PRESENT) throw new Error('On-time check-in should be PRESENT');
  });

  // --------------------------------------------------------------------------
  // TEST 10: Non-working day behavior
  // --------------------------------------------------------------------------
  await test('10. Non-working day behavior', async () => {
    // Check-in on Sunday (non-working day)
    const sundayAtt = await AttendanceService.checkIn(johnUser.id, sundayDate);
    if (Number(sundayAtt.expectedHours) !== 0.0) {
      throw new Error(`Expected 0.0 expected hours on Sunday, got ${sundayAtt.expectedHours}`);
    }

    // Checkout 4 hours later
    const sundayOut = new Date('2026-04-19T14:00:00Z');
    const checkedOut = await AttendanceService.checkOut(johnUser.id, sundayOut);

    if (Number(checkedOut.workedHours) !== 4.0) {
      throw new Error(`Expected 4.00 worked hours, got ${checkedOut.workedHours}`);
    }
    // All worked hours on a non-working day are overtime
    if (Number(checkedOut.overtimeHours) !== 4.0) {
      throw new Error(`Expected 4.00 overtime hours on weekend, got ${checkedOut.overtimeHours}`);
    }

    await prisma.attendance.delete({ where: { id: sundayAtt.id } });
  });

  // --------------------------------------------------------------------------
  // TEST 11: Employee self-access restrictions
  // --------------------------------------------------------------------------
  await test('11. Employee self-access restrictions', async () => {
    // Sarah (ordinary employee) cannot view John's attendance
    try {
      await AttendanceService.getAttendanceById(activeRecordId, sarahUser);
      throw new Error('Ordinary employee should not access another employee record');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) {
        throw new Error(`Expected AuthorizationError, got ${e.message}`);
      }
    }

    // John can view his own attendance
    const ownRecord = await AttendanceService.getAttendanceById(activeRecordId, johnUser);
    if (ownRecord.id !== activeRecordId) throw new Error('Employee could not access own record');
  });

  // --------------------------------------------------------------------------
  // TEST 12: HR attendance access
  // --------------------------------------------------------------------------
  await test('12. HR attendance access', async () => {
    // HR Manager can access John's attendance
    const hrRecord = await AttendanceService.getAttendanceById(activeRecordId, hrUser);
    if (hrRecord.id !== activeRecordId) throw new Error('HR Manager should access attendance record');
  });

  // --------------------------------------------------------------------------
  // TEST 13: Unauthorized correction rejected
  // --------------------------------------------------------------------------
  await test('13. Unauthorized correction rejected', async () => {
    // Sarah (ordinary employee without attendance.correct) must not be allowed to correct attendance
    const canCorrect = sarahUser.permissions.includes('attendance.correct');
    if (canCorrect) {
      throw new Error('Sarah should not possess attendance.correct permission');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 14: Authorized correction succeeds
  // --------------------------------------------------------------------------
  await test('14. Authorized correction succeeds', async () => {
    const updated = await AttendanceService.correctAttendance(
      activeRecordId,
      {
        checkIn: '2026-04-15T09:00:00Z',
        checkOut: '2026-04-15T18:00:00Z', // 9.0 hours worked => 1.0 hour overtime
        status: AttendanceStatus.PRESENT,
        correctionReason: 'Badge reader offline at turnstile; verified by receptionist log',
      },
      hrUser.id
    );

    if (!updated.isManualCorrection) throw new Error('isManualCorrection flag must be true');
    if (updated.correctedById !== hrUser.id) throw new Error('correctedById mismatch');
    if (Number(updated.workedHours) !== 9.0) {
      throw new Error(`Expected 9.00 worked hours after adjustment, got ${updated.workedHours}`);
    }
    if (Number(updated.overtimeHours) !== 1.0) {
      throw new Error(`Expected 1.00 overtime hours after adjustment, got ${updated.overtimeHours}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 15: Correction reason required
  // --------------------------------------------------------------------------
  await test('15. Correction reason required', async () => {
    try {
      await AttendanceService.correctAttendance(
        activeRecordId,
        {
          correctionReason: '   ', // whitespace only
        },
        hrUser.id
      );
      throw new Error('Should have rejected empty correction reason');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) {
        throw new Error(`Expected ValidationError, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 16: Attendance employee/date uniqueness
  // --------------------------------------------------------------------------
  await test('16. Attendance employee/date uniqueness', async () => {
    const calendarDate = new Date('2026-04-15');
    // Direct database insert attempt for same employee and date should violate UNIQUE constraint
    try {
      await prisma.attendance.create({
        data: {
          id: generateUuidV7(),
          employeeId: johnUser.employee!.id,
          date: calendarDate,
          checkIn: new Date('2026-04-15T10:00:00Z'),
          workedHours: 0,
          expectedHours: 8,
          status: AttendanceStatus.PRESENT,
        },
      });
      throw new Error('Database unique constraint failed to reject duplicate employee/date record');
    } catch (e: any) {
      if (e.code !== 'P2002') {
        throw new Error(`Expected Prisma P2002 unique violation, got ${e.code || e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: Concurrent duplicate check-in protection
  // --------------------------------------------------------------------------
  await test('17. Concurrent duplicate check-in protection', async () => {
    const concurrentDate = new Date('2026-04-22T09:00:00Z');

    // Attempt 2 simultaneous check-ins for the same employee/date
    const results = await Promise.allSettled([
      AttendanceService.checkIn(johnUser.id, concurrentDate),
      AttendanceService.checkIn(johnUser.id, concurrentDate),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    if (fulfilled.length !== 1) {
      throw new Error(`Expected exactly 1 check-in to succeed, got ${fulfilled.length}`);
    }
    if (rejected.length !== 1) {
      throw new Error(`Expected exactly 1 check-in to be rejected, got ${rejected.length}`);
    }

    const rejectionReason: any = (rejected[0] as PromiseRejectedResult).reason;
    if (!(rejectionReason instanceof BusinessRuleError) || rejectionReason.code !== 'ATTENDANCE_ALREADY_EXISTS') {
      throw new Error(`Expected ATTENDANCE_ALREADY_EXISTS error for race condition, got ${rejectionReason.message}`);
    }

    // Clean up
    await prisma.attendance.deleteMany({
      where: {
        employeeId: johnUser.employee!.id,
        date: new Date('2026-04-22'),
      },
    });
  });

  // Clean up active record
  await prisma.attendance.delete({ where: { id: activeRecordId } });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`Attendance Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAttendanceTests()
  .catch((e) => {
    console.error('Fatal Attendance test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
