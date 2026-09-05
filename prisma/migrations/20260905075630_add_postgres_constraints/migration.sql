-- Enable btree_gist extension for PostgreSQL exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. CONTRACT EXCLUSION CONSTRAINT (Prevent overlapping ACTIVE contracts for the same employee)
-- Handles open-ended contracts with COALESCE to infinity and inclusive range bounds '[]'
ALTER TABLE "Contract" ADD CONSTRAINT "no_overlapping_active_contracts"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange("startDate", COALESCE("endDate", 'infinity'::date), '[]') WITH &&
  ) WHERE ("status" = 'ACTIVE');

-- 2. ORGANIZATIONAL CHECK CONSTRAINTS
ALTER TABLE "Department" ADD CONSTRAINT "chk_department_not_self_parent"
  CHECK ("id" != "parentDepartmentId");

ALTER TABLE "WorkingSchedule" ADD CONSTRAINT "chk_schedule_weekly_hours"
  CHECK ("totalWeeklyHours" >= 0.00 AND "totalWeeklyHours" <= 168.00);

ALTER TABLE "WorkingScheduleDay" ADD CONSTRAINT "chk_scheduleday_break_minutes"
  CHECK ("breakMinutes" >= 0);

ALTER TABLE "WorkingScheduleDay" ADD CONSTRAINT "chk_scheduleday_work_hours"
  CHECK ("dayWorkHours" > 0.00 AND "dayWorkHours" <= 24.00);

ALTER TABLE "Employee" ADD CONSTRAINT "chk_employee_not_self_manager"
  CHECK ("id" != "managerId");

ALTER TABLE "Employee" ADD CONSTRAINT "chk_employee_termination_after_hire"
  CHECK ("terminationDate" IS NULL OR "terminationDate" >= "hireDate");

ALTER TABLE "Contract" ADD CONSTRAINT "chk_contract_dates"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "Contract" ADD CONSTRAINT "chk_contract_wage_positive"
  CHECK ("wage" > 0.00);

-- 3. ATTENDANCE CHECK CONSTRAINTS
ALTER TABLE "Attendance" ADD CONSTRAINT "chk_attendance_checkout_after_checkin"
  CHECK ("checkOut" IS NULL OR "checkOut" >= "checkIn");

ALTER TABLE "Attendance" ADD CONSTRAINT "chk_attendance_worked_hours"
  CHECK ("workedHours" >= 0.00 AND "workedHours" <= 24.00);

ALTER TABLE "Attendance" ADD CONSTRAINT "chk_attendance_expected_hours"
  CHECK ("expectedHours" >= 0.00 AND "expectedHours" <= 24.00);

ALTER TABLE "Attendance" ADD CONSTRAINT "chk_attendance_overtime_hours"
  CHECK ("overtimeHours" >= 0.00);

ALTER TABLE "Attendance" ADD CONSTRAINT "chk_attendance_correction_reason"
  CHECK ("isManualCorrection" = false OR "correctionReason" IS NOT NULL);

-- 4. TIME OFF ALLOCATION & REQUEST CHECK CONSTRAINTS
ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "chk_allocation_validity"
  CHECK ("validFrom" <= "validTo");

ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "chk_allocation_allocated_positive"
  CHECK ("allocatedQuantity" > 0.00);

ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "chk_allocation_taken_nonnegative"
  CHECK ("takenQuantity" >= 0.00);

ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "chk_allocation_remaining_nonnegative"
  CHECK ("remainingQuantity" >= 0.00);

ALTER TABLE "TimeOffAllocation" ADD CONSTRAINT "chk_allocation_remaining_le_allocated"
  CHECK ("remainingQuantity" <= "allocatedQuantity");

ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "chk_timeoff_req_dates"
  CHECK ("startDate" <= "endDate");

ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "chk_timeoff_req_duration"
  CHECK ("durationQuantity" > 0.00);

ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "chk_timeoff_req_time_interval"
  CHECK (
    ("startTime" IS NULL AND "endTime" IS NULL) OR 
    ("startTime" IS NOT NULL AND "endTime" IS NOT NULL AND "endTime" > "startTime")
  );

ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "chk_timeoff_req_refusal"
  CHECK ("status" != 'REFUSED' OR "refusalReason" IS NOT NULL);

-- 5. SALARY RULES & STRUCTURE CHECK CONSTRAINTS
ALTER TABLE "SalaryRule" ADD CONSTRAINT "chk_salaryrule_sequence"
  CHECK ("sequence" >= 0);

ALTER TABLE "SalaryRule" ADD CONSTRAINT "chk_salaryrule_fixed_amount"
  CHECK ("fixedAmount" IS NULL OR "fixedAmount" >= 0.00);

ALTER TABLE "SalaryRule" ADD CONSTRAINT "chk_salaryrule_percentage_rate"
  CHECK ("percentageRate" IS NULL OR "percentageRate" >= 0.00);

ALTER TABLE "SalaryStructureRule" ADD CONSTRAINT "chk_structrule_seq_override"
  CHECK ("sequenceOverride" IS NULL OR "sequenceOverride" >= 0);

-- 6. PAYRUN CHECK CONSTRAINTS
ALTER TABLE "Payrun" ADD CONSTRAINT "chk_payrun_dates"
  CHECK ("periodStartDate" <= "periodEndDate");

ALTER TABLE "Payrun" ADD CONSTRAINT "chk_payrun_totals"
  CHECK (
    "totalGross" >= 0.00 AND 
    "totalDeductions" >= 0.00 AND 
    "totalNet" >= 0.00 AND 
    "totalEmployerCost" >= 0.00
  );

ALTER TABLE "Payrun" ADD CONSTRAINT "chk_payrun_counts"
  CHECK ("payslipCount" >= 0 AND "warningCount" >= 0);

-- 7. PAYSLIP CHECK CONSTRAINTS (Positive-Magnitude Semantics)
ALTER TABLE "Payslip" ADD CONSTRAINT "chk_payslip_dates"
  CHECK ("periodStartDate" <= "periodEndDate");

ALTER TABLE "Payslip" ADD CONSTRAINT "chk_payslip_totals"
  CHECK (
    "basicSalary" >= 0.00 AND 
    "grossSalary" >= 0.00 AND 
    "totalDeductions" >= 0.00 AND 
    "netSalary" >= 0.00 AND 
    "totalEmployerCost" >= 0.00
  );

-- 8. PAYSLIP LINE CHECK CONSTRAINTS
ALTER TABLE "PayslipLine" ADD CONSTRAINT "chk_payslipline_amount"
  CHECK ("amount" >= 0.00);

ALTER TABLE "PayslipLine" ADD CONSTRAINT "chk_payslipline_base_amount"
  CHECK ("baseAmount" IS NULL OR "baseAmount" >= 0.00);

ALTER TABLE "PayslipLine" ADD CONSTRAINT "chk_payslipline_sequence"
  CHECK ("sequence" >= 0);