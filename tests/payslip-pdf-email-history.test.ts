import { NextRequest } from 'next/server';
import { PayrunService } from '../lib/services/payrun.service';
import { PayslipPdfService } from '../lib/payroll/payslip-pdf.service';
import { EmailService, EmailOptions } from '../lib/services/email.service';
import { AuthService } from '../lib/services/auth.service';
import { requireAuth, requirePermission } from '../lib/auth/guards';
import { GET as getPayslipPdfRoute } from '../app/api/payroll/payslips/[id]/pdf/route';
import {
  PayrunStatus,
  PayslipStatus,
  EmailDeliveryStatus,
  ContractStatus,
} from '@prisma/client';
import { BusinessRuleError, NotFoundError, AuthorizationError, ValidationError } from '../lib/errors';
import prisma from '../lib/prisma';

// Helper to decode text characters from uncompressed PDFKit streams
function extractTextFromPdf(buf: Buffer): string {
  const content = buf.toString('latin1');
  const matches = content.match(/\[(.*?)\]\s*TJ/g) || [];
  let fullText = '';
  for (const m of matches) {
    const hexParts = m.match(/<([0-9a-fA-F]+)>/g) || [];
    for (const h of hexParts) {
      fullText += Buffer.from(h.slice(1, -1), 'hex').toString('latin1');
    }
  }
  return fullText;
}

