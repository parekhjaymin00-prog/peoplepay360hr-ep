import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { SalaryRuleCategory, ComputationType, SalaryRule } from '@prisma/client';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors';
import { SafeFormulaEngine } from '../payroll/formula-engine';

export interface CreateSalaryRuleInput {
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence?: number;
  computationType: ComputationType;
  amount?: number | null;
  fixedAmount?: number | null;
  percentage?: number | null;
  percentageRate?: number | null;
  percentageBaseCode?: string | null;
  formula?: string | null;
  formulaExpression?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateSalaryRuleInput {
  name?: string;
  category?: SalaryRuleCategory;
  sequence?: number;
  computationType?: ComputationType;
  amount?: number | null;
  fixedAmount?: number | null;
  percentage?: number | null;
  percentageRate?: number | null;
  percentageBaseCode?: string | null;
  formula?: string | null;
  formulaExpression?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface PayrollEvaluationContext {
  BASIC?: number;
  GROSS?: number;
  UNPAID_DAYS?: number;
  SCHEDULED_DAYS?: number;
  WORKED_DAYS?: number;
  WORKED_HOURS?: number;
  SCHEDULED_HOURS?: number;
  OVERTIME_HOURS?: number;
  [key: string]: number | undefined;
}

export class SalaryRuleService {
  /**
   * Lists salary rules with optional category and status filtering.
   */
  static async listRules(filter?: { category?: SalaryRuleCategory; isActive?: boolean }) {
    const where: any = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    return prisma.salaryRule.findMany({
      where,
      orderBy: [{ sequence: 'asc' }, { code: 'asc' }],
    });
  }

  /**
   * Retrieves a salary rule by ID.
   */
  static async getRuleById(id: string) {
    const rule = await prisma.salaryRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundError(`Salary rule '${id}' not found`);
    }

    return rule;
  }

  /**
   * Retrieves a salary rule by its unique code.
   */
  static async getRuleByCode(code: string) {
    const rule = await prisma.salaryRule.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!rule) {
      throw new NotFoundError(`Salary rule with code '${code}' not found`);
    }

    return rule;
  }

  /**
   * Creates a new salary rule with strict computation type invariants.
   */
  static async createRule(input: CreateSalaryRuleInput) {
    const name = input.name?.trim();
    if (!name) throw new ValidationError('Salary rule name is required');

    const code = input.code?.trim().toUpperCase();
    if (!code) throw new ValidationError('Salary rule code is required');

    const existing = await prisma.salaryRule.findUnique({ where: { code } });
    if (existing) {
      throw new ValidationError(`Salary rule code '${code}' is already in use`);
    }

    const { fixedAmount, percentageRate, percentageBaseCode, formulaExpression } =
      this.validateComputationFields(input.computationType, input);

    return prisma.salaryRule.create({
      data: {
        id: generateUuidV7(),
        name,
        code,
        category: input.category,
        sequence: input.sequence ?? 100,
        computationType: input.computationType,
        fixedAmount,
        percentageRate,
        percentageBaseCode,
        formulaExpression,
        description: input.description?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
  }

  /**
   * Updates an existing salary rule.
   */
  static async updateRule(id: string, input: UpdateSalaryRuleInput) {
    const existing = await this.getRuleById(id);

    const compType = input.computationType ?? existing.computationType;
    const mergedInput: CreateSalaryRuleInput = {
      name: input.name ?? existing.name,
      code: existing.code,
      category: input.category ?? existing.category,
      computationType: compType,
      amount: input.amount !== undefined ? input.amount : (input.fixedAmount !== undefined ? input.fixedAmount : (existing.fixedAmount ? Number(existing.fixedAmount) : null)),
      percentage: input.percentage !== undefined ? input.percentage : (input.percentageRate !== undefined ? input.percentageRate : (existing.percentageRate ? Number(existing.percentageRate) : null)),
      percentageBaseCode: input.percentageBaseCode !== undefined ? input.percentageBaseCode : existing.percentageBaseCode,
      formula: input.formula !== undefined ? input.formula : (input.formulaExpression !== undefined ? input.formulaExpression : existing.formulaExpression),
    };

    const { fixedAmount, percentageRate, percentageBaseCode, formulaExpression } =
      this.validateComputationFields(compType, mergedInput);

    return prisma.salaryRule.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        category: input.category,
        sequence: input.sequence,
        computationType: compType,
        fixedAmount,
        percentageRate,
        percentageBaseCode,
        formulaExpression,
        description: input.description !== undefined ? (input.description ? input.description.trim() : null) : undefined,
        isActive: input.isActive,
      },
    });
  }

