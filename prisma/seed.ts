import { PrismaClient, DayOfWeek, Gender, EmploymentType, EmployeeStatus, WageType, ContractStatus, AttendanceStatus, TimeOffUnit, AllocationStatus, TimeOffStatus, SalaryRuleCategory, ComputationType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateUuidV7 } from '../lib/utils/id';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting PeoplePay360 database seed...');

  // --------------------------------------------------------------------------
  // 1. SEED ROLES
  // --------------------------------------------------------------------------
  console.log('Seeding canonical system roles...');
  const roleEmployee = await prisma.role.upsert({
    where: { code: 'EMPLOYEE' },
    update: { name: 'Employee', isSystem: true },
    create: {
      id: generateUuidV7(),
      code: 'EMPLOYEE',
      name: 'Employee',
      description: 'Self-service employee access to view profile, attendance, leaves, and payslips',
      isSystem: true,
    },
  });

  const roleHrManager = await prisma.role.upsert({
    where: { code: 'HR_MANAGER' },
    update: { name: 'HR Manager', isSystem: true },
    create: {
      id: generateUuidV7(),
      code: 'HR_MANAGER',
      name: 'HR Manager',
      description: 'Full CRUD access to HR master data, contracts, schedules, attendance, and leaves',
      isSystem: true,
    },
  });

  const rolePayrollUser = await prisma.role.upsert({
    where: { code: 'HR_PAYROLL_USER' },
    update: { name: 'HR Payroll User', isSystem: true },
    create: {
      id: generateUuidV7(),
      code: 'HR_PAYROLL_USER',
      name: 'HR Payroll User',
      description: 'HR Manager permissions plus create, read, and compute Payruns and Payslips',
      isSystem: true,
    },
  });

  const rolePayrollManager = await prisma.role.upsert({
    where: { code: 'HR_PAYROLL_MANAGER' },
    update: { name: 'HR Payroll Manager', isSystem: true },
    create: {
      id: generateUuidV7(),
      code: 'HR_PAYROLL_MANAGER',
      name: 'HR Payroll Manager',
      description: 'Full management of HR, Payruns, Payslips, Salary Structures, and Rules',
      isSystem: true,
    },
  });

  const roleAdmin = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { name: 'Admin', isSystem: true },
    create: {
      id: generateUuidV7(),
      code: 'ADMIN',
      name: 'Admin',
      description: 'Complete system administration, user management, and permission matrix overrides',
      isSystem: true,
    },
  });

  // --------------------------------------------------------------------------
  // 2. SEED PERMISSIONS
  // --------------------------------------------------------------------------
  console.log('Seeding system permissions...');
  const permissionDefs = [
    // Employee self-service
    { code: 'employee.self.read', name: 'View Own Employee Profile', module: 'EMPLOYEE' },
    { code: 'attendance.self', name: 'Check-in and Check-out Self', module: 'ATTENDANCE' },
    { code: 'timeoff.request.self', name: 'Create Own Leave Requests', module: 'TIMEOFF' },
    { code: 'payslip.self.read', name: 'View Own Payslips', module: 'PAYROLL' },

    // HR Operations
    { code: 'employee.read', name: 'View All Employee Records', module: 'EMPLOYEE' },
    { code: 'employee.write', name: 'Create and Edit Employees', module: 'EMPLOYEE' },
    { code: 'department.manage', name: 'Manage Departments', module: 'EMPLOYEE' },
    { code: 'job_position.manage', name: 'Manage Job Positions', module: 'EMPLOYEE' },
    { code: 'schedule.manage', name: 'Manage Working Schedules', module: 'EMPLOYEE' },
    { code: 'contract.read', name: 'View Employment Contracts', module: 'CONTRACT' },
    { code: 'contract.write', name: 'Create and Edit Contracts', module: 'CONTRACT' },
    { code: 'attendance.read', name: 'View All Attendance Logs', module: 'ATTENDANCE' },
    { code: 'attendance.correct', name: 'Perform Manual Attendance Corrections', module: 'ATTENDANCE' },
    { code: 'timeoff.type.manage', name: 'Configure Time Off Types', module: 'TIMEOFF' },
    { code: 'timeoff.allocation.manage', name: 'Create and Approve Leave Allocations', module: 'TIMEOFF' },
    { code: 'timeoff.request.read', name: 'View All Time Off Requests', module: 'TIMEOFF' },
    { code: 'timeoff.request.approve', name: 'Approve or Refuse Time Off Requests', module: 'TIMEOFF' },

    // Payroll Operations
    { code: 'payroll.structure.read', name: 'View Salary Structures', module: 'PAYROLL' },
    { code: 'payroll.structure.write', name: 'Manage Salary Structures', module: 'PAYROLL' },
    { code: 'payroll.rule.read', name: 'View Salary Rules', module: 'PAYROLL' },
    { code: 'payroll.rule.write', name: 'Manage Salary Rules', module: 'PAYROLL' },
    { code: 'payroll.payrun.read', name: 'View Payruns and Payslips', module: 'PAYROLL' },
    { code: 'payroll.payrun.create', name: 'Create Payruns', module: 'PAYROLL' },
    { code: 'payroll.payrun.compute', name: 'Compute Payslips', module: 'PAYROLL' },
    { code: 'payroll.payrun.validate', name: 'Validate and Lock Payruns', module: 'PAYROLL' },
    { code: 'payroll.payrun.pay', name: 'Mark Payruns Paid and Send Emails', module: 'PAYROLL' },

    // Administration
    { code: 'admin.user.manage', name: 'Manage User Accounts', module: 'ADMIN' },
    { code: 'admin.role.manage', name: 'Assign User Roles', module: 'ADMIN' },
    { code: 'admin.permission.manage', name: 'Update Role Permissions', module: 'ADMIN' },
  ];

  const permissionsMap = new Map<string, string>();
  for (const perm of permissionDefs) {
    const p = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module },
      create: {
        id: generateUuidV7(),
        code: perm.code,
        name: perm.name,
        module: perm.module,
      },
    });
    permissionsMap.set(perm.code, p.id);
  }

  // --------------------------------------------------------------------------
  // 3. ROLE-PERMISSION MAPPINGS
  // --------------------------------------------------------------------------
  console.log('Mapping permissions to roles...');
  const rolePermissions: Record<string, string[]> = {
    EMPLOYEE: [
      'employee.self.read',
      'attendance.self',
      'timeoff.request.self',
      'payslip.self.read',
    ],
    HR_MANAGER: [
      'employee.self.read',
      'attendance.self',
      'timeoff.request.self',
      'payslip.self.read',
      'employee.read',
      'employee.write',
      'department.manage',
      'job_position.manage',
      'schedule.manage',
      'contract.read',
      'contract.write',
      'attendance.read',
      'attendance.correct',
      'timeoff.type.manage',
      'timeoff.allocation.manage',
      'timeoff.request.read',
      'timeoff.request.approve',
    ],
    HR_PAYROLL_USER: [
      // All HR Manager permissions +
      'employee.self.read',
      'attendance.self',
      'timeoff.request.self',
      'payslip.self.read',
      'employee.read',
      'employee.write',
      'department.manage',
      'job_position.manage',
      'schedule.manage',
      'contract.read',
      'contract.write',
      'attendance.read',
      'attendance.correct',
      'timeoff.type.manage',
      'timeoff.allocation.manage',
      'timeoff.request.read',
      'timeoff.request.approve',
      'payroll.structure.read',
      'payroll.rule.read',
      'payroll.payrun.read',
      'payroll.payrun.create',
      'payroll.payrun.compute',
    ],
    HR_PAYROLL_MANAGER: [
      // Full HR and Payroll
      'employee.self.read',
      'attendance.self',
      'timeoff.request.self',
      'payslip.self.read',
      'employee.read',
      'employee.write',
      'department.manage',
      'job_position.manage',
      'schedule.manage',
      'contract.read',
      'contract.write',
      'attendance.read',
      'attendance.correct',
      'timeoff.type.manage',
      'timeoff.allocation.manage',
      'timeoff.request.read',
      'timeoff.request.approve',
      'payroll.structure.read',
      'payroll.structure.write',
      'payroll.rule.read',
      'payroll.rule.write',
      'payroll.payrun.read',
      'payroll.payrun.create',
      'payroll.payrun.compute',
      'payroll.payrun.validate',
      'payroll.payrun.pay',
    ],
    ADMIN: Array.from(permissionsMap.keys()), // All permissions
  };

  const rolesObj = {
    EMPLOYEE: roleEmployee,
    HR_MANAGER: roleHrManager,
    HR_PAYROLL_USER: rolePayrollUser,
    HR_PAYROLL_MANAGER: rolePayrollManager,
    ADMIN: roleAdmin,
  };

  for (const [roleCode, permCodes] of Object.entries(rolePermissions)) {
    const role = rolesObj[roleCode as keyof typeof rolesObj];
    for (const code of permCodes) {
      const permissionId = permissionsMap.get(code);
      if (permissionId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId,
            },
          },
          update: {},
          create: {
            id: generateUuidV7(),
            roleId: role.id,
            permissionId,
          },
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. SEED USERS (Development Credentials: Password123!)
  // --------------------------------------------------------------------------
  console.log('Seeding development users...');
  const devPasswordHash = await bcrypt.hash('Password123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@peoplepay360.com' },
    update: { roleId: roleAdmin.id, passwordHash: devPasswordHash },
    create: {
      id: generateUuidV7(),
      email: 'admin@peoplepay360.com',
      passwordHash: devPasswordHash,
      roleId: roleAdmin.id,
      isActive: true,
    },
  });

  const hrManagerUser = await prisma.user.upsert({
    where: { email: 'hr.manager@peoplepay360.com' },
    update: { roleId: roleHrManager.id, passwordHash: devPasswordHash },
    create: {
      id: generateUuidV7(),
      email: 'hr.manager@peoplepay360.com',
      passwordHash: devPasswordHash,
      roleId: roleHrManager.id,
      isActive: true,
    },
  });

  const payrollManagerUser = await prisma.user.upsert({
    where: { email: 'payroll.manager@peoplepay360.com' },
    update: { roleId: rolePayrollManager.id, passwordHash: devPasswordHash },
    create: {
      id: generateUuidV7(),
      email: 'payroll.manager@peoplepay360.com',
      passwordHash: devPasswordHash,
      roleId: rolePayrollManager.id,
      isActive: true,
    },
  });

  const payrollUser = await prisma.user.upsert({
    where: { email: 'payroll.user@peoplepay360.com' },
    update: { roleId: rolePayrollUser.id, passwordHash: devPasswordHash },
    create: {
      id: generateUuidV7(),
      email: 'payroll.user@peoplepay360.com',
      passwordHash: devPasswordHash,
      roleId: rolePayrollUser.id,
      isActive: true,
    },
  });

  const johnDoeUser = await prisma.user.upsert({
    where: { email: 'john.doe@peoplepay360.com' },
    update: { roleId: roleEmployee.id, passwordHash: devPasswordHash },
    create: {
      id: generateUuidV7(),
      email: 'john.doe@peoplepay360.com',
      passwordHash: devPasswordHash,
      roleId: roleEmployee.id,
      isActive: true,
    },
  });

  const sarahSmithUser = await prisma.user.upsert({
    where: { email: 'sarah.smith@peoplepay360.com' },
    update: { roleId: roleEmployee.id, passwordHash: devPasswordHash },
    create: {
      id: generateUuidV7(),
      email: 'sarah.smith@peoplepay360.com',
      passwordHash: devPasswordHash,
      roleId: roleEmployee.id,
      isActive: true,
    },
  });

  // --------------------------------------------------------------------------
  // 5. SEED DEPARTMENTS & JOB POSITIONS
  // --------------------------------------------------------------------------
  console.log('Seeding departments and job positions...');
  const deptEng = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: { name: 'Engineering' },
    create: {
      id: generateUuidV7(),
      name: 'Engineering',
      code: 'ENG',
      isActive: true,
    },
  });

  const deptHr = await prisma.department.upsert({
    where: { code: 'HR' },
    update: { name: 'Human Resources' },
    create: {
      id: generateUuidV7(),
      name: 'Human Resources',
      code: 'HR',
      isActive: true,
    },
  });

  const deptFin = await prisma.department.upsert({
    where: { code: 'FIN' },
    update: { name: 'Finance & Operations' },
    create: {
      id: generateUuidV7(),
      name: 'Finance & Operations',
      code: 'FIN',
      isActive: true,
    },
  });

  const posDevSr = await prisma.jobPosition.upsert({
    where: { code: 'DEV-SR' },
    update: { title: 'Senior Software Engineer', departmentId: deptEng.id },
    create: {
      id: generateUuidV7(),
      title: 'Senior Software Engineer',
      code: 'DEV-SR',
      departmentId: deptEng.id,
      description: 'Full stack development and architectural design',
    },
  });

  const posQa = await prisma.jobPosition.upsert({
    where: { code: 'QA-ENG' },
    update: { title: 'QA Automation Engineer', departmentId: deptEng.id },
    create: {
      id: generateUuidV7(),
      title: 'QA Automation Engineer',
      code: 'QA-ENG',
      departmentId: deptEng.id,
      description: 'Test automation and quality assurance',
    },
  });

  const posHrSpec = await prisma.jobPosition.upsert({
    where: { code: 'HR-SPEC' },
    update: { title: 'HR Operations Specialist', departmentId: deptHr.id },
    create: {
      id: generateUuidV7(),
      title: 'HR Operations Specialist',
      code: 'HR-SPEC',
      departmentId: deptHr.id,
      description: 'People operations, contract management, and time off',
    },
  });

  const posPaySr = await prisma.jobPosition.upsert({
    where: { code: 'PAY-SR' },
    update: { title: 'Senior Payroll Analyst', departmentId: deptFin.id },
    create: {
      id: generateUuidV7(),
      title: 'Senior Payroll Analyst',
      code: 'PAY-SR',
      departmentId: deptFin.id,
      description: 'Payroll processing, statutory compliance, and audits',
    },
  });

  // --------------------------------------------------------------------------
  // 6. SEED WORKING SCHEDULES & DAYS
  // --------------------------------------------------------------------------
  console.log('Seeding working schedules...');
  const standardSchedule = await prisma.workingSchedule.upsert({
    where: { code: 'STD_40H' },
    update: { totalWeeklyHours: 40.0 },
    create: {
      id: generateUuidV7(),
      name: 'Standard 40-Hour Week',
      code: 'STD_40H',
      totalWeeklyHours: 40.0,
      isActive: true,
    },
  });

  const days: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  for (const day of days) {
    await prisma.workingScheduleDay.upsert({
      where: {
        workingScheduleId_dayOfWeek: {
          workingScheduleId: standardSchedule.id,
          dayOfWeek: day,
        },
      },
      update: {
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        dayWorkHours: 8.0,
      },
      create: {
        id: generateUuidV7(),
        workingScheduleId: standardSchedule.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        dayWorkHours: 8.0,
      },
    });
  }

  // --------------------------------------------------------------------------
  // 7. SEED SALARY STRUCTURE & RULES
  // --------------------------------------------------------------------------
  console.log('Seeding salary rules and structures...');
  const salaryRulesData = [
    {
      code: 'BASIC',
      name: 'Basic Salary',
      category: SalaryRuleCategory.BASIC,
      sequence: 10,
      computationType: ComputationType.FIXED,
      fixedAmount: 0.0, // Dynamically sourced from contract wage
      formulaExpression: null,
      description: 'Contract base monthly salary',
    },
    {
      code: 'HRA',
      name: 'House Rent Allowance',
      category: SalaryRuleCategory.ALLOWANCE,
      sequence: 20,
      computationType: ComputationType.PERCENTAGE,
      percentageBaseCode: 'BASIC',
      percentageRate: 40.0,
      formulaExpression: null,
      description: '40% of Basic Salary for housing',
    },
    {
      code: 'TRANSPORT',
      name: 'Transport Allowance',
      category: SalaryRuleCategory.ALLOWANCE,
      sequence: 30,
      computationType: ComputationType.FIXED,
      fixedAmount: 3000.0,
      formulaExpression: null,
      description: 'Fixed monthly transit allowance',
    },
    {
      code: 'GROSS',
      name: 'Gross Salary',
      category: SalaryRuleCategory.GROSS,
      sequence: 50,
      computationType: ComputationType.FORMULA,
      formulaExpression: 'BASIC + HRA + TRANSPORT',
      description: 'Total earnings before deductions',
    },
    {
      code: 'PF',
      name: 'Provident Fund (Employee)',
      category: SalaryRuleCategory.DEDUCTION,
      sequence: 60,
      computationType: ComputationType.PERCENTAGE,
      percentageBaseCode: 'BASIC',
      percentageRate: 12.0,
      formulaExpression: null,
      description: '12% statutory employee contribution',
    },
    {
      code: 'TAX',
      name: 'Income Tax Deduction',
      category: SalaryRuleCategory.DEDUCTION,
      sequence: 70,
      computationType: ComputationType.PERCENTAGE,
      percentageBaseCode: 'GROSS',
      percentageRate: 10.0,
      formulaExpression: null,
      description: 'Estimated standard tax withholding',
    },
    {
      code: 'UNPAID_DEDUCTION',
      name: 'Unpaid Leave Deduction',
      category: SalaryRuleCategory.DEDUCTION,
      sequence: 80,
      computationType: ComputationType.FORMULA,
      formulaExpression: '(UNPAID_DAYS / SCHEDULED_DAYS) * BASIC',
      description: 'Prorated salary reduction for approved unpaid leave',
    },
    {
      code: 'NET',
      name: 'Net Salary',
      category: SalaryRuleCategory.NET,
      sequence: 100,
      computationType: ComputationType.FORMULA,
      formulaExpression: 'GROSS - PF - TAX - UNPAID_DEDUCTION',
      description: 'Final take-home payout',
    },
    {
      code: 'EMPLOYER_PF',
      name: 'Provident Fund (Employer)',
      category: SalaryRuleCategory.COMPANY_CONTRIBUTION,
      sequence: 110,
      computationType: ComputationType.PERCENTAGE,
      percentageBaseCode: 'BASIC',
      percentageRate: 12.0,
      formulaExpression: null,
      description: '12% employer statutory match',
    },
  ];

  const ruleRecords = new Map<string, string>();
  for (const rule of salaryRulesData) {
    const rec = await prisma.salaryRule.upsert({
      where: { code: rule.code },
      update: {
        name: rule.name,
        category: rule.category,
        sequence: rule.sequence,
        computationType: rule.computationType,
        fixedAmount: rule.fixedAmount,
        percentageBaseCode: rule.percentageBaseCode,
        percentageRate: rule.percentageRate,
        formulaExpression: rule.formulaExpression,
        description: rule.description,
      },
      create: {
        id: generateUuidV7(),
        code: rule.code,
        name: rule.name,
        category: rule.category,
        sequence: rule.sequence,
        computationType: rule.computationType,
        fixedAmount: rule.fixedAmount,
        percentageBaseCode: rule.percentageBaseCode,
        percentageRate: rule.percentageRate,
        formulaExpression: rule.formulaExpression,
        description: rule.description,
      },
    });
    ruleRecords.set(rule.code, rec.id);
  }

  const standardSalaryStructure = await prisma.salaryStructure.upsert({
    where: { code: 'REG_FULLTIME_STRUCTURE' },
    update: { name: 'Regular Full-Time Structure' },
    create: {
      id: generateUuidV7(),
      name: 'Regular Full-Time Structure',
      code: 'REG_FULLTIME_STRUCTURE',
      description: 'Standard salary structure for permanent employees',
      isActive: true,
    },
  });

  for (const rule of salaryRulesData) {
    const ruleId = ruleRecords.get(rule.code);
    if (ruleId) {
      await prisma.salaryStructureRule.upsert({
        where: {
          salaryStructureId_salaryRuleId: {
            salaryStructureId: standardSalaryStructure.id,
            salaryRuleId: ruleId,
          },
        },
        update: { sequenceOverride: rule.sequence },
        create: {
          id: generateUuidV7(),
          salaryStructureId: standardSalaryStructure.id,
          salaryRuleId: ruleId,
          sequenceOverride: rule.sequence,
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // 8. SEED EMPLOYEES & MANAGERS
  // --------------------------------------------------------------------------
  console.log('Seeding employees...');
  // 1. David Chen (Engineering Lead & Manager)
  const empDavid = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-00101' },
    update: {},
    create: {
      id: generateUuidV7(),
      employeeNumber: 'EMP-00101',
      firstName: 'David',
      lastName: 'Chen',
      email: 'david.chen@peoplepay360.com',
      phone: '+1-555-0101',
      dateOfBirth: new Date('1988-04-12'),
      gender: Gender.MALE,
      departmentId: deptEng.id,
      jobPositionId: posDevSr.id,
      workingScheduleId: standardSchedule.id,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      hireDate: new Date('2024-01-15'),
      bankName: 'Silicon Valley Bank',
      bankAccountNumber: '9876543210',
      bankRoutingCode: 'SVB12345',
      panOrTaxId: 'TAX-DC-8812',
    },
  });

  // 2. John Doe (Senior Developer reporting to David)
  const empJohn = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-00102' },
    update: { userId: johnDoeUser.id },
    create: {
      id: generateUuidV7(),
      employeeNumber: 'EMP-00102',
      userId: johnDoeUser.id,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@peoplepay360.com',
      phone: '+1-555-0102',
      dateOfBirth: new Date('1992-08-20'),
      gender: Gender.MALE,
      departmentId: deptEng.id,
      jobPositionId: posDevSr.id,
      managerId: empDavid.id,
      workingScheduleId: standardSchedule.id,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      hireDate: new Date('2025-01-01'),
      bankName: 'Chase Bank',
      bankAccountNumber: '1234567890',
      bankRoutingCode: 'CHAS0099',
      panOrTaxId: 'TAX-JD-9208',
    },
  });

  // 3. Sarah Smith (QA Engineer reporting to David)
  const empSarah = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-00103' },
    update: { userId: sarahSmithUser.id },
    create: {
      id: generateUuidV7(),
      employeeNumber: 'EMP-00103',
      userId: sarahSmithUser.id,
      firstName: 'Sarah',
      lastName: 'Smith',
      email: 'sarah.smith@peoplepay360.com',
      phone: '+1-555-0103',
      dateOfBirth: new Date('1995-11-14'),
      gender: Gender.FEMALE,
      departmentId: deptEng.id,
      jobPositionId: posQa.id,
      managerId: empDavid.id,
      workingScheduleId: standardSchedule.id,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      hireDate: new Date('2025-06-01'),
      bankName: 'Bank of America',
      bankAccountNumber: '4455667788',
      bankRoutingCode: 'BOFA1122',
      panOrTaxId: 'TAX-SS-9511',
    },
  });

  // 4. Rachel Green (HR Operations Specialist & HR Manager user)
  const empRachel = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-00100' },
    update: { userId: hrManagerUser.id },
    create: {
      id: generateUuidV7(),
      employeeNumber: 'EMP-00100',
      userId: hrManagerUser.id,
      firstName: 'Rachel',
      lastName: 'Green',
      email: 'hr.manager@peoplepay360.com',
      phone: '+1-555-0100',
      dateOfBirth: new Date('1990-03-05'),
      gender: Gender.FEMALE,
      departmentId: deptHr.id,
      jobPositionId: posHrSpec.id,
      workingScheduleId: standardSchedule.id,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      hireDate: new Date('2024-03-01'),
      bankName: 'Wells Fargo',
      bankAccountNumber: '5566778899',
      bankRoutingCode: 'WFAR3344',
      panOrTaxId: 'TAX-RG-9003',
    },
  });

  // Link department managers
  await prisma.department.update({
    where: { id: deptEng.id },
    data: { managerId: empDavid.id },
  });
  await prisma.department.update({
    where: { id: deptHr.id },
    data: { managerId: empRachel.id },
  });

  // --------------------------------------------------------------------------
  // 9. SEED CONTRACTS (Historical and Active)
  // --------------------------------------------------------------------------
  console.log('Seeding historical and active contracts...');
  // John Doe historical contract (2025 - expired)
  await prisma.contract.upsert({
    where: { contractNumber: 'CON-2025-JD1' },
    update: {},
    create: {
      id: generateUuidV7(),
      contractNumber: 'CON-2025-JD1',
      employeeId: empJohn.id,
      departmentId: deptEng.id,
      jobPositionId: posDevSr.id,
      workingScheduleId: standardSchedule.id,
      salaryStructureId: standardSalaryStructure.id,
      wage: 50000.0,
      wageType: WageType.MONTHLY,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      status: ContractStatus.EXPIRED,
      notes: 'Initial 2025 employment contract',
    },
  });

  // John Doe current active contract (2026 - open ended)
  const contractJohnActive = await prisma.contract.upsert({
    where: { contractNumber: 'CON-2026-JD2' },
    update: { wage: 60000.0, status: ContractStatus.ACTIVE },
    create: {
      id: generateUuidV7(),
      contractNumber: 'CON-2026-JD2',
      employeeId: empJohn.id,
      departmentId: deptEng.id,
      jobPositionId: posDevSr.id,
      workingScheduleId: standardSchedule.id,
      salaryStructureId: standardSalaryStructure.id,
      wage: 60000.0,
      wageType: WageType.MONTHLY,
      startDate: new Date('2026-01-01'),
      endDate: null, // Open-ended
      status: ContractStatus.ACTIVE,
      notes: 'Promoted 2026 contract with compensation revision',
    },
  });

  // Sarah Smith active contract (2026)
  const contractSarahActive = await prisma.contract.upsert({
    where: { contractNumber: 'CON-2026-SS1' },
    update: { wage: 45000.0, status: ContractStatus.ACTIVE },
    create: {
      id: generateUuidV7(),
      contractNumber: 'CON-2026-SS1',
      employeeId: empSarah.id,
      departmentId: deptEng.id,
      jobPositionId: posQa.id,
      workingScheduleId: standardSchedule.id,
      salaryStructureId: standardSalaryStructure.id,
      wage: 45000.0,
      wageType: WageType.MONTHLY,
      startDate: new Date('2026-01-01'),
      endDate: null,
      status: ContractStatus.ACTIVE,
    },
  });

  // David Chen active contract (2026)
  await prisma.contract.upsert({
    where: { contractNumber: 'CON-2026-DC1' },
    update: { wage: 75000.0, status: ContractStatus.ACTIVE },
    create: {
      id: generateUuidV7(),
      contractNumber: 'CON-2026-DC1',
      employeeId: empDavid.id,
      departmentId: deptEng.id,
      jobPositionId: posDevSr.id,
      workingScheduleId: standardSchedule.id,
      salaryStructureId: standardSalaryStructure.id,
      wage: 75000.0,
      wageType: WageType.MONTHLY,
      startDate: new Date('2026-01-01'),
      endDate: null,
      status: ContractStatus.ACTIVE,
    },
  });

  // Rachel Green active contract (2026)
  await prisma.contract.upsert({
    where: { contractNumber: 'CON-2026-RG1' },
    update: { wage: 55000.0, status: ContractStatus.ACTIVE },
    create: {
      id: generateUuidV7(),
      contractNumber: 'CON-2026-RG1',
      employeeId: empRachel.id,
      departmentId: deptHr.id,
      jobPositionId: posHrSpec.id,
      workingScheduleId: standardSchedule.id,
      salaryStructureId: standardSalaryStructure.id,
      wage: 55000.0,
      wageType: WageType.MONTHLY,
      startDate: new Date('2026-01-01'),
      endDate: null,
      status: ContractStatus.ACTIVE,
    },
  });

  // --------------------------------------------------------------------------
  // 10. SEED TIME OFF TYPES & ALLOCATIONS
  // --------------------------------------------------------------------------
  console.log('Seeding time off types and allocations...');
  const leavePto = await prisma.timeOffType.upsert({
    where: { code: 'PTO' },
    update: { name: 'Paid Time Off', unit: TimeOffUnit.DAYS, isPaid: true },
    create: {
      id: generateUuidV7(),
      name: 'Paid Time Off',
      code: 'PTO',
      unit: TimeOffUnit.DAYS,
      requiresAllocation: true,
      isPaid: true,
      color: '#10B981',
    },
  });

  const leaveSick = await prisma.timeOffType.upsert({
    where: { code: 'SICK' },
    update: { name: 'Sick Leave', unit: TimeOffUnit.DAYS, isPaid: true },
    create: {
      id: generateUuidV7(),
      name: 'Sick Leave',
      code: 'SICK',
      unit: TimeOffUnit.DAYS,
      requiresAllocation: true,
      isPaid: true,
      color: '#EF4444',
    },
  });

  const leaveUnpaid = await prisma.timeOffType.upsert({
    where: { code: 'UNPAID' },
    update: { name: 'Unpaid Leave', unit: TimeOffUnit.DAYS, isPaid: false },
    create: {
      id: generateUuidV7(),
      name: 'Unpaid Leave',
      code: 'UNPAID',
      unit: TimeOffUnit.DAYS,
      requiresAllocation: false,
      isPaid: false,
      color: '#6B7280',
    },
  });

  const leaveHourlyPto = await prisma.timeOffType.upsert({
    where: { code: 'HOURLY_PTO' },
    update: { name: 'Hourly Medical / Personal Leave', unit: TimeOffUnit.HOURS, isPaid: true },
    create: {
      id: generateUuidV7(),
      name: 'Hourly Medical / Personal Leave',
      code: 'HOURLY_PTO',
      unit: TimeOffUnit.HOURS,
      requiresAllocation: true,
      isPaid: true,
      color: '#8B5CF6',
    },
  });

  // Allocation for John Doe (20 days PTO)
  const allocJohnPto = await prisma.timeOffAllocation.upsert({
    where: { allocationNumber: 'ALC-2026-JD-PTO' },
    update: {},
    create: {
      id: generateUuidV7(),
      allocationNumber: 'ALC-2026-JD-PTO',
      employeeId: empJohn.id,
      timeOffTypeId: leavePto.id,
      allocatedQuantity: 20.0,
      takenQuantity: 2.0,
      remainingQuantity: 18.0,
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-12-31'),
      status: AllocationStatus.APPROVED,
      approvedById: hrManagerUser.id,
      approvedAt: new Date('2026-01-02T10:00:00Z'),
      notes: 'Annual 2026 PTO entitlement',
    },
  });

  // Allocation for John Doe (16 hours Hourly Leave)
  const allocJohnHourly = await prisma.timeOffAllocation.upsert({
    where: { allocationNumber: 'ALC-2026-JD-HRS' },
    update: {},
    create: {
      id: generateUuidV7(),
      allocationNumber: 'ALC-2026-JD-HRS',
      employeeId: empJohn.id,
      timeOffTypeId: leaveHourlyPto.id,
      allocatedQuantity: 16.0,
      takenQuantity: 4.0,
      remainingQuantity: 12.0,
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-12-31'),
      status: AllocationStatus.APPROVED,
      approvedById: hrManagerUser.id,
      approvedAt: new Date('2026-01-02T10:00:00Z'),
      notes: '16 hours medical/personal flexibility grant',
    },
  });

  // Allocation for Sarah Smith (15 days PTO)
  await prisma.timeOffAllocation.upsert({
    where: { allocationNumber: 'ALC-2026-SS-PTO' },
    update: {},
    create: {
      id: generateUuidV7(),
      allocationNumber: 'ALC-2026-SS-PTO',
      employeeId: empSarah.id,
      timeOffTypeId: leavePto.id,
      allocatedQuantity: 15.0,
      takenQuantity: 0.0,
      remainingQuantity: 15.0,
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-12-31'),
      status: AllocationStatus.APPROVED,
      approvedById: hrManagerUser.id,
      approvedAt: new Date('2026-01-02T10:00:00Z'),
    },
  });

  // --------------------------------------------------------------------------
  // 11. SEED TIME OFF REQUESTS (Demonstrating DAYS and HOURS)
  // --------------------------------------------------------------------------
  console.log('Seeding time off requests...');
  // John Doe: 2 Days PTO approved
  await prisma.timeOffRequest.upsert({
    where: { requestNumber: 'REQ-2026-0001' },
    update: {},
    create: {
      id: generateUuidV7(),
      requestNumber: 'REQ-2026-0001',
      employeeId: empJohn.id,
      timeOffTypeId: leavePto.id,
      allocationId: allocJohnPto.id,
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-02-11'),
      startTime: null,
      endTime: null,
      durationQuantity: 2.0,
      reason: 'Personal vacation',
      status: TimeOffStatus.APPROVED,
      approvedById: hrManagerUser.id,
      approvedAt: new Date('2026-02-05T14:30:00Z'),
    },
  });

  // John Doe: 4 Hours Medical Leave approved (HOURS support)
  await prisma.timeOffRequest.upsert({
    where: { requestNumber: 'REQ-2026-0002' },
    update: {},
    create: {
      id: generateUuidV7(),
      requestNumber: 'REQ-2026-0002',
      employeeId: empJohn.id,
      timeOffTypeId: leaveHourlyPto.id,
      allocationId: allocJohnHourly.id,
      startDate: new Date('2026-02-20'),
      endDate: new Date('2026-02-20'),
      startTime: '13:00',
      endTime: '17:00',
      durationQuantity: 4.0,
      reason: 'Doctor appointment and follow-up',
      status: TimeOffStatus.APPROVED,
      approvedById: hrManagerUser.id,
      approvedAt: new Date('2026-02-19T09:15:00Z'),
    },
  });

  // Sarah Smith: 1 Day Sick Leave pending
  await prisma.timeOffRequest.upsert({
    where: { requestNumber: 'REQ-2026-0003' },
    update: {},
    create: {
      id: generateUuidV7(),
      requestNumber: 'REQ-2026-0003',
      employeeId: empSarah.id,
      timeOffTypeId: leaveSick.id,
      startDate: new Date('2026-03-05'),
      endDate: new Date('2026-03-05'),
      startTime: null,
      endTime: null,
      durationQuantity: 1.0,
      reason: 'Migraine / rest',
      status: TimeOffStatus.SUBMITTED,
    },
  });

  // --------------------------------------------------------------------------
  // 12. SEED SAMPLE ATTENDANCE LOGS
  // --------------------------------------------------------------------------
  console.log('Seeding representative attendance records...');
  const sampleDates = [
    { date: '2026-03-02', checkIn: '2026-03-02T08:58:00Z', checkOut: '2026-03-02T18:02:00Z', hours: 8.0 },
    { date: '2026-03-03', checkIn: '2026-03-03T09:05:00Z', checkOut: '2026-03-03T18:00:00Z', hours: 8.0 },
    { date: '2026-03-04', checkIn: '2026-03-04T09:00:00Z', checkOut: '2026-03-04T19:00:00Z', hours: 9.0, overtime: 1.0 },
  ];

  for (const log of sampleDates) {
    await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: empJohn.id,
          date: new Date(log.date),
        },
      },
      update: {},
      create: {
        id: generateUuidV7(),
        employeeId: empJohn.id,
        date: new Date(log.date),
        checkIn: new Date(log.checkIn),
        checkOut: new Date(log.checkOut),
        workedHours: log.hours,
        expectedHours: 8.0,
        status: AttendanceStatus.PRESENT,
        isOvertime: (log.overtime ?? 0) > 0,
        overtimeHours: log.overtime ?? 0.0,
      },
    });
  }

  console.log('✅ PeoplePay360 database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
