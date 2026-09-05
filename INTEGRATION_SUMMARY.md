# PeoplePay360 Frontend-Backend Integration Summary

**Date:** 2026-09-05  
**Status:** Backend Inspected, Integration Map Created  
**Next Phase:** Frontend Integration Implementation

---

## ✅ COMPLETED: Backend Inspection

### What Was Discovered

**Backend Location:** `E:\peoplepay360hr-ep` (branch: `feature/backend-database`, commit: `17b9c8d`)

**Backend Stack:**
- Next.js 15.2.0
- PostgreSQL database
- Prisma ORM 6.4.1
- JWT authentication (jsonwebtoken)
- bcryptjs for password hashing
- PDFKit for payslip PDFs
- Nodemailer for email delivery
- Zod for validation

**Database Schema:** 21 Prisma models covering:
- Users, Roles, Permissions (RBAC)
- Employees, Departments, Job Positions
- Working Schedules, Contracts
- Attendance records
- Time Off Types, Allocations, Requests
- Salary Structures, Salary Rules
- Payruns, Payslips, Payslip Lines

**Authentication:** JWT tokens in HTTP-only cookies (cookie name: `token`)

**Canonical Roles:**
1. `EMPLOYEE` - Self-service access
2. `HR_MANAGER` - HR operations
3. `HR_PAYROLL_USER` - HR + create/compute payruns
4. `HR_PAYROLL_MANAGER` - Full HR + Payroll
5. `ADMIN` - System administration

**Test Accounts (Password: `Password123!`):**
- `admin@peoplepay360.com` - Admin
- `hr.manager@peoplepay360.com` - HR Manager (Rachel Green)
- `payroll.manager@peoplepay360.com` - HR Payroll Manager
- `payroll.user@peoplepay360.com` - HR Payroll User
- `john.doe@peoplepay360.com` - Employee (John Doe)
- `sarah.smith@peoplepay360.com` - Employee (Sarah Smith)

---

## 📋 CURRENT FRONTEND STATUS

### What Exists (Frontend at D:\peoplepay360hr-ep)

**✅ Good:**
- Complete UI implementation with Odoo-inspired design
- Well-structured component library
- Clean service layer pattern
- API client with proper error handling
- TypeScript throughout
- Responsive layout with sidebar/header
- All major pages implemented:
  - Login page
  - Dashboard
  - Employees (list/detail/new)
  - Contracts
  - Attendance
  - Time Off (requests/allocations)
  - Payroll (payruns/payslips)
  - Salary Structures/Rules
  - Working Schedules

**❌ Problems:**
- Uses mock data files instead of real backend
- Authentication uses DEMO_ACCOUNTS array (hardcoded)
- Cookie is `pp360_session` (should be `token`)
- No real JWT implementation
- Fake success messages on payroll actions
- No real PDF generation
- No real email sending
- No real payroll calculations

### Mock Data Files (TO BE REMOVED)

1. `src/lib/mocks/employees.mock.ts` - 5 fake employees
2. `src/lib/mocks/payroll.mock.ts` - Fake payruns, payslips, salary rules/structures
3. `src/lib/mocks/attendance.mock.ts` - Fake attendance records, schedules
4. `src/lib/mocks/contracts.mock.ts` - 6 fake contracts
5. `src/lib/mocks/dashboard.mock.ts` - Fake metrics
6. `src/lib/mocks/timeoff.mock.ts` - Fake time off data

### Frontend API Routes (TO BE UPDATED/REMOVED)

All routes in `src/app/api/*` currently return mock data:
- `/api/auth/login` - Checks DEMO_ACCOUNTS
- `/api/auth/me` - Parses `pp360_session` cookie
- `/api/employees/*` - Returns MOCK_EMPLOYEES
- `/api/payroll/*` - Returns MOCK_PAYRUNS, MOCK_PAYSLIPS
- `/api/attendance/*` - Returns MOCK_ATTENDANCE
- `/api/timeoff/*` - Returns MOCK_TIMEOFF_*

---

## 🔧 REQUIRED CHANGES

### Phase 1: Authentication (CRITICAL FIRST STEP)

**Files to Modify:**
1. `src/app/api/auth/login/route.ts`
   - Remove DEMO_ACCOUNTS array
   - Forward to backend `/api/auth/login`
   - Change cookie from `pp360_session` to `token`
   - Store JWT token, not JSON user object

2. `src/app/api/auth/me/route.ts`
   - Change cookie from `pp360_session` to `token`
   - Verify JWT instead of JSON.parse()
   - Forward to backend `/api/auth/me`

3. `src/context/AuthContext.tsx`
   - Update to expect JWT token flow
   - Use backend user shape (with role, permissions, employee)
   - Handle `permissions` array for RBAC

4. `src/services/auth.service.ts`
   - Ensure login/getCurrentUser call real endpoints

**Test Accounts to Use:**
- `admin@peoplepay360.com` / `Password123!`
- `hr.manager@peoplepay360.com` / `Password123!`
- `payroll.manager@peoplepay360.com` / `Password123!`
- `john.doe@peoplepay360.com` / `Password123!`

