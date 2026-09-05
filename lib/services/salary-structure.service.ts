import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { SalaryStructure, SalaryRule, SalaryRuleCategory, ComputationType } from '@prisma/client';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors';
import { SalaryRuleService, PayrollEvaluationContext } from './salary-rule.service';
import { SafeFormulaEngine } from '../payroll/formula-engine';

export type SalaryStructureType = 'BASIC' | 'GROSS' | 'NET';

export interface CreateSalaryStructureInput {
  name: string;
  code: string;
  type: SalaryStructureType;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateSalaryStructureInput {
  name?: string;
  type?: SalaryStructureType;
  description?: string | null;
  isActive?: boolean;
}

export interface AssignRuleInput {
  salaryRuleId: string;
  sequenceOverride?: number | null;
}

export interface OrderedStructureRule {
  id: string;
  salaryStructureId: string;
  salaryRuleId: string;
  sequenceOverride: number | null;
  effectiveSequence: number;
  salaryRule: SalaryRule;
}

export class SalaryStructureService {
  /**
   * Extracts the structure type ('BASIC' | 'GROSS' | 'NET') from metadata or description.
   */
  private static resolveStructureType(description: string | null | undefined, code: string): SalaryStructureType {
    if (description) {
      if (description.startsWith('[TYPE:BASIC]') || description.includes('TYPE:BASIC')) return 'BASIC';
      if (description.startsWith('[TYPE:GROSS]') || description.includes('TYPE:GROSS')) return 'GROSS';
      if (description.startsWith('[TYPE:NET]') || description.includes('TYPE:NET')) return 'NET';
    }
    const upperCode = code.toUpperCase();
    if (upperCode.includes('BASIC')) return 'BASIC';
    if (upperCode.includes('NET')) return 'NET';
    return 'GROSS';
  }

  private static encodeDescription(type: SalaryStructureType, userDesc?: string | null): string {
    const prefix = `[TYPE:${type}]`;
    const desc = userDesc ? userDesc.trim() : '';
    return desc ? `${prefix} ${desc}` : prefix;
  }

