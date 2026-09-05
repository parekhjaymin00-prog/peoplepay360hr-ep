import { BusinessRuleError } from '../errors';

const FORBIDDEN_IDENTIFIERS = new Set([
  'EVAL',
  'FUNCTION',
  'CONSTRUCTOR',
  'PROTOTYPE',
  'WINDOW',
  'GLOBAL',
  'GLOBALTHIS',
  'PROCESS',
  'REQUIRE',
  'IMPORT',
  'DOCUMENT',
  'THIS',
  'CALL',
  'APPLY',
  'BIND',
  'OBJECT',
  'STRING',
  'ARRAY',
  'PROMISE',
  'FETCH',
]);

const ALLOWED_CONTEXT_VARIABLES = new Set([
  'BASIC',
  'GROSS',
  'UNPAID_DAYS',
  'SCHEDULED_DAYS',
  'WORKED_DAYS',
  'WORKED_HOURS',
  'SCHEDULED_HOURS',
  'OVERTIME_HOURS',
]);

type TokenType = 'NUMBER' | 'IDENTIFIER' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export class SafeFormulaEngine {
  /**
   * Tokenizes a formula string with strict security validation.
   * Throws BusinessRuleError if any unauthorized or dangerous characters are present.
   */
  private static tokenize(formula: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    // Security check: Reject forbidden symbols like quotes, backticks, brackets, semicolons, dollar signs
    const dangerousPattern = /[`'";[\]{}<>!=&|^~$#@\\?]/;
    if (dangerousPattern.test(formula)) {
      throw new BusinessRuleError(
        'Dangerous or unsupported characters detected in formula expression',
        'DANGEROUS_FORMULA'
      );
    }

    while (i < formula.length) {
      const char = formula[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Numbers (integers or floating-point decimals)
      if (/\d/.test(char) || (char === '.' && /\d/.test(formula[i + 1] || ''))) {
        let numStr = '';
        let hasDot = false;
        const startPos = i;

        while (i < formula.length && (/\d/.test(formula[i]) || formula[i] === '.')) {
          if (formula[i] === '.') {
            if (hasDot) {
              throw new BusinessRuleError('Malformed number with multiple decimal points', 'MALFORMED_FORMULA');
            }
            hasDot = true;
          }
          numStr += formula[i];
          i++;
        }

        tokens.push({ type: 'NUMBER', value: numStr, position: startPos });
        continue;
      }

      // Identifiers (variable names: e.g. BASIC, GROSS, PF)
      if (/[A-Za-z_]/.test(char)) {
        let ident = '';
        const startPos = i;

        while (i < formula.length && /[A-Za-z0-9_]/.test(formula[i])) {
          ident += formula[i];
          i++;
        }

        const upperIdent = ident.toUpperCase();
        if (FORBIDDEN_IDENTIFIERS.has(upperIdent)) {
          throw new BusinessRuleError(
            `Forbidden identifier '${ident}' detected in formula`,
            'DANGEROUS_FORMULA'
          );
        }

        tokens.push({ type: 'IDENTIFIER', value: upperIdent, position: startPos });
        continue;
      }

      // Arithmetic operators & parentheses
      if (char === '+') {
        tokens.push({ type: 'PLUS', value: '+', position: i++ });
      } else if (char === '-') {
        tokens.push({ type: 'MINUS', value: '-', position: i++ });
      } else if (char === '*') {
        tokens.push({ type: 'STAR', value: '*', position: i++ });
      } else if (char === '/') {
        tokens.push({ type: 'SLASH', value: '/', position: i++ });
      } else if (char === '%') {
        tokens.push({ type: 'PERCENT', value: '%', position: i++ });
      } else if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(', position: i++ });
      } else if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')', position: i++ });
      } else {
        throw new BusinessRuleError(
          `Unsupported character '${char}' in formula expression`,
          'DANGEROUS_FORMULA'
        );
      }
    }

    tokens.push({ type: 'EOF', value: '', position: formula.length });
    return tokens;
  }

  /**
   * Extracts all variable identifier references from a formula string.
   */
  public static extractVariables(formula: string): string[] {
    const tokens = this.tokenize(formula);
    const vars = new Set<string>();

    for (const token of tokens) {
      if (token.type === 'IDENTIFIER') {
        vars.add(token.value);
      }
    }

    return Array.from(vars);
  }

  /**
   * Validates that a formula expression has valid syntax and uses safe tokens.
   */
  public static validateFormula(formula: string): void {
    if (!formula || !formula.trim()) {
      throw new BusinessRuleError('Formula expression cannot be empty', 'EMPTY_FORMULA');
    }

    const tokens = this.tokenize(formula);
    // Parse using dummy context with all variables allowed
    const parser = new FormulaParser(tokens, (name) => 1);
    parser.parse();
  }

  /**
   * Evaluates a formula safely against a supplied context dictionary.
   * Returns authoritative deterministic numeric result rounded to 2 decimal places.
   */
  public static evaluate(formula: string, context: Record<string, number>): number {
    if (!formula || !formula.trim()) {
      throw new BusinessRuleError('Formula expression cannot be empty', 'EMPTY_FORMULA');
    }

    const normalizedContext: Record<string, number> = {};
    for (const [k, v] of Object.entries(context)) {
      normalizedContext[k.toUpperCase()] = Number(v) || 0;
    }

    const tokens = this.tokenize(formula);

    const resolveVariable = (varName: string): number => {
      const upper = varName.toUpperCase();
      if (!(upper in normalizedContext)) {
        throw new BusinessRuleError(
          `Unknown variable '${varName}' in formula expression. Variable is not available in payroll context.`,
          'UNKNOWN_FORMULA_VARIABLE'
        );
      }
      return normalizedContext[upper];
    };

    const parser = new FormulaParser(tokens, resolveVariable);
    const result = parser.parse();

    if (!Number.isFinite(result) || Number.isNaN(result)) {
      return 0.0;
    }

    return parseFloat(result.toFixed(2));
  }
}

/**
 * Strict Recursive Descent Parser for safe arithmetic formulas.
 * Grammar:
 *   Expr   -> Term (('+' | '-') Term)*
 *   Term   -> Factor (('*' | '/' | '%') Factor)*
 *   Factor -> ('+' | '-') Factor | Primary
 *   Primary -> NUMBER | IDENTIFIER | '(' Expr ')'
 */
class FormulaParser {
  private current = 0;

  constructor(
    private tokens: Token[],
    private resolveVar: (name: string) => number
  ) {}

  public parse(): number {
    if (this.tokens.length === 0 || this.tokens[0].type === 'EOF') {
      throw new BusinessRuleError('Empty formula expression', 'MALFORMED_FORMULA');
    }
    const val = this.parseExpression();
    if (this.peek().type !== 'EOF') {
      throw new BusinessRuleError(
        `Unexpected token '${this.peek().value}' after valid expression at position ${this.peek().position}`,
        'MALFORMED_FORMULA'
      );
    }
    return val;
  }

  private parseExpression(): number {
    let result = this.parseTerm();

    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.consume();
      const right = this.parseTerm();
      if (op.type === 'PLUS') {
        result += right;
      } else {
        result -= right;
      }
    }

    return result;
  }

  private parseTerm(): number {
    let result = this.parseFactor();

    while (
      this.peek().type === 'STAR' ||
      this.peek().type === 'SLASH' ||
      this.peek().type === 'PERCENT'
    ) {
      const op = this.consume();
      const right = this.parseFactor();

      if (op.type === 'STAR') {
        result *= right;
      } else if (op.type === 'SLASH') {
        // Safe division by zero protection: returns 0 if dividing by zero
        if (right === 0) {
          result = 0;
        } else {
          result /= right;
        }
      } else if (op.type === 'PERCENT') {
        if (right === 0) {
          result = 0;
        } else {
          result %= right;
        }
      }
    }

    return result;
  }

  private parseFactor(): number {
    // Unary operators: + or -
    if (this.peek().type === 'PLUS') {
      this.consume();
      return this.parseFactor();
    }
    if (this.peek().type === 'MINUS') {
      this.consume();
      return -this.parseFactor();
    }

    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.consume();
      return parseFloat(token.value);
    }

    if (token.type === 'IDENTIFIER') {
      this.consume();
      return this.resolveVar(token.value);
    }

    if (token.type === 'LPAREN') {
      this.consume(); // eat '('
      const val = this.parseExpression();
      if (this.peek().type !== 'RPAREN') {
        throw new BusinessRuleError(
          `Mismatched parentheses: expected ')' at position ${this.peek().position}`,
          'MALFORMED_FORMULA'
        );
      }
      this.consume(); // eat ')'
      return val;
    }

    throw new BusinessRuleError(
      `Unexpected token '${token.value || 'EOF'}' at position ${token.position}`,
      'MALFORMED_FORMULA'
    );
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', position: -1 };
  }

  private consume(): Token {
    const token = this.peek();
    this.current++;
    return token;
  }
}