### Phase 2: Remove All Mock Data

**Delete Files:**
```bash
rm src/lib/mocks/employees.mock.ts
rm src/lib/mocks/payroll.mock.ts
rm src/lib/mocks/attendance.mock.ts
rm src/lib/mocks/contracts.mock.ts
rm src/lib/mocks/dashboard.mock.ts
rm src/lib/mocks/timeoff.mock.ts
```

### Phase 3: Update API Routes

**Option A: Remove Frontend Routes** (Recommended)
- Delete `src/app/api/*` directories (except auth if needed for client-side routing)
- Update `src/lib/api/client.ts` to point directly to backend
- Set `NEXT_PUBLIC_API_URL=http://localhost:3001` for separate backend

**Option B: Proxy Through Frontend Routes**
- Keep `src/app/api/*` but make them proxy to backend
- Each route just forwards to backend and returns response

### Phase 4: Update Service Layer

**Fix Service Endpoint Mismatches:**

| Frontend Service | Current Endpoint | Backend Endpoint | Status |
|-----------------|------------------|------------------|--------|
| `employeeService.getContracts()` | `/api/contracts` | `/api/employees/[id]/contracts` | MISMATCH |
| `payrollService.getDashboardMetrics()` | `/api/payroll/metrics` | `/api/dashboard` | MISMATCH |
| `attendanceService.getWorkingSchedules()` | `/api/working-schedules` | `/api/working-schedules` | ✓ |
| `payrollService.getSalaryRules()` | `/api/salary-rules` | `/api/payroll/salary-rules` | MISMATCH |
| `payrollService.getSalaryStructures()` | `/api/salary-structures` | `/api/payroll/salary-structures` | MISMATCH |
| `timeoffService.*` | `/api/timeoff/*` | `/api/time-off/*` | MISMATCH (hyphen) |

**Update Files:**
- `src/services/employee.service.ts`
- `src/services/payroll.service.ts`
- `src/services/attendance.service.ts`
- `src/services/timeoff.service.ts`

### Phase 5: Update Payroll Actions

**Critical Payroll Buttons (Currently Fake):**

1. **Compute Button** (`src/app/(dashboard)/payroll/payruns/[id]/page.tsx`)
   - Current: Returns fake `{ success: true, message: "Computed" }`
   - Required: Call real `POST /api/payroll/payruns/[id]/compute`
   - Show real totals: `totalGross`, `totalDeductions`, `totalNet`
   - Display real warnings from backend

2. **Validate Button**
   - Current: Fake status change
   - Required: Call real `POST /api/payroll/payruns/[id]/validate`
   - Show `validatedBy` and `validatedAt`

3. **Mark Paid Button**
   - Current: Fake status change
   - Required: Call real `POST /api/payroll/payruns/[id]/paid`
   - Show `paidBy` and `paidAt`

4. **Email Payslips Button**
   - Current: Returns fake `{ sent: 4 }`
   - Required: Call real `POST /api/payroll/payruns/[id]/email-payslips`
   - Show real delivery results (success/failure per employee)

### Phase 6: Update PDF/Email

**Payslip PDF:**
- Current: Likely not implemented or fake
- Required: Call `GET /api/payroll/payslips/[id]/pdf`
- Open in new tab or download
- Backend generates real PDF with PDFKit

**Individual Email:**
- Current: Likely fake success
- Required: Call `POST /api/payroll/payslips/[id]/email`
- Show real delivery status

### Phase 7: Dashboard Metrics

**Update Dashboard:**
- Current: Returns hardcoded `MOCK_DASHBOARD_METRICS`
- Required: Call real `GET /api/dashboard`
- Display backend-calculated statistics only
- Never show fake numbers

### Phase 8: Permission-Based UI

**Add Permission Checks:**
```typescript
// Example in employee list page
const { user } = useAuth();
const canCreateEmployee = user?.permissions.includes('employee.write');

// Conditionally render "New Employee" button
{canCreateEmployee && <Button>New Employee</Button>}
```

**Key Permissions to Check:**
- `employee.write` - Show create/edit employee buttons
- `contract.write` - Show contract management
- `timeoff.request.approve` - Show approve/reject buttons
- `payroll.payrun.compute` - Show compute button
- `payroll.payrun.validate` - Show validate button
- `payroll.payrun.pay` - Show mark paid button

---

## 🚀 RUNNING BACKEND + FRONTEND

### Backend Setup (First Time)

```bash
# Navigate to backend
cd E:\peoplepay360hr-ep

# Install dependencies
npm install

# Create database
createdb peoplepay360

# Configure environment
cp .env.example .env
# Edit .env with DATABASE_URL

# Run migrations
npm run db:generate
npm run db:migrate

# Seed test data
npm run db:seed

# Start backend (port 3001)
PORT=3001 npm run dev
```

**Backend will be available at:** http://localhost:3001

### Frontend Setup

**Option 1: Point to Backend (Separate Ports)**