  /**
   * Activates a salary rule.
   */
  static async activateRule(id: string) {
    await this.getRuleById(id);
    return prisma.salaryRule.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Deactivates a salary rule.
   */
  static async deactivateRule(id: string) {
    await this.getRuleById(id);
    return prisma.salaryRule.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Authoritatively evaluates a single salary rule against supplied payroll context.
   */
  static evaluateRule(
    rule: SalaryRule,
    context: PayrollEvaluationContext,
    evaluatedPriorRules: Record<string, number> = {}
  ): number {
    if (!rule.isActive) {
      throw new BusinessRuleError(
        `Inactive salary rule '${rule.code}' cannot be used for calculation`,
        'RULE_INACTIVE'
      );
    }

    if (rule.computationType === ComputationType.FIXED) {
      if (rule.fixedAmount === null || rule.fixedAmount === undefined) {
        throw new BusinessRuleError(`Fixed rule '${rule.code}' has no fixedAmount configured`, 'INVALID_RULE_CONFIG');
      }
      return Number(rule.fixedAmount);
    }

    if (rule.computationType === ComputationType.PERCENTAGE) {
      if (rule.percentageRate === null || rule.percentageRate === undefined) {
        throw new BusinessRuleError(`Percentage rule '${rule.code}' has no percentageRate configured`, 'INVALID_RULE_CONFIG');
      }

      // Determine the base amount (e.g. BASIC or GROSS or prior rule code)
      let baseAmount = 0;
      if (rule.percentageBaseCode) {
        const upperBase = rule.percentageBaseCode.toUpperCase();
        if (upperBase in evaluatedPriorRules) {
          baseAmount = evaluatedPriorRules[upperBase];
        } else if (upperBase in context && context[upperBase] !== undefined) {
          baseAmount = context[upperBase]!;
        } else {
          throw new BusinessRuleError(
            `Percentage base '${rule.percentageBaseCode}' for rule '${rule.code}' was not found in prior evaluated rules or context`,
            'UNKNOWN_PERCENTAGE_BASE'
          );
        }
      } else {
        baseAmount = context.BASIC ?? 0;
      }

      const rate = Number(rule.percentageRate);
      const calculated = (baseAmount * rate) / 100.0;
      return parseFloat(calculated.toFixed(2));
    }

    if (rule.computationType === ComputationType.FORMULA) {
      if (!rule.formulaExpression) {
        throw new BusinessRuleError(`Formula rule '${rule.code}' has no formulaExpression configured`, 'INVALID_RULE_CONFIG');
      }

      const mergedContext: Record<string, number> = {};
      for (const [k, v] of Object.entries(context)) {
        if (v !== undefined) mergedContext[k] = v;
      }
      for (const [k, v] of Object.entries(evaluatedPriorRules)) {
        mergedContext[k] = v;
      }

      return SafeFormulaEngine.evaluate(rule.formulaExpression, mergedContext);
    }

    throw new BusinessRuleError(`Unknown computation type for rule '${rule.code}'`, 'UNSUPPORTED_COMPUTATION_TYPE');
  }

  /**
   * Helper that enforces strict mutual exclusivity and validity of computation fields.
   */
  private static validateComputationFields(
    type: ComputationType,
    input: {
      amount?: number | null;
      fixedAmount?: number | null;
      percentage?: number | null;
      percentageRate?: number | null;
      percentageBaseCode?: string | null;
      formula?: string | null;
      formulaExpression?: string | null;
    }
  ) {
    const amt = input.amount ?? input.fixedAmount;
    const pct = input.percentage ?? input.percentageRate;
    const fml = (input.formula ?? input.formulaExpression)?.trim();

    if (type === ComputationType.FIXED) {
      if (amt === undefined || amt === null) {
        throw new ValidationError('Amount is required for FIXED salary rules');
      }
      if (typeof amt !== 'number' || amt <= 0) {
        throw new BusinessRuleError('Amount must be strictly greater than 0 for FIXED salary rules', 'INVALID_AMOUNT');
      }
      if (pct !== undefined && pct !== null) {
        throw new ValidationError('Percentage must be absent/null for FIXED salary rules');
      }
      if (fml) {
        throw new ValidationError('Formula must be absent/null for FIXED salary rules');
      }

      return {
        fixedAmount: amt,
        percentageRate: null,
        percentageBaseCode: null,
        formulaExpression: null,
      };
    }

    if (type === ComputationType.PERCENTAGE) {
      if (pct === undefined || pct === null) {
        throw new ValidationError('Percentage is required for PERCENTAGE salary rules');
      }
      if (typeof pct !== 'number' || pct <= 0 || pct > 100) {
        throw new BusinessRuleError('Percentage must be between 0 and 100', 'INVALID_PERCENTAGE');
      }
      if (amt !== undefined && amt !== null) {
        throw new ValidationError('Amount must be absent/null for PERCENTAGE salary rules');
      }
      if (fml) {
        throw new ValidationError('Formula must be absent/null for PERCENTAGE salary rules');
      }

      return {
        fixedAmount: null,
        percentageRate: pct,
        percentageBaseCode: input.percentageBaseCode?.trim().toUpperCase() || 'BASIC',
        formulaExpression: null,
      };
    }

    if (type === ComputationType.FORMULA) {
      if (!fml) {
        throw new ValidationError('Formula expression is required for FORMULA salary rules');
      }
      if (amt !== undefined && amt !== null) {
        throw new ValidationError('Amount must be absent/null for FORMULA salary rules');
      }
      if (pct !== undefined && pct !== null) {
        throw new ValidationError('Percentage must be absent/null for FORMULA salary rules');
      }

      // Validate formula syntax using safe engine
      SafeFormulaEngine.validateFormula(fml);

      return {
        fixedAmount: null,
        percentageRate: null,
        percentageBaseCode: null,
        formulaExpression: fml,
      };
    }

    throw new ValidationError(`Unsupported computation type '${type}'`);
  }
}