  /**
   * Lists salary structures with optional inactive inclusion.
   */
  static async listStructures(includeInactive = false) {
    const structures = await prisma.salaryStructure.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        structureRules: {
          include: { salaryRule: true },
        },
      },
    });

    return structures.map((s) => ({
      ...s,
      type: this.resolveStructureType(s.description, s.code),
    }));
  }

  /**
   * Retrieves a salary structure by ID with rules ordered by effectiveSequence.
   */
  static async getStructureById(id: string) {
    const structure = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        structureRules: {
          include: { salaryRule: true },
        },
      },
    });

    if (!structure) {
      throw new NotFoundError(`Salary structure '${id}' not found`);
    }

    // Compute effectiveSequence: sequenceOverride ?? salaryRule.sequence
    const orderedRules: OrderedStructureRule[] = structure.structureRules.map((sr) => ({
      id: sr.id,
      salaryStructureId: sr.salaryStructureId,
      salaryRuleId: sr.salaryRuleId,
      sequenceOverride: sr.sequenceOverride,
      effectiveSequence: sr.sequenceOverride !== null && sr.sequenceOverride !== undefined
        ? sr.sequenceOverride
        : sr.salaryRule.sequence,
      salaryRule: sr.salaryRule,
    }));

    // Sort ascending by effectiveSequence, tie-break deterministically by salaryRule.id
    orderedRules.sort((a, b) => {
      if (a.effectiveSequence !== b.effectiveSequence) {
        return a.effectiveSequence - b.effectiveSequence;
      }
      return a.salaryRule.id.localeCompare(b.salaryRule.id);
    });

    return {
      ...structure,
      type: this.resolveStructureType(structure.description, structure.code),
      orderedRules,
    };
  }

  /**
   * Creates a new salary structure.
   */
  static async createStructure(input: CreateSalaryStructureInput) {
    const name = input.name?.trim();
    if (!name) throw new ValidationError('Salary structure name is required');

    const code = input.code?.trim().toUpperCase();
    if (!code) throw new ValidationError('Salary structure code is required');

    const validTypes: SalaryStructureType[] = ['BASIC', 'GROSS', 'NET'];
    if (!validTypes.includes(input.type)) {
      throw new ValidationError(`Invalid salary structure type '${input.type}'. Must be BASIC, GROSS, or NET`);
    }

    const existingCode = await prisma.salaryStructure.findUnique({ where: { code } });
    if (existingCode) {
      throw new ValidationError(`Salary structure code '${code}' is already in use`);
    }

    const existingName = await prisma.salaryStructure.findUnique({ where: { name } });
    if (existingName) {
      throw new ValidationError(`Salary structure name '${name}' is already in use`);
    }

    const encodedDescription = this.encodeDescription(input.type, input.description);

    const created = await prisma.salaryStructure.create({
      data: {
        id: generateUuidV7(),
        name,
        code,
        description: encodedDescription,
        isActive: input.isActive ?? true,
      },
    });

    return {
      ...created,
      type: input.type,
    };
  }

  /**
   * Updates an existing salary structure.
   */
  static async updateStructure(id: string, input: UpdateSalaryStructureInput) {
    const existing = await this.getStructureById(id);

    if (input.name && input.name.trim() !== existing.name) {
      const duplicate = await prisma.salaryStructure.findUnique({ where: { name: input.name.trim() } });
      if (duplicate && duplicate.id !== id) {
        throw new ValidationError(`Salary structure name '${input.name.trim()}' is already in use`);
      }
    }

    const newType = input.type ?? existing.type;
    const userDesc = input.description !== undefined ? input.description : existing.description;
    const cleanDesc = userDesc ? userDesc.replace(/\[TYPE:[A-Z]+\]\s*/, '') : '';
    const encodedDescription = this.encodeDescription(newType, cleanDesc);

    const updated = await prisma.salaryStructure.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description: encodedDescription,
        isActive: input.isActive,
      },
    });

    return {
      ...updated,
      type: newType,
    };
  }

  static async activateStructure(id: string) {
    await this.getStructureById(id);
    const updated = await prisma.salaryStructure.update({
      where: { id },
      data: { isActive: true },
    });
    return {
      ...updated,
      type: this.resolveStructureType(updated.description, updated.code),
    };
  }

  static async deactivateStructure(id: string) {
    await this.getStructureById(id);
    const updated = await prisma.salaryStructure.update({
      where: { id },
      data: { isActive: false },
    });
    return {
      ...updated,
      type: this.resolveStructureType(updated.description, updated.code),
    };
  }

  // ==========================================================================
  // STRUCTURE ↔ RULE ASSIGNMENT
  // ==========================================================================

  /**
   * Assigns a rule to a salary structure with duplicate protection and sequence dependency validation.
   */
  static async assignRuleToStructure(structureId: string, input: AssignRuleInput) {
    const structure = await this.getStructureById(structureId);
    const rule = await SalaryRuleService.getRuleById(input.salaryRuleId);

    // Check duplicate assignment
    const existingAssignment = await prisma.salaryStructureRule.findUnique({
      where: {
        salaryStructureId_salaryRuleId: {
          salaryStructureId: structureId,
          salaryRuleId: input.salaryRuleId,
        },
      },
    });

    if (existingAssignment) {
      throw new BusinessRuleError(
        `Rule '${rule.code}' is already assigned to salary structure '${structure.name}'`,
        'DUPLICATE_RULE_ASSIGNMENT'
      );
    }

    const newEffectiveSequence =
      input.sequenceOverride !== null && input.sequenceOverride !== undefined
        ? input.sequenceOverride
        : rule.sequence;

    // Build hypothetical rule map for sequence dependency validation
    const candidateRules: Array<{ code: string; effectiveSequence: number; rule: SalaryRule }> =
      structure.orderedRules.map((r) => ({
        code: r.salaryRule.code,
        effectiveSequence: r.effectiveSequence,
        rule: r.salaryRule,
      }));

    candidateRules.push({
      code: rule.code,
      effectiveSequence: newEffectiveSequence,
      rule,
    });

    // Validate sequence dependencies across all candidate rules
    this.validateDependencies(candidateRules);

    return prisma.salaryStructureRule.create({
      data: {
        id: generateUuidV7(),
        salaryStructureId: structureId,
        salaryRuleId: input.salaryRuleId,
        sequenceOverride: input.sequenceOverride ?? null,
      },
      include: {
        salaryRule: true,
      },
    });
  }

  /**
   * Removes a rule from a salary structure.
   */
  static async removeRuleFromStructure(structureId: string, ruleId: string) {
    const assignment = await prisma.salaryStructureRule.findFirst({
      where: {
        salaryStructureId: structureId,
        salaryRuleId: ruleId,
      },
    });

    if (!assignment) {
      throw new NotFoundError(`Rule '${ruleId}' is not assigned to structure '${structureId}'`);
    }

    return prisma.salaryStructureRule.delete({
      where: { id: assignment.id },
    });
  }

  /**
   * Updates sequence override for an assigned rule.
   */
  static async updateRuleSequenceOverride(
    structureId: string,
    ruleId: string,
    sequenceOverride: number | null
  ) {
    const structure = await this.getStructureById(structureId);
    const assignment = structure.orderedRules.find((r) => r.salaryRuleId === ruleId);

    if (!assignment) {
      throw new NotFoundError(`Rule '${ruleId}' is not assigned to structure '${structureId}'`);
    }

    // Build candidate rules with new sequence override
    const candidateRules = structure.orderedRules.map((r) => {
      const effSeq =
        r.salaryRuleId === ruleId
          ? (sequenceOverride !== null && sequenceOverride !== undefined ? sequenceOverride : r.salaryRule.sequence)
          : r.effectiveSequence;
      return {
        code: r.salaryRule.code,
        effectiveSequence: effSeq,
        rule: r.salaryRule,
      };
    });

    this.validateDependencies(candidateRules);

    return prisma.salaryStructureRule.update({
      where: { id: assignment.id },
      data: { sequenceOverride },
      include: { salaryRule: true },
    });
  }

  /**
   * Validates that all dependent rules have strictly higher effective sequences than their prerequisites.
   */
  private static validateDependencies(
    rules: Array<{ code: string; effectiveSequence: number; rule: SalaryRule }>
  ) {
    const ruleSequenceMap = new Map<string, number>();
    for (const r of rules) {
      ruleSequenceMap.set(r.code.toUpperCase(), r.effectiveSequence);
    }

    for (const r of rules) {
      const dependentCode = r.code.toUpperCase();
      const dependentSeq = r.effectiveSequence;

      // 1. Percentage base dependency
      if (r.rule.computationType === ComputationType.PERCENTAGE && r.rule.percentageBaseCode) {
        const baseCode = r.rule.percentageBaseCode.toUpperCase();
        if (ruleSequenceMap.has(baseCode)) {
          const baseSeq = ruleSequenceMap.get(baseCode)!;
          if (baseSeq >= dependentSeq) {
            throw new BusinessRuleError(
              `Invalid dependency ordering: Rule '${dependentCode}' (sequence ${dependentSeq}) depends on base '${baseCode}' (sequence ${baseSeq}), but dependency sequence must be strictly lower.`,
              'INVALID_DEPENDENCY_ORDER'
            );
          }
        }
      }

      // 2. Formula variables dependency
      if (r.rule.computationType === ComputationType.FORMULA && r.rule.formulaExpression) {
        const referencedVars = SafeFormulaEngine.extractVariables(r.rule.formulaExpression);
        for (const varName of referencedVars) {
          const upperVar = varName.toUpperCase();
          if (ruleSequenceMap.has(upperVar)) {
            const depSeq = ruleSequenceMap.get(upperVar)!;
            if (depSeq >= dependentSeq) {
              throw new BusinessRuleError(
                `Invalid dependency ordering: Formula rule '${dependentCode}' (sequence ${dependentSeq}) depends on rule '${upperVar}' (sequence ${depSeq}), but dependency sequence must be strictly lower.`,
                'INVALID_DEPENDENCY_ORDER'
              );
            }
          }
        }
      }
    }
  }

  // ==========================================================================
  // STRUCTURE CALCULATION FOUNDATION
  // ==========================================================================

  /**
   * Evaluates all active rules in a salary structure against a supplied payroll context.
   * Returns line item amounts and aggregate gross, deductions, net, and employerCost.
   */
  static async calculateStructure(structureId: string, context: PayrollEvaluationContext) {
    const structure = await this.getStructureById(structureId);

    if (!structure.isActive) {
      throw new BusinessRuleError(
        `Inactive salary structure '${structure.name}' cannot be used for calculation`,
        'STRUCTURE_INACTIVE'
      );
    }

    const evaluatedRules: Record<string, number> = {};
    const lines: Array<{
      ruleId: string;
      code: string;
      name: string;
      category: SalaryRuleCategory;
      effectiveSequence: number;
      amount: number;
    }> = [];

    for (const orderedRule of structure.orderedRules) {
      const rule = orderedRule.salaryRule;

      if (!rule.isActive) {
        throw new BusinessRuleError(
          `Inactive salary rule '${rule.code}' in structure '${structure.name}' cannot be used for calculation`,
          'RULE_INACTIVE'
        );
      }

      const amount = SalaryRuleService.evaluateRule(rule, context, evaluatedRules);
      evaluatedRules[rule.code.toUpperCase()] = amount;

      lines.push({
        ruleId: rule.id,
        code: rule.code,
        name: rule.name,
        category: rule.category,
        effectiveSequence: orderedRule.effectiveSequence,
        amount,
      });
    }

    // Financial aggregation
    let gross = 0.0;
    let deductions = 0.0;
    let net = 0.0;
    let employerCost = 0.0;

    let hasExplicitGross = false;
    let hasExplicitNet = false;

    for (const line of lines) {
      if (line.category === SalaryRuleCategory.BASIC || line.category === SalaryRuleCategory.ALLOWANCE) {
        gross += line.amount;
      } else if (line.category === SalaryRuleCategory.GROSS) {
        hasExplicitGross = true;
        gross = line.amount; // Explicit GROSS rule overrides accumulated sum
      } else if (line.category === SalaryRuleCategory.DEDUCTION) {
        deductions += line.amount;
      } else if (line.category === SalaryRuleCategory.NET) {
        hasExplicitNet = true;
        net = line.amount; // Explicit NET rule
      } else if (line.category === SalaryRuleCategory.COMPANY_CONTRIBUTION) {
        employerCost += line.amount;
      }
    }

    if (!hasExplicitNet) {
      net = parseFloat((gross - deductions).toFixed(2));
    }

    employerCost = parseFloat((gross + employerCost).toFixed(2));
    gross = parseFloat(gross.toFixed(2));
    deductions = parseFloat(deductions.toFixed(2));

    return {
      structureId: structure.id,
      structureName: structure.name,
      structureCode: structure.code,
      lines,
      gross,
      deductions,
      net,
      employerCost,
    };
  }
}