```bash
# Navigate to frontend
cd D:\peoplepay360hr-ep

# Update API base URL
# In src/lib/api/client.ts:
this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

# Start frontend (port 3000)
npm run dev
```

**Access:** http://localhost:3000 → calls → http://localhost:3001/api/*

**Option 2: Next.js Rewrites (Proxy)**

```typescript
// next.config.ts
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      }
    ];
  }
};
```

**Option 3: Merged Repository (After Integration Complete)**

```bash
# Merge frontend branch into backend branch
cd E:\peoplepay360hr-ep
git checkout feature/backend-database
git merge feature/frontend-foundation

# Remove mock files during merge
# Run unified application
npm run dev
```

---

## ✅ VERIFICATION CHECKLIST

### Before Starting Integration
- [x] Backend inspected and documented
- [x] Integration map created
- [x] Test accounts identified
- [x] API contracts documented
- [ ] Backend running locally
- [ ] Database seeded with test data

### Authentication Phase
- [ ] Remove DEMO_ACCOUNTS
- [ ] JWT token authentication working
- [ ] Cookie changed to `token`
- [ ] Login works with all 6 test accounts
- [ ] Session persists across refresh
- [ ] Logout works correctly
- [ ] Role and permissions loaded

### Data Integration Phase
- [ ] All mock files deleted
- [ ] Employee CRUD works with backend
- [ ] Departments/JobPositions load from backend
- [ ] Working Schedules load from backend
- [ ] Contracts load from backend
- [ ] Attendance works with backend
- [ ] Time Off works with backend
- [ ] Dashboard shows real metrics

### Payroll Phase
- [ ] Salary Structures/Rules load from backend
- [ ] Payrun create works
- [ ] Payrun compute calls real backend
- [ ] Payrun validate calls real backend
- [ ] Payrun mark paid calls real backend
- [ ] Email payslips calls real backend
- [ ] Payslip PDF downloads from backend
- [ ] No fake success messages remain

### Final Verification
- [ ] TypeScript compiles (`npm run build`)
- [ ] Linter passes (`npm run lint`)
- [ ] All roles tested (EMPLOYEE, HR_MANAGER, HR_PAYROLL_MANAGER, ADMIN)
- [ ] E2E: Employee views own payslip
- [ ] E2E: HR Manager approves time off
- [ ] E2E: Payroll Manager runs full payrun
- [ ] No mock data in codebase
- [ ] No DEMO_ACCOUNTS in code
- [ ] Permission checks implemented

---

## 📚 DOCUMENTATION

**Created Documents:**
1. **BACKEND_INTEGRATION_MAP.md** - Complete API reference (108KB, 18 sections)
2. **INTEGRATION_SUMMARY.md** - This file (executive summary)

**Key Sections in Integration Map:**
- Authentication & Session Management
- Canonical Roles & Permissions
- All 15+ API modules with request/response examples
- Test account credentials
- Environment configuration
- Integration checklist
- Critical do's and don'ts

---

## ⚠️ CRITICAL WARNINGS

### DO NOT:
- ❌ Create new Prisma schema
- ❌ Create new database
- ❌ Modify backend database schema
- ❌ Keep DEMO_ACCOUNTS
- ❌ Keep mock data files
- ❌ Implement payroll calculations in frontend
- ❌ Show fake success messages
- ❌ Generate browser PDFs
- ❌ Add role selection at login
- ❌ Push code before verifying with backend

### MUST DO:
- ✅ Use backend APIs exactly as documented
- ✅ Test with real PostgreSQL database
- ✅ Use provided test accounts
- ✅ Replace ALL mock data
- ✅ Handle HTTP errors properly
- ✅ Check permissions in UI
- ✅ Trust backend calculations
- ✅ Verify each phase before moving to next

---

## 🎯 SUCCESS CRITERIA

**Integration is complete when:**

1. ✅ No mock data files exist in codebase
2. ✅ No DEMO_ACCOUNTS in authentication
3. ✅ All pages load data from backend PostgreSQL
4. ✅ JWT authentication works with `token` cookie
5. ✅ All 6 test accounts can login successfully
6. ✅ Employee can view own payslip (E2E test)
7. ✅ HR Manager can approve time off (E2E test)
8. ✅ Payroll Manager can run full payrun (E2E test)
9. ✅ Payslip PDF downloads from backend
10. ✅ Email delivery works (or shows real status)
11. ✅ Dashboard shows real calculated metrics
12. ✅ TypeScript compiles without errors
13. ✅ Linter passes without errors
14. ✅ All permission checks implemented
15. ✅ No fake success messages anywhere

---

## 📞 NEXT ACTIONS

1. **Review** both integration documents
2. **Set up** backend locally (E:\peoplepay360hr-ep)
3. **Test** backend APIs with provided credentials
4. **Begin** Phase 1 (Authentication) integration
5. **Test** each phase thoroughly before proceeding
6. **Document** any issues or backend API questions
7. **Report** when integration is complete

**Ready to proceed with integration implementation.**
