-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WageType" AS ENUM ('MONTHLY', 'HOURLY');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "TimeOffUnit" AS ENUM ('DAYS', 'HOURS');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'APPROVED', 'REFUSED');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REFUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalaryRuleCategory" AS ENUM ('BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET', 'COMPANY_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "ComputationType" AS ENUM ('FIXED', 'PERCENTAGE', 'FORMULA');

-- CreateEnum
CREATE TYPE "PayrunStatus" AS ENUM ('DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "roleId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "managerId" UUID,
    "parentDepartmentId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosition" (
    "id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "departmentId" UUID NOT NULL,
    "description" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingSchedule" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "totalWeeklyHours" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingScheduleDay" (
    "id" UUID NOT NULL,
    "workingScheduleId" UUID NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "dayWorkHours" DECIMAL(4,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkingScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "employeeNumber" VARCHAR(50) NOT NULL,
    "userId" UUID,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "avatarUrl" VARCHAR(500),
    "dateOfBirth" DATE,
    "gender" "Gender" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "departmentId" UUID NOT NULL,
    "jobPositionId" UUID NOT NULL,
    "managerId" UUID,
    "workingScheduleId" UUID NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" DATE NOT NULL,
    "terminationDate" DATE,
    "bankName" VARCHAR(100),
    "bankAccountNumber" VARCHAR(50),
    "bankRoutingCode" VARCHAR(50),
    "panOrTaxId" VARCHAR(50),
    "address" VARCHAR(255),
    "emergencyContact" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "contractNumber" VARCHAR(50) NOT NULL,
    "employeeId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "jobPositionId" UUID NOT NULL,
    "workingScheduleId" UUID NOT NULL,
    "salaryStructureId" UUID NOT NULL,
    "wage" DECIMAL(12,2) NOT NULL,
    "wageType" "WageType" NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "checkIn" TIMESTAMPTZ(6) NOT NULL,
    "checkOut" TIMESTAMPTZ(6),
    "workedHours" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "expectedHours" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "isOvertime" BOOLEAN NOT NULL DEFAULT false,
    "overtimeHours" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "isManualCorrection" BOOLEAN NOT NULL DEFAULT false,
    "correctionReason" VARCHAR(255),
    "correctedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffType" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "unit" "TimeOffUnit" NOT NULL DEFAULT 'DAYS',
    "requiresAllocation" BOOLEAN NOT NULL DEFAULT true,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TimeOffType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffAllocation" (
    "id" UUID NOT NULL,
    "allocationNumber" VARCHAR(50) NOT NULL,
    "employeeId" UUID NOT NULL,
    "timeOffTypeId" UUID NOT NULL,
    "allocatedQuantity" DECIMAL(5,2) NOT NULL,
    "takenQuantity" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "remainingQuantity" DECIMAL(5,2) NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" VARCHAR(255),
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TimeOffAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" UUID NOT NULL,
    "requestNumber" VARCHAR(50) NOT NULL,
    "employeeId" UUID NOT NULL,
    "timeOffTypeId" UUID NOT NULL,
    "allocationId" UUID,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" VARCHAR(5),
    "endTime" VARCHAR(5),
    "durationQuantity" DECIMAL(5,2) NOT NULL,
    "reason" VARCHAR(500),
    "status" "TimeOffStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "refusalReason" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "description" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRule" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "category" "SalaryRuleCategory" NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 100,
    "computationType" "ComputationType" NOT NULL,
    "fixedAmount" DECIMAL(12,2),
    "percentageBaseCode" VARCHAR(30),
    "percentageRate" DECIMAL(5,2),
    "formulaExpression" VARCHAR(500),
    "isConditionBased" BOOLEAN NOT NULL DEFAULT false,
    "conditionExpression" VARCHAR(500),
    "description" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SalaryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructureRule" (
    "id" UUID NOT NULL,
    "salaryStructureId" UUID NOT NULL,
    "salaryRuleId" UUID NOT NULL,
    "sequenceOverride" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryStructureRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payrun" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "reference" VARCHAR(50) NOT NULL,
    "salaryStructureId" UUID NOT NULL,
    "periodStartDate" DATE NOT NULL,
    "periodEndDate" DATE NOT NULL,
    "paymentDate" DATE,
    "status" "PayrunStatus" NOT NULL DEFAULT 'DRAFT',
    "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "totalEmployerCost" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "payslipCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(500),
    "validatedById" UUID,
    "validatedAt" TIMESTAMPTZ(6),
    "paidById" UUID,
    "paidAt" TIMESTAMPTZ(6),
    "emailsSentCount" INTEGER NOT NULL DEFAULT 0,
    "emailsSentAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payrun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrunEmployee" (
    "id" UUID NOT NULL,
    "payrunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrunEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" UUID NOT NULL,
    "payslipNumber" VARCHAR(50) NOT NULL,
    "payrunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "salaryStructureId" UUID NOT NULL,
    "periodStartDate" DATE NOT NULL,
    "periodEndDate" DATE NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeNumberSnapshot" VARCHAR(50) NOT NULL,
    "employeeNameSnapshot" VARCHAR(200) NOT NULL,
    "contractNumberSnapshot" VARCHAR(50) NOT NULL,
    "contractWageSnapshot" DECIMAL(12,2) NOT NULL,
    "contractWageTypeSnapshot" "WageType" NOT NULL,
    "salaryStructureNameSnapshot" VARCHAR(100) NOT NULL,
    "departmentIdSnapshot" UUID NOT NULL,
    "departmentNameSnapshot" VARCHAR(100) NOT NULL,
    "jobPositionIdSnapshot" UUID NOT NULL,
    "jobPositionNameSnapshot" VARCHAR(100) NOT NULL,
    "scheduledWorkingDays" DECIMAL(5,2) NOT NULL,
    "actualWorkedDays" DECIMAL(5,2) NOT NULL,
    "paidLeaveQuantity" DECIMAL(5,2) NOT NULL,
    "unpaidLeaveQuantity" DECIMAL(5,2) NOT NULL,
    "absentDays" DECIMAL(5,2) NOT NULL,
    "workedHours" DECIMAL(6,2) NOT NULL,
    "expectedHours" DECIMAL(6,2) NOT NULL,
    "overtimeHours" DECIMAL(6,2) NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "totalEmployerCost" DECIMAL(12,2) NOT NULL,
    "hasWarnings" BOOLEAN NOT NULL DEFAULT false,
    "warningsJson" JSONB,
    "pdfGeneratedAt" TIMESTAMPTZ(6),
    "pdfStorageUrl" VARCHAR(500),
    "emailSentAt" TIMESTAMPTZ(6),
    "emailDeliveryStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipLine" (
    "id" UUID NOT NULL,
    "payslipId" UUID NOT NULL,
    "salaryRuleId" UUID,
    "ruleCode" VARCHAR(30) NOT NULL,
    "ruleName" VARCHAR(100) NOT NULL,
    "category" "SalaryRuleCategory" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "rate" DECIMAL(5,2),
    "baseAmount" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "formulaSnapshot" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_managerId_idx" ON "Department"("managerId");

-- CreateIndex
CREATE INDEX "Department_parentDepartmentId_idx" ON "Department"("parentDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosition_code_key" ON "JobPosition"("code");

-- CreateIndex
CREATE INDEX "JobPosition_departmentId_idx" ON "JobPosition"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosition_title_departmentId_key" ON "JobPosition"("title", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingSchedule_name_key" ON "WorkingSchedule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingSchedule_code_key" ON "WorkingSchedule"("code");

-- CreateIndex
CREATE INDEX "WorkingScheduleDay_workingScheduleId_idx" ON "WorkingScheduleDay"("workingScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingScheduleDay_workingScheduleId_dayOfWeek_key" ON "WorkingScheduleDay"("workingScheduleId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_jobPositionId_idx" ON "Employee"("jobPositionId");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_employmentType_idx" ON "Employee"("employmentType");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_employeeId_status_startDate_endDate_idx" ON "Contract"("employeeId", "status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Contract_salaryStructureId_idx" ON "Contract"("salaryStructureId");

-- CreateIndex
CREATE INDEX "Attendance_date_status_idx" ON "Attendance"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TimeOffType_name_key" ON "TimeOffType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TimeOffType_code_key" ON "TimeOffType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TimeOffAllocation_allocationNumber_key" ON "TimeOffAllocation"("allocationNumber");

-- CreateIndex
CREATE INDEX "TimeOffAllocation_employeeId_timeOffTypeId_status_idx" ON "TimeOffAllocation"("employeeId", "timeOffTypeId", "status");

-- CreateIndex
CREATE INDEX "TimeOffAllocation_validFrom_validTo_idx" ON "TimeOffAllocation"("validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "TimeOffRequest_requestNumber_key" ON "TimeOffRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "TimeOffRequest_employeeId_startDate_endDate_idx" ON "TimeOffRequest"("employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "TimeOffRequest_status_idx" ON "TimeOffRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_name_key" ON "SalaryStructure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_code_key" ON "SalaryStructure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRule_code_key" ON "SalaryRule"("code");

-- CreateIndex
CREATE INDEX "SalaryRule_category_idx" ON "SalaryRule"("category");

-- CreateIndex
CREATE INDEX "SalaryStructureRule_salaryStructureId_idx" ON "SalaryStructureRule"("salaryStructureId");

-- CreateIndex
CREATE INDEX "SalaryStructureRule_salaryRuleId_idx" ON "SalaryStructureRule"("salaryRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureRule_salaryStructureId_salaryRuleId_key" ON "SalaryStructureRule"("salaryStructureId", "salaryRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "Payrun_reference_key" ON "Payrun"("reference");

-- CreateIndex
CREATE INDEX "Payrun_periodStartDate_periodEndDate_status_idx" ON "Payrun"("periodStartDate", "periodEndDate", "status");

-- CreateIndex
CREATE INDEX "PayrunEmployee_contractId_idx" ON "PayrunEmployee"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrunEmployee_payrunId_employeeId_key" ON "PayrunEmployee"("payrunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payslipNumber_key" ON "Payslip"("payslipNumber");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_periodStartDate_periodEndDate_idx" ON "Payslip"("employeeId", "periodStartDate", "periodEndDate");

-- CreateIndex
CREATE INDEX "Payslip_status_idx" ON "Payslip"("status");

-- CreateIndex
CREATE INDEX "Payslip_hasWarnings_idx" ON "Payslip"("hasWarnings");

-- CreateIndex
CREATE INDEX "Payslip_departmentIdSnapshot_idx" ON "Payslip"("departmentIdSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrunId_employeeId_key" ON "Payslip"("payrunId", "employeeId");

-- CreateIndex
CREATE INDEX "PayslipLine_payslipId_idx" ON "PayslipLine"("payslipId");

-- CreateIndex
CREATE INDEX "PayslipLine_category_idx" ON "PayslipLine"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipLine_payslipId_ruleCode_key" ON "PayslipLine"("payslipId", "ruleCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosition" ADD CONSTRAINT "JobPosition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingScheduleDay" ADD CONSTRAINT "WorkingScheduleDay_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "TimeOffAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "TimeOffAllocation_timeOffTypeId_fkey" FOREIGN KEY ("timeOffTypeId") REFERENCES "TimeOffType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "TimeOffAllocation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_timeOffTypeId_fkey" FOREIGN KEY ("timeOffTypeId") REFERENCES "TimeOffType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "TimeOffAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureRule" ADD CONSTRAINT "SalaryStructureRule_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureRule" ADD CONSTRAINT "SalaryStructureRule_salaryRuleId_fkey" FOREIGN KEY ("salaryRuleId") REFERENCES "SalaryRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrunEmployee" ADD CONSTRAINT "PayrunEmployee_payrunId_fkey" FOREIGN KEY ("payrunId") REFERENCES "Payrun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrunEmployee" ADD CONSTRAINT "PayrunEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrunEmployee" ADD CONSTRAINT "PayrunEmployee_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrunId_fkey" FOREIGN KEY ("payrunId") REFERENCES "Payrun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_salaryRuleId_fkey" FOREIGN KEY ("salaryRuleId") REFERENCES "SalaryRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