async function runPayslipPdfEmailHistoryTests() {
  console.log('🧪 Starting PeoplePay360 Payslip PDF, Email & History Tests...\n');
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

  // Load test user sessions
  const johnSession = await AuthService.login('john.doe@peoplepay360.com', 'Password123!');
  const sarahSession = await AuthService.login('sarah.smith@peoplepay360.com', 'Password123!');
  const payrollMgrSession = await AuthService.login('payroll.manager@peoplepay360.com', 'Password123!');
  const payrollUserSession = await AuthService.login('payroll.user@peoplepay360.com', 'Password123!');

  const johnUser = johnSession.user;
  const sarahUser = sarahSession.user;
  const payrollMgr = payrollMgrSession.user;
  const payrollUser = payrollUserSession.user;

  // Clean up any existing Phase 13 test records
  await prisma.payrunEmployee.deleteMany({
    where: { payrun: { name: { startsWith: 'TEST_PHASE13_' } } },
  });
  await prisma.payslipLine.deleteMany({
    where: { payslip: { payrun: { name: { startsWith: 'TEST_PHASE13_' } } } },
  });
  await prisma.payslip.deleteMany({
    where: { payrun: { name: { startsWith: 'TEST_PHASE13_' } } },
  });
  await prisma.payrun.deleteMany({
    where: { name: { startsWith: 'TEST_PHASE13_' } },
  });

  const structure = await prisma.salaryStructure.findFirstOrThrow({
    where: { code: 'REG_FULLTIME_STRUCTURE' },
  });

  // Create and compute a test payrun with both John and Sarah in November 2026
  const payrun = await PayrunService.createPayrun(
    {
      name: 'TEST_PHASE13_PAYRUN',
      salaryStructureId: structure.id,
      periodStartDate: '2026-11-01',
      periodEndDate: '2026-11-30',
      employeeIds: [johnUser.employee!.id, sarahUser.employee!.id],
      notes: 'Phase 13 PDF, Email & History verification run',
    },
    payrollMgr
  );

  const computedPayrun = await PayrunService.computePayrun(payrun.id, payrollMgr);

  const johnPayslip = await prisma.payslip.findFirstOrThrow({
    where: { payrunId: computedPayrun.id, employeeId: johnUser.employee!.id },
    include: { lines: { orderBy: { sequence: 'asc' } } },
  });

  const sarahPayslip = await prisma.payslip.findFirstOrThrow({
    where: { payrunId: computedPayrun.id, employeeId: sarahUser.employee!.id },
    include: { lines: { orderBy: { sequence: 'asc' } } },
  });

  // --------------------------------------------------------------------------
  // TEST 1: authorized payroll user can access payslip
  // --------------------------------------------------------------------------
  await test('1. authorized payroll user can access payslip', async () => {
    const fetchedByManager = await PayrunService.getPayslipById(johnPayslip.id, payrollMgr);
    if (!fetchedByManager || fetchedByManager.id !== johnPayslip.id) {
      throw new Error('Payroll manager failed to retrieve payslip');
    }

    const fetchedByUser = await PayrunService.getPayslipById(johnPayslip.id, payrollUser);
    if (!fetchedByUser || fetchedByUser.id !== johnPayslip.id) {
      throw new Error('Payroll user failed to retrieve payslip');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: employee can access own payslip
  // --------------------------------------------------------------------------
  await test('2. employee can access own payslip', async () => {
    const fetched = await PayrunService.getPayslipById(johnPayslip.id, johnUser);
    if (!fetched || fetched.id !== johnPayslip.id) {
      throw new Error('Employee failed to retrieve their own payslip');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: employee cannot access another employee payslip
  // --------------------------------------------------------------------------
  await test('3. employee cannot access another employee payslip', async () => {
    try {
      await PayrunService.getPayslipById(sarahPayslip.id, johnUser);
      throw new Error('Should have blocked cross-employee payslip access');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: employee can access own payslip history
  // --------------------------------------------------------------------------
  await test('4. employee can access own payslip history', async () => {
    const history = await PayrunService.listPayslips(undefined, johnUser);
    if (history.length === 0) {
      throw new Error('Expected at least one payslip in employee history');
    }
    const hasOtherEmployee = history.some((p) => p.employeeId !== johnUser.employee!.id);
    if (hasOtherEmployee) {
      throw new Error('Payslip history leaked another employee records to self-service user');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: employee cannot access global payroll history
  // --------------------------------------------------------------------------
  await test('5. employee cannot access global payroll history', async () => {
    try {
      await PayrunService.listPayslips({ employeeId: sarahUser.employee!.id }, johnUser);
      throw new Error('Employee was able to query another employee payslip history');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) throw e;
    }

    // Verify employee cannot list global payruns
    const req = new NextRequest('http://localhost:3000/api/payroll/payruns', {
      headers: { Authorization: `Bearer ${johnSession.token}` },
    });
    try {
      await requirePermission(req, 'payroll.payrun.read');
      throw new Error('Employee should not satisfy payroll.payrun.read');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: PDF endpoint returns application/pdf
  // --------------------------------------------------------------------------
  let pdfBuffer: Buffer = Buffer.alloc(0);
  await test('6. PDF endpoint returns application/pdf', async () => {
    const req = new NextRequest(`http://localhost:3000/api/payroll/payslips/${johnPayslip.id}/pdf`, {
      headers: { Authorization: `Bearer ${johnSession.token}` },
    });
    const res = await getPayslipPdfRoute(req, { params: Promise.resolve({ id: johnPayslip.id }) });

    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200 from PDF endpoint, got ${res.status}`);
    }
    const contentType = res.headers.get('content-type');
    if (contentType !== 'application/pdf') {
      throw new Error(`Expected application/pdf, got ${contentType}`);
    }

    const arrayBuf = await res.arrayBuffer();
    pdfBuffer = Buffer.from(arrayBuf);
    const magic = pdfBuffer.subarray(0, 5).toString('ascii');
    if (magic !== '%PDF-') {
      throw new Error(`Expected valid PDF starting with %PDF-, got ${magic}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: PDF contains frozen employee snapshot
  // --------------------------------------------------------------------------
  await test('7. PDF contains frozen employee snapshot', async () => {
    const text = extractTextFromPdf(pdfBuffer);
    if (!text.includes(johnPayslip.employeeNumberSnapshot)) {
      throw new Error(`PDF missing employee number snapshot: ${johnPayslip.employeeNumberSnapshot}`);
    }
    if (!text.includes(johnPayslip.employeeNameSnapshot)) {
      throw new Error(`PDF missing employee name snapshot: ${johnPayslip.employeeNameSnapshot}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: PDF contains frozen contract snapshot
  // --------------------------------------------------------------------------
  await test('8. PDF contains frozen contract snapshot', async () => {
    const text = extractTextFromPdf(pdfBuffer);
    if (!text.includes(johnPayslip.contractNumberSnapshot)) {
      throw new Error(`PDF missing contract number snapshot: ${johnPayslip.contractNumberSnapshot}`);
    }
    if (!text.includes(johnPayslip.contractWageTypeSnapshot)) {
      throw new Error(`PDF missing contract wage type snapshot: ${johnPayslip.contractWageTypeSnapshot}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: PDF contains payslip financial totals
  // --------------------------------------------------------------------------
  await test('9. PDF contains payslip financial totals', async () => {
    const text = extractTextFromPdf(pdfBuffer);
    const netFormatted = Number(johnPayslip.netSalary).toFixed(2);
    const basicFormatted = Number(johnPayslip.basicSalary).toFixed(2);

    if (!text.includes(netFormatted)) {
      throw new Error(`PDF missing net salary total: ${netFormatted}`);
    }
    if (!text.includes(basicFormatted)) {
      throw new Error(`PDF missing basic salary total: ${basicFormatted}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: PDF contains payslip lines
  // --------------------------------------------------------------------------
  await test('10. PDF contains payslip lines', async () => {
    const text = extractTextFromPdf(pdfBuffer);
    for (const line of johnPayslip.lines) {
      if (!text.includes(line.ruleCode)) {
        throw new Error(`PDF missing payslip ruleCode: ${line.ruleCode}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: PDF generation does not recalculate payroll
  // --------------------------------------------------------------------------
  await test('11. PDF generation does not recalculate payroll', async () => {
    const before = await prisma.payslip.findUniqueOrThrow({
      where: { id: johnPayslip.id },
      include: { lines: true },
    });

    // Generate PDF multiple times
    await PayslipPdfService.generatePayslipPdf(before as any);
    await PayslipPdfService.generatePayslipPdf(before as any);

    const after = await prisma.payslip.findUniqueOrThrow({
      where: { id: johnPayslip.id },
      include: { lines: true },
    });

    if (
      Number(before.grossSalary) !== Number(after.grossSalary) ||
      Number(before.netSalary) !== Number(after.netSalary) ||
      Number(before.totalDeductions) !== Number(after.totalDeductions) ||
      before.lines.length !== after.lines.length
    ) {
      throw new Error('PDF generation mutated payslip financial figures');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: changed employee data does not alter historical PDF snapshot
  // --------------------------------------------------------------------------
  await test('12. changed employee data does not alter historical PDF snapshot', async () => {
    // Temporarily mutate live employee name in the Employee table
    await prisma.employee.update({
      where: { id: johnUser.employee!.id },
      data: { firstName: 'JonathanMutated' },
    });

    try {
      const regeneratedPdf = await PayslipPdfService.generatePayslipPdf(johnPayslip as any);
      const text = extractTextFromPdf(regeneratedPdf);

      // Must still contain the frozen historical snapshot name
      if (!text.includes(johnPayslip.employeeNameSnapshot)) {
        throw new Error('Historical PDF lost snapshot employee name after Employee table modification');
      }
      if (text.includes('JonathanMutated')) {
        throw new Error('Historical PDF leaked newly modified Employee name instead of frozen snapshot');
      }
    } finally {
      // Revert employee name
      await prisma.employee.update({
        where: { id: johnUser.employee!.id },
        data: { firstName: 'John' },
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: changed salary rule does not alter historical PDF snapshot
  // --------------------------------------------------------------------------
  await test('13. changed salary rule does not alter historical PDF snapshot', async () => {
    const rule = await prisma.salaryRule.findFirstOrThrow({ where: { code: 'BASIC' } });
    const originalName = rule.name;

    await prisma.salaryRule.update({
      where: { id: rule.id },
      data: { name: 'MUTATED_BASIC_NAME' },
    });

    try {
      const refreshedPayslip = await prisma.payslip.findUniqueOrThrow({
        where: { id: johnPayslip.id },
        include: { lines: true },
      });
      const basicLine = refreshedPayslip.lines.find((l) => l.ruleCode === 'BASIC')!;

      if (basicLine.ruleName === 'MUTATED_BASIC_NAME') {
        throw new Error('Historical payslip line mutated when SalaryRule was edited');
      }
      if (basicLine.ruleName !== 'Basic Salary') {
        throw new Error(`Expected frozen ruleName "Basic Salary", got "${basicLine.ruleName}"`);
      }
    } finally {
      await prisma.salaryRule.update({
        where: { id: rule.id },
        data: { name: originalName },
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 14: missing employee email handled correctly
  // --------------------------------------------------------------------------
  await test('14. missing employee email handled correctly', async () => {
    const originalEmail = sarahUser.email;
    await prisma.employee.update({
      where: { id: sarahUser.employee!.id },
      data: { email: '' },
    });

    try {
      await EmailService.sendPayslipEmail(sarahPayslip.id, payrollMgr);
      throw new Error('Should have thrown error when employee email is missing');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'EMPLOYEE_EMAIL_MISSING') throw e;

      const p = await prisma.payslip.findUniqueOrThrow({ where: { id: sarahPayslip.id } });
      if (p.emailDeliveryStatus !== EmailDeliveryStatus.FAILED) {
        throw new Error(`Expected emailDeliveryStatus FAILED, got ${p.emailDeliveryStatus}`);
      }
    } finally {
      await prisma.employee.update({
        where: { id: sarahUser.employee!.id },
        data: { email: originalEmail },
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 15: email service does not pretend success without configuration
  // --------------------------------------------------------------------------
  await test('15. email service does not pretend success without configuration', async () => {
    EmailService.setMockTransport(null);
    const oldHost = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;

    try {
      await EmailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
      });
      throw new Error('Should have thrown EMAIL_NOT_CONFIGURED error');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'EMAIL_NOT_CONFIGURED') throw e;
    } finally {
      if (oldHost) process.env.SMTP_HOST = oldHost;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 16: single payslip email authorization works
  // --------------------------------------------------------------------------
  await test('16. single payslip email authorization works', async () => {
    const dispatchedEmails: EmailOptions[] = [];
    EmailService.setMockTransport(async (opts) => {
      dispatchedEmails.push(opts);
      return { messageId: 'mock-msg-id-1', accepted: [opts.to] };
    });

    // Employee cannot trigger payslip email
    try {
      await EmailService.sendPayslipEmail(johnPayslip.id, johnUser);
      throw new Error('Employee should not be authorized to dispatch payslip emails');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) throw e;
    }

    // Payroll manager succeeds
    const result = await EmailService.sendPayslipEmail(johnPayslip.id, payrollMgr);
    if (result.status !== 'SENT') {
      throw new Error(`Expected status SENT, got ${result.status}`);
    }
    if (dispatchedEmails.length !== 1) {
      throw new Error(`Expected 1 dispatched email, got ${dispatchedEmails.length}`);
    }
    if (!dispatchedEmails[0].attachments || dispatchedEmails[0].attachments.length !== 1) {
      throw new Error('Email missing PDF attachment');
    }

    const updatedPayslip = await prisma.payslip.findUniqueOrThrow({ where: { id: johnPayslip.id } });
    if (updatedPayslip.emailDeliveryStatus !== EmailDeliveryStatus.SENT || !updatedPayslip.emailSentAt) {
      throw new Error('Payslip email delivery status or timestamp was not updated');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: bulk email requires payroll authorization
  // --------------------------------------------------------------------------
  await test('17. bulk email requires payroll authorization', async () => {
    try {
      await EmailService.sendBulkPayrunEmails(payrun.id, johnUser);
      throw new Error('Unauthorized employee was able to trigger bulk emails');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 18: bulk email sends each employee's own payslip
  // --------------------------------------------------------------------------
  await test('18. bulk email sends each employee\'s own payslip', async () => {
    const captured: EmailOptions[] = [];
    EmailService.setMockTransport(async (opts) => {
      captured.push(opts);
      return { messageId: 'mock-bulk-id', accepted: [opts.to] };
    });

    await EmailService.sendBulkPayrunEmails(payrun.id, payrollMgr);

    // Should have sent 2 emails: one to John, one to Sarah
    if (captured.length !== 2) {
      throw new Error(`Expected 2 emails sent in bulk, got ${captured.length}`);
    }

    const johnEmail = captured.find((e) => e.to === 'john.doe@peoplepay360.com');
    const sarahEmail = captured.find((e) => e.to === 'sarah.smith@peoplepay360.com');

    if (!johnEmail || !sarahEmail) {
      throw new Error('Did not send dedicated payslip emails to both employees');
    }

    // Verify attachments belong to the respective employees
    const johnFilename = johnEmail.attachments![0].filename;
    const sarahFilename = sarahEmail.attachments![0].filename;

    if (!johnFilename.includes(johnPayslip.payslipNumber)) {
      throw new Error(`John received wrong payslip attachment: ${johnFilename}`);
    }
    if (!sarahFilename.includes(sarahPayslip.payslipNumber)) {
      throw new Error(`Sarah received wrong payslip attachment: ${sarahFilename}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 19: bulk email returns per-payslip success/failure
  // --------------------------------------------------------------------------
  await test('19. bulk email returns per-payslip success/failure', async () => {
    EmailService.setMockTransport(async () => ({ messageId: 'mock-1', accepted: ['test'] }));

    const res = await EmailService.sendBulkPayrunEmails(payrun.id, payrollMgr);

    if (res.total !== 2 || res.sent !== 2 || res.failed !== 0) {
      throw new Error(`Unexpected bulk result summary: total=${res.total}, sent=${res.sent}, failed=${res.failed}`);
    }
    if (res.results.length !== 2) {
      throw new Error(`Expected 2 items in results array, got ${res.results.length}`);
    }
    if (!res.results.every((r) => r.status === 'SENT')) {
      throw new Error('Expected all results to have SENT status');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 20: one failed email does not mark all successful
  // --------------------------------------------------------------------------
  await test('20. one failed email does not mark all successful', async () => {
    // Make transport fail specifically for Sarah
    EmailService.setMockTransport(async (opts) => {
      if (opts.to === 'sarah.smith@peoplepay360.com') {
        throw new Error('SMTP connection timed out for recipient');
      }
      return { messageId: 'mock-ok', accepted: [opts.to] };
    });

    const res = await EmailService.sendBulkPayrunEmails(payrun.id, payrollMgr);

    if (res.total !== 2) throw new Error(`Expected total 2, got ${res.total}`);
    if (res.sent !== 1) throw new Error(`Expected sent 1, got ${res.sent}`);
    if (res.failed !== 1) throw new Error(`Expected failed 1, got ${res.failed}`);

    const johnRes = res.results.find((r) => r.email === 'john.doe@peoplepay360.com');
    const sarahRes = res.results.find((r) => r.email === 'sarah.smith@peoplepay360.com');

    if (!johnRes || johnRes.status !== 'SENT') {
      throw new Error('John email should have succeeded');
    }
    if (!sarahRes || sarahRes.status !== 'FAILED') {
      throw new Error('Sarah email should have failed');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 21: PDF access after payroll finalization works
  // --------------------------------------------------------------------------
  await test('21. PDF access after payroll finalization works', async () => {
    // Transition COMPUTED -> VALIDATED -> PAID
    await PayrunService.validatePayrun(payrun.id, payrollMgr);
    await PayrunService.markPayrunPaid(payrun.id, payrollMgr);

    const finalizedPayrun = await prisma.payrun.findUniqueOrThrow({ where: { id: payrun.id } });
    if (finalizedPayrun.status !== PayrunStatus.PAID) {
      throw new Error(`Expected payrun status PAID, got ${finalizedPayrun.status}`);
    }

    const { buffer } = await PayslipPdfService.getOrGeneratePayslipPdf(johnPayslip.id);
    if (!buffer || buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new Error('Failed to generate PDF for finalized PAID payslip');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 22: historical payslip remains readable after contract changes
  // --------------------------------------------------------------------------
  await test('22. historical payslip remains readable after contract changes', async () => {
    // Mutate contract status to EXPIRED
    await prisma.contract.update({
      where: { id: johnPayslip.contractId },
      data: { status: ContractStatus.EXPIRED },
    });

    try {
      const payslip = await PayrunService.getPayslipById(johnPayslip.id, johnUser);
      if (!payslip || payslip.id !== johnPayslip.id) {
        throw new Error('Historical payslip not readable after contract expired');
      }

      const pdf = await PayslipPdfService.generatePayslipPdf(payslip as any);
      if (pdf.subarray(0, 5).toString() !== '%PDF-') {
        throw new Error('Failed to generate PDF from historical payslip after contract expiration');
      }
    } finally {
      // Revert contract status to ACTIVE
      await prisma.contract.update({
        where: { id: johnPayslip.contractId },
        data: { status: ContractStatus.ACTIVE },
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 23: unauthorized PDF access rejected
  // --------------------------------------------------------------------------
  await test('23. unauthorized PDF access rejected', async () => {
    const req = new NextRequest(`http://localhost:3000/api/payroll/payslips/${sarahPayslip.id}/pdf`, {
      headers: { Authorization: `Bearer ${johnSession.token}` },
    });
    const res = await getPayslipPdfRoute(req, { params: Promise.resolve({ id: sarahPayslip.id }) });

    if (res.status !== 403) {
      throw new Error(`Expected HTTP 403 for unauthorized PDF access, got ${res.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 24: raw secrets are never included in response/log output
  // --------------------------------------------------------------------------
  await test('24. raw secrets are never included in response/log output', async () => {
    // Verify payslip retrieval never leaks user passwordHash
    const payslip = await PayrunService.getPayslipById(johnPayslip.id, johnUser);
    const jsonString = JSON.stringify(payslip);

    if (jsonString.includes('passwordHash') || jsonString.includes('$2a$') || jsonString.includes('$2b$')) {
      throw new Error('Payslip payload leaked passwordHash');
    }

    // Verify error response does not leak SMTP secret or JWT secret
    try {
      EmailService.setMockTransport(null);
      await EmailService.sendEmail({ to: 'x@x.com', subject: 's', text: 't' });
    } catch (e: any) {
      const errStr = e.message || String(e);
      if (errStr.includes(process.env.JWT_SECRET || 'SUPER_SECRET')) {
        throw new Error('Error string leaked JWT_SECRET');
      }
    }
  });

  console.log('\n========================================');
  console.log(`Phase 13 Tests: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPayslipPdfEmailHistoryTests()
  .then(() => {
    prisma.$disconnect();
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    prisma.$disconnect();
    process.exit(1);
  });
