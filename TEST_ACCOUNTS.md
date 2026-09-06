# Test Accounts for Development

**⚠️ DEVELOPMENT ONLY - DO NOT COMMIT REAL PASSWORDS**

These accounts are seeded by the backend `prisma/seed.ts` script.  
All accounts use the password: `Password123!`

## Available Test Accounts

### 1. Admin
- **Email:** `admin@peoplepay360.com`
- **Password:** `Password123!`
- **Role:** ADMIN
- **Permissions:** All permissions (full system access)
- **Employee Record:** None
- **Use For:** System administration, user management, testing admin features

### 2. HR Manager
- **Email:** `hr.manager@peoplepay360.com`
- **Password:** `Password123!`
- **Role:** HR_MANAGER
- **Employee:** Rachel Green (EMP-00100)
- **Department:** Human Resources
- **Permissions:**
  - employee.self.read, attendance.self, timeoff.request.self, payslip.self.read
  - employee.read, employee.write
  - department.manage, job_position.manage, schedule.manage
  - contract.read, contract.write
  - attendance.read, attendance.correct
  - timeoff.type.manage, timeoff.allocation.manage
  - timeoff.request.read, timeoff.request.approve
- **Use For:** HR operations, employee management, time-off approvals

### 3. HR Payroll Manager
- **Email:** `payroll.manager@peoplepay360.com`
- **Password:** `Password123!`
- **Role:** HR_PAYROLL_MANAGER
- **Employee Record:** None
- **Permissions:**
  - All HR Manager permissions
  - payroll.structure.read, payroll.structure.write
  - payroll.rule.read, payroll.rule.write
  - payroll.payrun.read, payroll.payrun.create
  - payroll.payrun.compute, payroll.payrun.validate, payroll.payrun.pay
- **Use For:** Full payroll management, running payruns, sending payslips

### 4. HR Payroll User
- **Email:** `payroll.user@peoplepay360.com`
- **Password:** `Password123!`
- **Role:** HR_PAYROLL_USER
- **Employee Record:** None
- **Permissions:**
  - All HR Manager permissions
  - payroll.structure.read, payroll.rule.read
  - payroll.payrun.read, payroll.payrun.create, payroll.payrun.compute
- **Use For:** HR + payroll data entry and computation (cannot validate or mark paid)

### 5. Employee - John Doe
- **Email:** `john.doe@peoplepay360.com`
- **Password:** `Password123!`
- **Role:** EMPLOYEE
- **Employee:** John Doe (EMP-00102)
- **Department:** Engineering
- **Job Title:** Senior Software Engineer
- **Manager:** David Chen (EMP-00101)
- **Permissions:**
  - employee.self.read
  - attendance.self
  - timeoff.request.self
  - payslip.self.read
- **Use For:** Employee self-service testing (view own data only)

### 6. Employee - Sarah Smith
- **Email:** `sarah.smith@peoplepay360.com`
- **Password:** `Password123!`
- **Role:** EMPLOYEE
- **Employee:** Sarah Smith (EMP-00103)
- **Department:** Engineering
- **Job Title:** QA Automation Engineer
- **Manager:** David Chen (EMP-00101)
- **Permissions:** Same as Employee role
- **Use For:** Testing multiple employee accounts

## Testing Scenarios

### Test Login & Role Resolution
```
1. Login as admin@peoplepay360.com
2. Verify role displays as "Admin"
3. Verify all navigation items visible
4. Logout
5. Repeat for each role
```

### Test Permission-Based Access
```
1. Login as john.doe@peoplepay360.com (Employee)
2. Attempt to access /employees (should be restricted or filtered to self only)
3. Attempt payroll management (should be forbidden)
4. Verify can access own payslips
```

### Test Session Persistence
```
1. Login as any user
2. Navigate to dashboard
3. Refresh browser (F5)
4. Verify still authenticated
5. Verify correct user still displayed
```

### Test Logout
```
1. Login as any user
2. Click logout
3. Verify redirected to /login
4. Verify cannot access /dashboard without re-login
5. Verify token cookie cleared
```

## Backend Seed Data

Additional employees seeded (not user accounts):
- **David Chen** (EMP-00101) - Engineering Manager (no user account)

For complete seed data, see:
- Backend repository: `E:\peoplepay360hr-ep`
- File: `prisma/seed.ts`

## Important Notes

1. **DO NOT** commit this file if it contains real production passwords
2. **DO NOT** use these passwords in production
3. Backend must be running with seeded database for these accounts to work
4. Password format: `Password123!` (capital P, 123, exclamation)
5. Email domain: `@peoplepay360.com` (NOT `.internal` like old DEMO_ACCOUNTS)
