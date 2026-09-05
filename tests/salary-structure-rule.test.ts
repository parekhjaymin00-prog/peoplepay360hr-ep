import { SalaryStructureService } from '../lib/services/salary-structure.service';
import { SalaryRuleService } from '../lib/services/salary-rule.service';
import { AuthService } from '../lib/services/auth.service';
import { SalaryRuleCategory, ComputationType } from '@prisma/client';
import { BusinessRuleError, NotFoundError, AuthorizationError, ValidationError } from '../lib/errors';
import prisma from '../lib/prisma';

async function runSalaryStructureRuleTests() {
  console.log('🧪 Starting PeoplePay360 Salary Structures & Rules Tests...\n');
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

  const johnUser = johnSession.user;
  const hrUser = hrSession.user;

  // Clean up any test records from prior runs
  await prisma.salaryStructureRule.deleteMany({
    where: {
      salaryStructure: { code: { startsWith: 'TEST_STRUCT_' } },
    },
  });
  await prisma.salaryStructure.deleteMany({
    where: {
      code: { startsWith: 'TEST_STRUCT_' },
    },
  });
  await prisma.salaryRule.deleteMany({
    where: {
      code: { startsWith: 'TEST_RULE_' },
    },
  });

  let basicStructId = '';
  let grossStructId = '';
  let netStructId = '';

  let basicRuleId = '';
  let hraRuleId = '';
  let pfRuleId = '';
  let netRuleId = '';

  // --------------------------------------------------------------------------
  // TEST 1: create BASIC structure
  // --------------------------------------------------------------------------
  await test('1. create BASIC structure', async () => {
    const s = await SalaryStructureService.createStructure({
      name: 'Test Basic Salary Structure',
      code: 'TEST_STRUCT_BASIC',
      type: 'BASIC',
      description: 'Base pay package structure',
    });
    basicStructId = s.id;

    if (!s.id || s.code !== 'TEST_STRUCT_BASIC' || s.type !== 'BASIC') {
      throw new Error(`Failed to create BASIC structure, got type: ${s.type}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: create GROSS structure
  // --------------------------------------------------------------------------
  await test('2. create GROSS structure', async () => {
    const s = await SalaryStructureService.createStructure({
      name: 'Test Gross Salary Structure',
      code: 'TEST_STRUCT_GROSS',
      type: 'GROSS',
      description: 'Gross compensation structure with allowances',
    });
    grossStructId = s.id;

    if (!s.id || s.type !== 'GROSS') {
      throw new Error(`Failed to create GROSS structure, got type: ${s.type}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: create NET structure
  // --------------------------------------------------------------------------
  await test('3. create NET structure', async () => {
    const s = await SalaryStructureService.createStructure({
      name: 'Test Net Payout Structure',
      code: 'TEST_STRUCT_NET',
      type: 'NET',
      description: 'Final net disbursement structure',
    });
    netStructId = s.id;

    if (!s.id || s.type !== 'NET') {
      throw new Error(`Failed to create NET structure, got type: ${s.type}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: duplicate structure code rejected
  // --------------------------------------------------------------------------
  await test('4. duplicate structure code rejected', async () => {
    try {
      await SalaryStructureService.createStructure({
        name: 'Another Basic Structure',
        code: 'TEST_STRUCT_BASIC',
        type: 'BASIC',
      });
      throw new Error('Should have rejected duplicate structure code');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: create FIXED rule
  // --------------------------------------------------------------------------
  await test('5. create FIXED rule', async () => {
    // Basic salary rule (FIXED 50000)
    const basicRule = await SalaryRuleService.createRule({
      name: 'Test Basic Salary',
      code: 'TEST_RULE_BASIC',
      category: SalaryRuleCategory.BASIC,
      sequence: 10,
      computationType: ComputationType.FIXED,
      amount: 50000.0,
      description: 'Base pay fixed amount',
    });
    basicRuleId = basicRule.id;

    // HRA Allowance rule (FIXED 20000)
    const hraRule = await SalaryRuleService.createRule({
      name: 'Test House Rent Allowance',
      code: 'TEST_RULE_HRA',
      category: SalaryRuleCategory.ALLOWANCE,
      sequence: 20,
      computationType: ComputationType.FIXED,
      amount: 20000.0,
      description: 'Fixed housing allowance',
    });
    hraRuleId = hraRule.id;

    if (Number(basicRule.fixedAmount) !== 50000.0 || Number(hraRule.fixedAmount) !== 20000.0) {
      throw new Error('Fixed amounts mismatch');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: create PERCENTAGE rule
  // --------------------------------------------------------------------------
  await test('6. create PERCENTAGE rule', async () => {
    const pfRule = await SalaryRuleService.createRule({
      name: 'Test Provident Fund',
      code: 'TEST_RULE_PF',
      category: SalaryRuleCategory.DEDUCTION,
      sequence: 50,
      computationType: ComputationType.PERCENTAGE,
      percentage: 12.0,
      percentageBaseCode: 'TEST_RULE_BASIC',
      description: '12% of basic salary deduction',
    });
    pfRuleId = pfRule.id;

    if (Number(pfRule.percentageRate) !== 12.0 || pfRule.percentageBaseCode !== 'TEST_RULE_BASIC') {
      throw new Error('Percentage rule fields mismatch');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: create FORMULA rule
  // --------------------------------------------------------------------------
  await test('7. create FORMULA rule', async () => {
    const netRule = await SalaryRuleService.createRule({
      name: 'Test Net Calculation',
      code: 'TEST_RULE_NET',
      category: SalaryRuleCategory.NET,
      sequence: 100,
      computationType: ComputationType.FORMULA,
      formula: 'TEST_RULE_BASIC + TEST_RULE_HRA - TEST_RULE_PF',
      description: 'Net formula computation',
    });
    netRuleId = netRule.id;

    if (netRule.formulaExpression !== 'TEST_RULE_BASIC + TEST_RULE_HRA - TEST_RULE_PF') {
      throw new Error('Formula rule expression mismatch');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: invalid FIXED configuration rejected
  // --------------------------------------------------------------------------
  await test('8. invalid FIXED configuration rejected', async () => {
    // Missing amount
    try {
      await SalaryRuleService.createRule({
        name: 'Invalid Fixed No Amount',
        code: 'TEST_RULE_INV_F1',
        category: SalaryRuleCategory.BASIC,
        computationType: ComputationType.FIXED,
      });
      throw new Error('Should have rejected FIXED rule with missing amount');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) throw e;
    }

    // Conflicting percentage provided on FIXED
    try {
      await SalaryRuleService.createRule({
        name: 'Invalid Fixed With Pct',
        code: 'TEST_RULE_INV_F2',
        category: SalaryRuleCategory.BASIC,
        computationType: ComputationType.FIXED,
        amount: 5000,
        percentage: 10,
      });
      throw new Error('Should have rejected FIXED rule with percentage');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: invalid PERCENTAGE configuration rejected
  // --------------------------------------------------------------------------
  await test('9. invalid PERCENTAGE configuration rejected', async () => {
    // Missing percentage
    try {
      await SalaryRuleService.createRule({
        name: 'Invalid Pct No Pct',
        code: 'TEST_RULE_INV_P1',
        category: SalaryRuleCategory.DEDUCTION,
        computationType: ComputationType.PERCENTAGE,
      });
      throw new Error('Should have rejected PERCENTAGE rule with missing percentage');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) throw e;
    }

    // Conflicting fixed amount provided on PERCENTAGE
    try {
      await SalaryRuleService.createRule({
        name: 'Invalid Pct With Amt',
        code: 'TEST_RULE_INV_P2',
        category: SalaryRuleCategory.DEDUCTION,
        computationType: ComputationType.PERCENTAGE,
        percentage: 15,
        amount: 2000,
      });
      throw new Error('Should have rejected PERCENTAGE rule with fixed amount');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: invalid FORMULA configuration rejected
  // --------------------------------------------------------------------------
  await test('10. invalid FORMULA configuration rejected', async () => {
    // Empty formula
    try {
      await SalaryRuleService.createRule({
        name: 'Invalid Empty Formula',
        code: 'TEST_RULE_INV_FM1',
        category: SalaryRuleCategory.NET,
        computationType: ComputationType.FORMULA,
        formula: '   ',
      });
      throw new Error('Should have rejected empty formula');
    } catch (e: any) {
      if (!(e instanceof ValidationError) && !(e instanceof BusinessRuleError)) throw e;
    }

    // Conflicting amount on formula
    try {
      await SalaryRuleService.createRule({
        name: 'Invalid Formula With Amount',
        code: 'TEST_RULE_INV_FM2',
        category: SalaryRuleCategory.NET,
        computationType: ComputationType.FORMULA,
        formula: 'BASIC * 2',
        amount: 1000,
      });
      throw new Error('Should have rejected formula with amount');
    } catch (e: any) {
      if (!(e instanceof ValidationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: assign rule to structure
  // --------------------------------------------------------------------------
  await test('11. assign rule to structure', async () => {
    const a1 = await SalaryStructureService.assignRuleToStructure(grossStructId, {
      salaryRuleId: basicRuleId,
      sequenceOverride: 10,
    });
    const a2 = await SalaryStructureService.assignRuleToStructure(grossStructId, {
      salaryRuleId: hraRuleId,
      sequenceOverride: 20,
    });

    if (!a1.id || !a2.id) throw new Error('Rule assignment failed');
  });

  // --------------------------------------------------------------------------
  // TEST 12: duplicate assignment rejected
  // --------------------------------------------------------------------------
  await test('12. duplicate assignment rejected', async () => {
    try {
      await SalaryStructureService.assignRuleToStructure(grossStructId, {
        salaryRuleId: basicRuleId,
      });
      throw new Error('Should have rejected duplicate assignment');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'DUPLICATE_RULE_ASSIGNMENT') {
        throw new Error(`Expected DUPLICATE_RULE_ASSIGNMENT, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: sequenceOverride works
  // --------------------------------------------------------------------------
  await test('13. sequenceOverride works', async () => {
    // Assign PF rule with sequenceOverride: 30 (default sequence in rule is 50)
    const assign = await SalaryStructureService.assignRuleToStructure(grossStructId, {
      salaryRuleId: pfRuleId,
      sequenceOverride: 30,
    });

    if (assign.sequenceOverride !== 30) {
      throw new Error(`Expected sequenceOverride 30, got ${assign.sequenceOverride}`);
    }

    const structure = await SalaryStructureService.getStructureById(grossStructId);
    const pfAssigned = structure.orderedRules.find((r) => r.salaryRuleId === pfRuleId);

    if (pfAssigned?.effectiveSequence !== 30) {
      throw new Error(`Expected effectiveSequence 30, got ${pfAssigned?.effectiveSequence}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 14: effective sequence ordering works
  // --------------------------------------------------------------------------
  await test('14. effective sequence ordering works', async () => {
    // Assign NET rule with sequenceOverride 100
    await SalaryStructureService.assignRuleToStructure(grossStructId, {
      salaryRuleId: netRuleId,
      sequenceOverride: 100,
    });

    const structure = await SalaryStructureService.getStructureById(grossStructId);
    const seqs = structure.orderedRules.map((r) => r.effectiveSequence);

    // Verify sequences are strictly ascending: [10, 20, 30, 100]
    for (let i = 0; i < seqs.length - 1; i++) {
      if (seqs[i] > seqs[i + 1]) {
        throw new Error(`Sequences not sorted ascending: ${seqs.join(', ')}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 15: equal sequence deterministic ordering works
  // --------------------------------------------------------------------------
  await test('15. equal sequence deterministic ordering works', async () => {
    // Create two bonus rules with identical sequence = 40
    const b1 = await SalaryRuleService.createRule({
      name: 'Bonus A',
      code: 'TEST_RULE_BONUS_A',
      category: SalaryRuleCategory.ALLOWANCE,
      computationType: ComputationType.FIXED,
      amount: 1000,
      sequence: 40,
    });
    const b2 = await SalaryRuleService.createRule({
      name: 'Bonus B',
      code: 'TEST_RULE_BONUS_B',
      category: SalaryRuleCategory.ALLOWANCE,
      computationType: ComputationType.FIXED,
      amount: 1000,
      sequence: 40,
    });

    await SalaryStructureService.assignRuleToStructure(grossStructId, {
      salaryRuleId: b1.id,
      sequenceOverride: 40,
    });
    await SalaryStructureService.assignRuleToStructure(grossStructId, {
      salaryRuleId: b2.id,
      sequenceOverride: 40,
    });

    const structure = await SalaryStructureService.getStructureById(grossStructId);
    const bonusRules = structure.orderedRules.filter((r) => r.effectiveSequence === 40);

    if (bonusRules.length !== 2) throw new Error('Expected 2 bonus rules with sequence 40');
    // Deterministic tie-break by salaryRule.id
    if (bonusRules[0].salaryRule.id.localeCompare(bonusRules[1].salaryRule.id) >= 0) {
      throw new Error('Equal sequence tie-break failed to order deterministically by rule ID');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 16: invalid dependency ordering rejected
  // --------------------------------------------------------------------------
  await test('16. invalid dependency ordering rejected', async () => {
    // Create new structure
    const depStruct = await SalaryStructureService.createStructure({
      name: 'Dependency Test Structure',
      code: 'TEST_STRUCT_DEP',
      type: 'GROSS',
    });

    // Assign NET rule (depends on BASIC and HRA) at sequence 10 FIRST
    await SalaryStructureService.assignRuleToStructure(depStruct.id, {
      salaryRuleId: netRuleId,
      sequenceOverride: 10,
    });

    // Now try to assign BASIC at sequence 50 (higher sequence than dependent NET rule)
    try {
      await SalaryStructureService.assignRuleToStructure(depStruct.id, {
        salaryRuleId: basicRuleId,
        sequenceOverride: 50,
      });
      throw new Error('Should have rejected dependency with higher sequence than dependent rule');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'INVALID_DEPENDENCY_ORDER') {
        throw new Error(`Expected INVALID_DEPENDENCY_ORDER, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: fixed rule calculation
  // --------------------------------------------------------------------------
  await test('17. fixed rule calculation', async () => {
    const rule = await SalaryRuleService.getRuleById(basicRuleId);
    const val = SalaryRuleService.evaluateRule(rule, { BASIC: 50000 });
    if (val !== 50000.0) throw new Error(`Expected 50000.00, got ${val}`);
  });

  // --------------------------------------------------------------------------
  // TEST 18: percentage rule calculation
  // --------------------------------------------------------------------------
  await test('18. percentage rule calculation', async () => {
    const pfRule = await SalaryRuleService.getRuleById(pfRuleId);
    // 12% of 50000 = 6000
    const val = SalaryRuleService.evaluateRule(
      pfRule,
      { BASIC: 50000 },
      { TEST_RULE_BASIC: 50000 }
    );
    if (val !== 6000.0) throw new Error(`Expected 6000.00, got ${val}`);
  });

  // --------------------------------------------------------------------------
  // TEST 19: formula calculation
  // --------------------------------------------------------------------------
  await test('19. formula calculation', async () => {
    const unpaidRule = await SalaryRuleService.createRule({
      name: 'Unpaid Leave Proration',
      code: 'TEST_RULE_UNPAID',
      category: SalaryRuleCategory.DEDUCTION,
      computationType: ComputationType.FORMULA,
      formula: '(UNPAID_DAYS / SCHEDULED_DAYS) * BASIC',
    });

    // 2 unpaid days out of 20 scheduled on 60,000 basic = (2 / 20) * 60000 = 6000
    const val = SalaryRuleService.evaluateRule(unpaidRule, {
      BASIC: 60000,
      UNPAID_DAYS: 2,
      SCHEDULED_DAYS: 20,
    });

    if (val !== 6000.0) throw new Error(`Expected 6000.00, got ${val}`);
  });

  // --------------------------------------------------------------------------
  // TEST 20: unknown formula variable rejected
  // --------------------------------------------------------------------------
  await test('20. unknown formula variable rejected', async () => {
    const badRule = await SalaryRuleService.createRule({
      name: 'Unknown Variable Rule',
      code: 'TEST_RULE_UNKNOWN',
      category: SalaryRuleCategory.DEDUCTION,
      computationType: ComputationType.FORMULA,
      formula: 'BASIC + NON_EXISTENT_VARIABLE_XYZ',
    });

    try {
      SalaryRuleService.evaluateRule(badRule, { BASIC: 50000 });
      throw new Error('Should have rejected unknown formula variable');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'UNKNOWN_FORMULA_VARIABLE') {
        throw new Error(`Expected UNKNOWN_FORMULA_VARIABLE, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 21: dangerous/arbitrary formula rejected
  // --------------------------------------------------------------------------
  await test('21. dangerous/arbitrary formula rejected', async () => {
    // Attempt eval injection
    try {
      await SalaryRuleService.createRule({
        name: 'Dangerous Eval',
        code: 'TEST_RULE_DANGER1',
        category: SalaryRuleCategory.ALLOWANCE,
        computationType: ComputationType.FORMULA,
        formula: 'eval("2+2")',
      });
      throw new Error('Should have rejected formula containing eval and quotes');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) && !(e instanceof ValidationError)) throw e;
    }

    // Attempt semicolon / statement injection
    try {
      await SalaryRuleService.createRule({
        name: 'Dangerous Semicolon',
        code: 'TEST_RULE_DANGER2',
        category: SalaryRuleCategory.ALLOWANCE,
        computationType: ComputationType.FORMULA,
        formula: 'BASIC; process.exit(1)',
      });
      throw new Error('Should have rejected formula containing semicolon');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) && !(e instanceof ValidationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 22: inactive rule cannot be used for calculation
  // --------------------------------------------------------------------------
  await test('22. inactive rule cannot be used for calculation', async () => {
    const inactRule = await SalaryRuleService.createRule({
      name: 'Inactive Rule',
      code: 'TEST_RULE_INACTIVE',
      category: SalaryRuleCategory.ALLOWANCE,
      computationType: ComputationType.FIXED,
      amount: 500,
      isActive: false,
    });

    try {
      SalaryRuleService.evaluateRule(inactRule, { BASIC: 50000 });
      throw new Error('Should have rejected inactive rule evaluation');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'RULE_INACTIVE') {
        throw new Error(`Expected RULE_INACTIVE, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 23: inactive structure cannot be used for calculation
  // --------------------------------------------------------------------------
  await test('23. inactive structure cannot be used for calculation', async () => {
    const inactStruct = await SalaryStructureService.createStructure({
      name: 'Inactive Structure',
      code: 'TEST_STRUCT_INACT',
      type: 'GROSS',
      isActive: false,
    });

    try {
      await SalaryStructureService.calculateStructure(inactStruct.id, { BASIC: 50000 });
      throw new Error('Should have rejected calculation with inactive structure');
    } catch (e: any) {
      if (!(e instanceof BusinessRuleError) || e.code !== 'STRUCTURE_INACTIVE') {
        throw new Error(`Expected STRUCTURE_INACTIVE, got ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 24: unauthorized employee cannot manage salary structures
  // --------------------------------------------------------------------------
  await test('24. unauthorized employee cannot manage salary structures', async () => {
    const hasWrite =
      johnUser.permissions.includes('payroll.structure.write') ||
      johnUser.permissions.includes('salary.structure.manage');

    if (hasWrite) {
      throw new Error('Ordinary employee John should not possess salary structure write permissions');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 25: unauthorized employee cannot manage salary rules
  // --------------------------------------------------------------------------
  await test('25. unauthorized employee cannot manage salary rules', async () => {
    const hasWrite =
      johnUser.permissions.includes('payroll.rule.write') ||
      johnUser.permissions.includes('salary.rule.manage');

    if (hasWrite) {
      throw new Error('Ordinary employee John should not possess salary rule write permissions');
    }
  });

  // Clean up
  await prisma.salaryStructureRule.deleteMany({
    where: { salaryStructure: { code: { startsWith: 'TEST_STRUCT_' } } },
  });
  await prisma.salaryStructure.deleteMany({
    where: { code: { startsWith: 'TEST_STRUCT_' } },
  });
  await prisma.salaryRule.deleteMany({
    where: { code: { startsWith: 'TEST_RULE_' } },
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`Salary Structure & Rule Tests: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSalaryStructureRuleTests()
  .catch((e) => {
    console.error('Fatal Salary Structure / Rule test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
