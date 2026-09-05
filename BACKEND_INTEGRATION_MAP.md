# PeoplePay360 Backend Integration Map

**Generated:** 2026-09-05  
**Backend Branch:** `feature/backend-database`  
**Backend Commit:** `17b9c8d`  
**Backend Location:** `E:\peoplepay360hr-ep` (also at https://github.com/parekhjaymin00-prog/peoplepay360hr-ep)

---

## EXECUTIVE SUMMARY

The PeoplePay360 backend is **fully implemented** with:
- ✅ PostgreSQL database with Prisma ORM
- ✅ JWT-based authentication with HTTP-only cookies
- ✅ RBAC with 5 canonical roles and 29 permissions
- ✅ Complete HR, Attendance, Time-Off, and Payroll modules
- ✅ Real payroll computation engine
- ✅ PDF generation for payslips
- ✅ Email service for payslip delivery
- ✅ Comprehensive test suite

**Current Frontend Status:** Uses mock data and DEMO_ACCOUNTS  
**Integration Goal:** Replace all mock data with real backend API calls

---

## 1. AUTHENTICATION & SESSION MANAGEMENT

### Backend Implementation

**Technology:** JWT tokens in HTTP-only cookies  
**Cookie Name:** `token`  
**Token Expiry:** 8 hours  
**Password Hashing:** bcrypt with 10 rounds

### Test Accounts (Development)

All accounts use password: `Password123!`

| Email | Role | Role Code | Employee |
|-------|------|-----------|----------|
| `admin@peoplepay360.com` | Admin | `ADMIN` | None |
| `hr.manager@peoplepay360.com` | HR Manager | `HR_MANAGER` | Rachel Green (EMP-00100) |
| `payroll.manager@peoplepay360.com` | HR Payroll Manager | `HR_PAYROLL_MANAGER` | None |
| `payroll.user@peoplepay360.com` | HR Payroll User | `HR_PAYROLL_USER` | None |
| `john.doe@peoplepay360.com` | Employee | `EMPLOYEE` | John Doe (EMP-00102) |
| `sarah.smith@peoplepay360.com` | Employee | `EMPLOYEE` | Sarah Smith (EMP-00103) |

### API Endpoints

#### POST /api/auth/login

**Request:**
```json
{
  "email": "john.doe@peoplepay360.com",
  "password": "Password123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "01932e5a-...",
      "email": "john.doe@peoplepay360.com",
      "isActive": true,
      "lastLoginAt": "2026-09-05T10:30:00Z",
      "role": {
        "id": "01932e5a-...",
        "code": "EMPLOYEE",
        "name": "Employee"
      },
      "permissions": [
        "employee.self.read",
        "attendance.self",
        "timeoff.request.self",
        "payslip.self.read"
      ],
      "employee": {
        "id": "01932e5a-...",
        "employeeNumber": "EMP-00102",
        "firstName": "John",
        "lastName": "Doe",
        "department": {
          "id": "01932e5a-...",
          "name": "Engineering",
          "code": "ENG"
        },
        "jobPosition": {
          "id": "01932e5a-...",
          "title": "Senior Software Engineer",
          "code": "DEV-SR"
        }
      }
    }
  }
}
```

**Sets Cookie:** `token=<JWT>; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`

**Error (401):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

#### GET /api/auth/me

**Headers:** `Cookie: token=<JWT>` (or `Authorization: Bearer <JWT>`)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "01932e5a-...",
      "email": "john.doe@peoplepay360.com",
      "isActive": true,
      "role": { ... },
      "permissions": [...],
      "employee": { ... }
    }
  }
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Authentication token is missing. Please log in."
}
```

### Frontend Changes Required

**Current (Frontend):**
- Cookie: `pp360_session` with JSON.parse(user)
- Login checks DEMO_ACCOUNTS array
- No JWT tokens

**Required (Integration):**
- Cookie: `token` with JWT
- POST to real `/api/auth/login`
- GET `/api/auth/me` on app initialization
- Remove `DEMO_ACCOUNTS` from `src/app/api/auth/login/route.ts`
- Update AuthContext to use JWT flow
- Update API client to send `token` cookie

---

## 2. CANONICAL ROLES & PERMISSIONS

### Roles (Backend)

| Code | Name | Description |
|------|------|-------------|
| `EMPLOYEE` | Employee | Self-service access to own profile, attendance, leaves, payslips |
| `HR_MANAGER` | HR Manager | Full CRUD on HR data, contracts, schedules, attendance, leaves |
| `HR_PAYROLL_USER` | HR Payroll User | HR Manager + create/compute payruns |
| `HR_PAYROLL_MANAGER` | HR Payroll Manager | Full HR + Payroll (validate, mark paid, send emails) |
| `ADMIN` | Admin | Complete system administration and user management |

### Key Permissions

**Employee Self-Service:**
- `employee.self.read` - View own profile
- `attendance.self` - Check-in/check-out
- `timeoff.request.self` - Create leave requests
- `payslip.self.read` - View own payslips

**HR Operations:**
- `employee.read`, `employee.write` - Manage employees
- `contract.read`, `contract.write` - Manage contracts
- `attendance.read`, `attendance.correct` - View/correct attendance
- `timeoff.request.approve` - Approve/refuse leave requests

**Payroll Operations:**
- `payroll.payrun.create` - Create payruns
- `payroll.payrun.compute` - Compute payslips
- `payroll.payrun.validate` - Validate and lock payruns
- `payroll.payrun.pay` - Mark as paid and send emails
- `payroll.structure.write`, `payroll.rule.write` - Manage salary config

### Frontend Impact

**Remove:** Any frontend role selection UI or role switching buttons  
**Add:** Display user role from backend `user.role.name`  
**Add:** Conditionally show/hide features based on `user.permissions` array  
**Note:** Frontend checks are UX only - backend enforces authorization

---

## 3. EMPLOYEES MODULE

### API Endpoints

#### GET /api/employees

**Permission Required:** `employee.read`

**Query Parameters:**
- `departmentId` (UUID) - Filter by department
- `status` (EmployeeStatus) - ACTIVE, ON_LEAVE, TERMINATED, INACTIVE
- `employmentType` (EmploymentType) - FULL_TIME, PART_TIME, CONTRACTOR, INTERN
- `search` (string) - Search in name and email

**Response (200):**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "01932e5a-...",
        "employeeNumber": "EMP-00102",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@peoplepay360.com",
        "phone": "+1-555-0102",
        "avatarUrl": null,
        "dateOfBirth": "1992-08-20",
        "gender": "MALE",
        "departmentId": "01932e5a-...",
        "department": {
          "id": "01932e5a-...",
          "name": "Engineering",
          "code": "ENG"
        },
        "jobPositionId": "01932e5a-...",
        "jobPosition": {
          "id": "01932e5a-...",
          "title": "Senior Software Engineer",
          "code": "DEV-SR"
        },
        "managerId": "01932e5a-...",
        "manager": {
          "id": "01932e5a-...",
          "firstName": "David",
          "lastName": "Chen",
          "employeeNumber": "EMP-00101"
        },
        "workingScheduleId": "01932e5a-...",
        "workingSchedule": {
          "id": "01932e5a-...",
          "name": "Standard 40-Hour Week",
          "code": "STD_40H"
        },
        "employmentType": "FULL_TIME",
        "status": "ACTIVE",
        "hireDate": "2025-01-01",
        "terminationDate": null,
        "bankName": "Chase Bank",
        "bankAccountNumber": "1234567890",
        "bankRoutingCode": "CHAS0099",
        "panOrTaxId": "TAX-JD-9208",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### POST /api/employees

**Permission Required:** `employee.write`

**Request:**
```json
{
  "employeeNumber": "EMP-00105",
  "firstName": "Jane",
  "lastName": "Wilson",
  "email": "jane.wilson@peoplepay360.com",
  "phone": "+1-555-0105",
  "dateOfBirth": "1993-05-15",
  "gender": "FEMALE",
  "departmentId": "01932e5a-...",
  "jobPositionId": "01932e5a-...",
  "managerId": "01932e5a-...",
  "workingScheduleId": "01932e5a-...",
  "employmentType": "FULL_TIME",
  "hireDate": "2026-09-01",
  "bankName": "Bank of America",
  "bankAccountNumber": "9988776655",
  "bankRoutingCode": "BOFA1122"
}
```

**Response (201):** Returns created employee object

#### GET /api/employees/[id]

**Permission Required:** `employee.read` (or `employee.self.read` for own record)

**Response (200):** Returns single employee with full details

#### PATCH /api/employees/[id]

**Permission Required:** `employee.write`

**Request:** Partial employee object with fields to update

**Response (200):** Returns updated employee

### Frontend Changes Required

**Remove:** `MOCK_EMPLOYEES` from `src/lib/mocks/employees.mock.ts`  
**Update:** `src/app/api/employees/route.ts` to proxy to backend  
**Update:** `src/services/employee.service.ts` to call real endpoints  
**Update:** Filter UI to use backend enums (EmployeeStatus, EmploymentType)  
**Add:** Permission checks in employee pages based on `user.permissions`

---

## 4. DEPARTMENTS & JOB POSITIONS

### Departments

#### GET /api/departments

**Permission Required:** `department.manage` (or authenticated for read-only)

**Response:**
```json
{
  "success": true,
  "data": {
    "departments": [
      {
        "id": "01932e5a-...",
        "name": "Engineering",
        "code": "ENG",
        "managerId": "01932e5a-...",
        "manager": {
          "id": "01932e5a-...",
          "firstName": "David",
          "lastName": "Chen",
          "employeeNumber": "EMP-00101"
        },
        "parentDepartmentId": null,
        "isActive": true
      }
    ]
  }
}
```

#### POST /api/departments

**Permission Required:** `department.manage`

### Job Positions

#### GET /api/job-positions

**Query Parameters:**
- `departmentId` (UUID) - Filter by department

**Response:**
```json
{
  "success": true,
  "data": {
    "jobPositions": [
      {
        "id": "01932e5a-...",
        "title": "Senior Software Engineer",
        "code": "DEV-SR",
        "departmentId": "01932e5a-...",
        "department": {
          "name": "Engineering"
        },
        "description": "Full stack development",
        "isActive": true
      }
    ]
  }
}
```

#### POST /api/job-positions

**Permission Required:** `job_position.manage`

### Frontend Changes Required

**Remove:** Hardcoded department arrays (Engineering, HR, Finance)  
**Update:** Load departments and job positions from backend APIs  
**Update:** Department/Position selectors in employee forms to use real data

---

## 5. WORKING SCHEDULES

### API Endpoints

#### GET /api/working-schedules

**Response:**
```json
{
  "success": true,
  "data": {
    "workingSchedules": [
      {
        "id": "01932e5a-...",
        "name": "Standard 40-Hour Week",
        "code": "STD_40H",
        "totalWeeklyHours": 40.0,
        "isActive": true,
        "days": [
          {
            "id": "01932e5a-...",
            "dayOfWeek": "MONDAY",
            "startTime": "09:00",
            "endTime": "18:00",
            "breakMinutes": 60,
            "dayWorkHours": 8.0
          },
          {
            "dayOfWeek": "TUESDAY",
            "startTime": "09:00",
            "endTime": "18:00",
            "breakMinutes": 60,
            "dayWorkHours": 8.0
          }
        ]
      }
    ]
  }
}
```

#### POST /api/working-schedules

**Permission Required:** `schedule.manage`

**Request:**
```json
{
  "name": "4-Day Work Week",
  "code": "FLEX_32H",
  "totalWeeklyHours": 32.0,
  "days": [
    {
      "dayOfWeek": "MONDAY",
      "startTime": "09:00",
      "endTime": "17:00",
      "breakMinutes": 60,
      "dayWorkHours": 7.0
    }
  ]
}
```

### Frontend Changes Required

**Remove:** `MOCK_SCHEDULES` from `src/lib/mocks/attendance.mock.ts`  
**Update:** Schedule management page to use real API  
**Update:** Employee forms to load schedules from backend

---

## 6. CONTRACTS

### API Endpoints

#### GET /api/employees/[employeeId]/contracts

**Permission Required:** `contract.read`

**Query Parameters:**
- `status` (ContractStatus) - DRAFT, ACTIVE, EXPIRED, CANCELLED
- `includeExpired` (boolean) - Include historical contracts

**Response:**
```json
{
  "success": true,
  "data": {
    "contracts": [
      {
        "id": "01932e5a-...",
        "contractNumber": "CON-2026-JD2",
        "employeeId": "01932e5a-...",
        "employee": {
          "firstName": "John",
          "lastName": "Doe"
        },
        "departmentId": "01932e5a-...",
        "department": {
          "name": "Engineering"
        },
        "jobPositionId": "01932e5a-...",
        "jobPosition": {
          "title": "Senior Software Engineer"
        },
        "workingScheduleId": "01932e5a-...",
        "salaryStructureId": "01932e5a-...",
        "salaryStructure": {
          "name": "Regular Full-Time Structure"
        },
        "wage": 60000.0,
        "wageType": "MONTHLY",
        "startDate": "2026-01-01",
        "endDate": null,
        "status": "ACTIVE",
        "notes": "Promoted 2026 contract",
        "createdAt": "2026-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### POST /api/contracts

**Permission Required:** `contract.write`

#### GET /api/contracts/[id]

**Permission Required:** `contract.read`

#### PATCH /api/contracts/[id]

**Permission Required:** `contract.write`

### Frontend Changes Required

**Remove:** `MOCK_CONTRACTS` from `src/lib/mocks/contracts.mock.ts`  
**Update:** Contract list/detail pages to use real API  
**Update:** Service calls from `/api/contracts` to `/api/employees/[id]/contracts`  
**Add:** Historical contract display (employees can have multiple contracts)  
**Note:** Backend determines which contract applies to payroll periods

---

## 7. ATTENDANCE

### API Endpoints

#### GET /api/attendance

**Permission Required:** `attendance.read` (or `attendance.self` for own records)

**Query Parameters:**
- `employeeId` (UUID) - Filter by employee
- `departmentId` (UUID) - Filter by department
- `startDate` (YYYY-MM-DD) - Period start
- `endDate` (YYYY-MM-DD) - Period end
- `status` (AttendanceStatus) - PRESENT, LATE, ABSENT, HALF_DAY

**Response:**
```json
{
  "success": true,
  "data": {
    "attendances": [
      {
        "id": "01932e5a-...",
        "employeeId": "01932e5a-...",
        "employee": {
          "employeeNumber": "EMP-00102",
          "firstName": "John",
          "lastName": "Doe"
        },
        "date": "2026-09-05",
        "checkIn": "2026-09-05T09:05:00Z",
        "checkOut": "2026-09-05T18:10:00Z",
        "workedHours": 8.08,
        "expectedHours": 8.0,
        "status": "PRESENT",
        "isOvertime": false,
        "overtimeHours": 0.08,
        "isManualCorrection": false,
        "correctionReason": null,
        "correctedById": null
      }
    ]
  }
}
```

#### POST /api/attendance/check-in

**Permission Required:** `attendance.self`

**Request:**
```json
{
  "employeeId": "01932e5a-..."
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "attendance": {
      "id": "01932e5a-...",
      "employeeId": "01932e5a-...",
      "date": "2026-09-05",
      "checkIn": "2026-09-05T09:05:23Z",
      "checkOut": null,
      "status": "PRESENT"
    }
  }
}
```

#### POST /api/attendance/check-out

**Permission Required:** `attendance.self`

**Request:**
```json
{
  "employeeId": "01932e5a-..."
}
```

**Response (200):** Returns updated attendance with `checkOut`, `workedHours`, `overtimeHours`

#### PATCH /api/attendance/[id]

**Permission Required:** `attendance.correct`

**Request:**
```json
{
  "checkIn": "2026-09-05T09:00:00Z",
  "checkOut": "2026-09-05T18:00:00Z",
  "correctionReason": "Forgot to check out, manually corrected by HR"
}
```

### Frontend Changes Required

**Remove:** `MOCK_ATTENDANCE` from `src/lib/mocks/attendance.mock.ts`  
**Update:** Attendance list page to use real API with filters  
**Update:** Check-in/Check-out to call real backend endpoints  
**Add:** Manual correction UI for HR Manager role  
**Add:** Display `isManualCorrection` and `correctionReason` in attendance records  
**Note:** Backend calculates `workedHours`, `overtimeHours`, `status` automatically

---

## 8. TIME OFF

### Time Off Types

#### GET /api/time-off/types

**Response:**
```json
{
  "success": true,
  "data": {
    "timeOffTypes": [
      {
        "id": "01932e5a-...",
        "name": "Paid Time Off",
        "code": "PTO",
        "unit": "DAYS",
        "requiresAllocation": true,
        "isPaid": true,
        "color": "#10B981",
        "isActive": true
      },
      {
        "name": "Sick Leave",
        "code": "SICK",
        "unit": "DAYS",
        "isPaid": true,
        "color": "#F59E0B"
      }
    ]
  }
}
```

### Time Off Allocations

#### GET /api/time-off/allocations

**Permission Required:** `timeoff.allocation.manage` (or authenticated for own)

**Query Parameters:**
- `employeeId` (UUID)
- `timeOffTypeId` (UUID)
- `status` (AllocationStatus) - DRAFT, APPROVED, REFUSED

**Response:**
```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "id": "01932e5a-...",
        "allocationNumber": "ALC-2026-001",
        "employeeId": "01932e5a-...",
        "employee": {
          "employeeNumber": "EMP-00102",
          "firstName": "John",
          "lastName": "Doe"
        },
        "timeOffTypeId": "01932e5a-...",
        "timeOffType": {
          "name": "Paid Time Off",
          "code": "PTO",
          "unit": "DAYS"
        },
        "allocatedQuantity": 15.0,
        "takenQuantity": 3.0,
        "remainingQuantity": 12.0,
        "validFrom": "2026-01-01",
        "validTo": "2026-12-31",
        "status": "APPROVED"
      }
    ]
  }
}
```

#### POST /api/time-off/allocations

**Permission Required:** `timeoff.allocation.manage`

### Time Off Requests

#### GET /api/time-off/requests

**Permission Required:** `timeoff.request.read` (or `timeoff.request.self` for own)

**Query Parameters:**
- `employeeId` (UUID)
- `timeOffTypeId` (UUID)
- `status` (TimeOffStatus) - DRAFT, SUBMITTED, APPROVED, REFUSED, CANCELLED
- `startDate` (YYYY-MM-DD)
- `endDate` (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "01932e5a-...",
        "requestNumber": "REQ-2026-0042",
        "employeeId": "01932e5a-...",
        "employee": {
          "employeeNumber": "EMP-00102",
          "firstName": "John",
          "lastName": "Doe"
        },
        "timeOffTypeId": "01932e5a-...",
        "timeOffType": {
          "name": "Paid Time Off",
          "code": "PTO",
          "unit": "DAYS"
        },
        "allocationId": "01932e5a-...",
        "startDate": "2026-09-15",
        "endDate": "2026-09-17",
        "startTime": null,
        "endTime": null,
        "durationQuantity": 3.0,
        "reason": "Family vacation",
        "status": "SUBMITTED",
        "approvedById": null,
        "approvedAt": null,
        "refusalReason": null,
        "createdAt": "2026-09-05T10:00:00Z"
      }
    ]
  }
}
```

#### POST /api/time-off/requests

**Permission Required:** `timeoff.request.self` (or `timeoff.request.read` for HR)

**Request:**
```json
{
  "employeeId": "01932e5a-...",
  "timeOffTypeId": "01932e5a-...",
  "startDate": "2026-09-15",
  "endDate": "2026-09-17",
  "reason": "Family vacation",
  "status": "SUBMITTED"
}
```

**Note:** Backend calculates `durationQuantity` based on working schedule

#### POST /api/time-off/requests/[id]/approve

**Permission Required:** `timeoff.request.approve`

**Response (200):** Returns approved request with updated status, `approvedById`, `approvedAt`

#### POST /api/time-off/requests/[id]/reject

**Permission Required:** `timeoff.request.approve`

**Request:**
```json
{
  "refusalReason": "Insufficient coverage during requested period"
}
```

#### POST /api/time-off/requests/[id]/cancel

**Permission Required:** `timeoff.request.self` (own requests)

### Frontend Changes Required

**Remove:** `MOCK_TIMEOFF_TYPES`, `MOCK_TIMEOFF_ALLOCATIONS`, `MOCK_TIMEOFF_REQUESTS` from `src/lib/mocks/timeoff.mock.ts`  
**Update:** All time-off pages to use real APIs  
**Update:** Service endpoint from `/api/timeoff/*` to `/api/time-off/*` (note the hyphen)  
**Add:** Approval/rejection workflow for HR Manager  
**Add:** Balance display from allocation remainingQuantity  
**Note:** Backend handles balance deduction/restoration automatically  
**Note:** Backend validates overlaps and working day calculations

---

## 9. SALARY STRUCTURES & RULES

### Salary Structures

#### GET /api/payroll/salary-structures

**Permission Required:** `payroll.structure.read`

**Response:**
```json
{
  "success": true,
  "data": {
    "salaryStructures": [
      {
        "id": "01932e5a-...",
        "name": "Regular Full-Time Structure",
        "code": "REG_FULLTIME_STRUCTURE",
        "description": "Standard salary structure for permanent employees",
        "isActive": true,
        "structureRules": [
          {
            "id": "01932e5a-...",
            "salaryRuleId": "01932e5a-...",
            "salaryRule": {
              "code": "BASIC",
              "name": "Basic Salary",
              "category": "BASIC",
              "sequence": 10
            },
            "sequenceOverride": 10
          },
          {
            "salaryRule": {
              "code": "HRA",
              "name": "House Rent Allowance",
              "category": "ALLOWANCE",
              "computationType": "PERCENTAGE",
              "percentageBaseCode": "BASIC",
              "percentageRate": 40.0
            }
          }
        ]
      }
    ]
  }
}
```

#### POST /api/payroll/salary-structures

**Permission Required:** `payroll.structure.write`

### Salary Rules

#### GET /api/payroll/salary-rules

**Permission Required:** `payroll.rule.read`

**Query Parameters:**
- `category` (SalaryRuleCategory) - BASIC, ALLOWANCE, GROSS, DEDUCTION, NET, COMPANY_CONTRIBUTION
- `isActive` (boolean)

**Response:**
```json
{
  "success": true,
  "data": {
    "salaryRules": [
      {
        "id": "01932e5a-...",
        "name": "Basic Salary",
        "code": "BASIC",
        "category": "BASIC",
        "sequence": 10,
        "computationType": "FIXED",
        "fixedAmount": 0.0,
        "percentageBaseCode": null,
        "percentageRate": null,
        "formulaExpression": null,
        "isConditionBased": false,
        "description": "Contract base monthly salary",
        "isActive": true
      },
      {
        "name": "House Rent Allowance",
        "code": "HRA",
        "category": "ALLOWANCE",
        "sequence": 20,
        "computationType": "PERCENTAGE",
        "percentageBaseCode": "BASIC",
        "percentageRate": 40.0,
        "description": "40% of Basic Salary for housing"
      },
      {
        "name": "Gross Salary",
        "code": "GROSS",
        "category": "GROSS",
        "sequence": 50,
        "computationType": "FORMULA",
        "formulaExpression": "BASIC + HRA + TRANSPORT"
      },
      {
        "name": "Provident Fund (Employee)",
        "code": "PF",
        "category": "DEDUCTION",
        "sequence": 60,
        "computationType": "PERCENTAGE",
        "percentageBaseCode": "BASIC",
        "percentageRate": 12.0
      },
      {
        "name": "Net Salary",
        "code": "NET",
        "category": "NET",
        "sequence": 100,
        "computationType": "FORMULA",
        "formulaExpression": "GROSS - PF - TAX - UNPAID_DEDUCTION"
      }
    ]
  }
}
```

#### POST /api/payroll/salary-rules

**Permission Required:** `payroll.rule.write`

### Frontend Changes Required

**Remove:** `MOCK_SALARY_RULES`, `MOCK_SALARY_STRUCTURES` from `src/lib/mocks/payroll.mock.ts`  
**Update:** Salary structure/rule management pages to use real APIs  
**Add:** Rule sequence ordering UI  
**Add:** Formula expression input with validation  
**Note:** Do NOT implement payroll calculation in frontend - backend engine is authoritative  
**Warning:** Do NOT use `eval()` or `Function()` for formulas in frontend

---

## 10. PAYRUNS

### API Endpoints

#### GET /api/payroll/payruns

**Permission Required:** `payroll.payrun.read`

**Query Parameters:**
- `status` (PayrunStatus) - DRAFT, COMPUTED, VALIDATED, PAID, CANCELLED
- `salaryStructureId` (UUID)
- `startDate` (YYYY-MM-DD) - Period start filter
- `endDate` (YYYY-MM-DD) - Period end filter

**Response:**
```json
{
  "success": true,
  "data": {
    "payruns": [
      {
        "id": "01932e5a-...",
        "name": "September 2026 Regular Payroll",
        "reference": "RUN-2026-09-001",
        "salaryStructureId": "01932e5a-...",
        "salaryStructure": {
          "name": "Regular Full-Time Structure",
          "code": "REG_FULLTIME_STRUCTURE"
        },
        "periodStartDate": "2026-09-01",
        "periodEndDate": "2026-09-30",
        "paymentDate": null,
        "status": "DRAFT",
        "totalGross": 0.0,
        "totalDeductions": 0.0,
        "totalNet": 0.0,
        "totalEmployerCost": 0.0,
        "payslipCount": 0,
        "warningCount": 0,
        "notes": null,
        "validatedById": null,
        "validatedAt": null,
        "paidById": null,
        "paidAt": null,
        "emailsSentCount": 0,
        "emailsSentAt": null,
        "createdAt": "2026-09-05T10:00:00Z"
      }
    ]
  }
}
```

#### POST /api/payroll/payruns

**Permission Required:** `payroll.payrun.create`

**Request:**
```json
{
  "name": "September 2026 Regular Payroll",
  "salaryStructureId": "01932e5a-...",
  "periodStartDate": "2026-09-01",
  "periodEndDate": "2026-09-30",
  "employeeIds": [
    "01932e5a-...",
    "01932e5b-..."
  ],
  "notes": "Regular monthly payroll"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "payrun": {
      "id": "01932e5a-...",
      "name": "September 2026 Regular Payroll",
      "reference": "RUN-2026-09-001",
      "status": "DRAFT",
      "payslipCount": 0
    }
  }
}
```

**Note:** Backend automatically determines the applicable contract for each employee

#### GET /api/payroll/payruns/[id]

**Permission Required:** `payroll.payrun.read`

**Response (200):** Returns full payrun with payslips array

#### POST /api/payroll/payruns/[id]/compute

**Permission Required:** `payroll.payrun.compute`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payrun": {
      "id": "01932e5a-...",
      "status": "COMPUTED",
      "totalGross": 345000.0,
      "totalDeductions": 82800.0,
      "totalNet": 262200.0,
      "totalEmployerCost": 387600.0,
      "payslipCount": 3,
      "warningCount": 1
    }
  }
}
```

**Note:** Backend runs full payroll computation engine:
- Loads contracts, attendance, time-off for period
- Executes salary rules in sequence
- Calculates all allowances, deductions, net pay
- Generates payslip lines with snapshots
- Identifies warnings (missing bank info, etc.)

#### POST /api/payroll/payruns/[id]/validate

**Permission Required:** `payroll.payrun.validate`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payrun": {
      "id": "01932e5a-...",
      "status": "VALIDATED",
      "validatedById": "01932e5a-...",
      "validatedAt": "2026-09-05T14:30:00Z"
    }
  }
}
```

**Note:** Validation locks the payrun - no further modifications allowed

#### POST /api/payroll/payruns/[id]/paid

**Permission Required:** `payroll.payrun.pay`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payrun": {
      "id": "01932e5a-...",
      "status": "PAID",
      "paidById": "01932e5a-...",
      "paidAt": "2026-09-05T15:00:00Z"
    }
  }
}
```

#### POST /api/payroll/payruns/[id]/email-payslips

**Permission Required:** `payroll.payrun.pay`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "bulkDelivery": {
      "payrunId": "01932e5a-...",
      "totalAttempted": 3,
      "successCount": 2,
      "failureCount": 1,
      "results": [
        {
          "payslipId": "01932e5a-...",
          "employeeEmail": "john.doe@peoplepay360.com",
          "status": "SENT",
          "sentAt": "2026-09-05T15:05:00Z"
        },
        {
          "payslipId": "01932e5b-...",
          "employeeEmail": "sarah.smith@peoplepay360.com",
          "status": "FAILED",
          "error": "Invalid email address"
        }
      ]
    }
  }
}
```

**Note:** Backend sends real emails using nodemailer service

### Frontend Changes Required

**Remove:** `MOCK_PAYRUNS` from `src/lib/mocks/payroll.mock.ts`  
**Remove:** All fake success responses from compute/validate/paid endpoints  
**Update:** Payrun list/detail pages to use real API  
**Update:** Compute button to call real `/api/payroll/payruns/[id]/compute`  
**Update:** Validate button to call real `/api/payroll/payruns/[id]/validate`  
**Update:** Mark Paid button to call real `/api/payroll/payruns/[id]/paid`  
**Update:** Email Payslips button to call real `/api/payroll/payruns/[id]/email-payslips`  
**Add:** Display real computation results (totals, warnings)  
**Add:** Show email delivery status from backend response  
**Add:** Disable actions based on current status (can't validate DRAFT, etc.)  
**Never:** Show "Success" without actual backend confirmation  
**Never:** Use `setStatus("paid")` without backend response

---

## 11. PAYSLIPS

### API Endpoints

#### GET /api/payroll/payslips

**Permission Required:** `payroll.payrun.read` (or `payslip.self.read` for own)

**Query Parameters:**
- `employeeId` (UUID) - Filter by employee (employees can only see own)
- `payrunId` (UUID) - Filter by payrun
- `status` (PayslipStatus) - DRAFT, COMPUTED, VALIDATED, PAID, CANCELLED
- `startDate` (YYYY-MM-DD) - Period start filter
- `endDate` (YYYY-MM-DD) - Period end filter

**Response:**
```json
{
  "success": true,
  "data": {
    "payslips": [
      {
        "id": "01932e5a-...",
        "payslipNumber": "PS-2026-09-00102",
        "payrunId": "01932e5a-...",
        "payrun": {
          "name": "September 2026 Regular Payroll",
          "reference": "RUN-2026-09-001"
        },
        "employeeId": "01932e5a-...",
        "contractId": "01932e5a-...",
        "salaryStructureId": "01932e5a-...",
        "periodStartDate": "2026-09-01",
        "periodEndDate": "2026-09-30",
        "status": "PAID",
        "employeeNumberSnapshot": "EMP-00102",
        "employeeNameSnapshot": "John Doe",
        "contractNumberSnapshot": "CON-2026-JD2",
        "contractWageSnapshot": 60000.0,
        "contractWageTypeSnapshot": "MONTHLY",
        "salaryStructureNameSnapshot": "Regular Full-Time Structure",
        "departmentNameSnapshot": "Engineering",
        "jobPositionNameSnapshot": "Senior Software Engineer",
        "scheduledWorkingDays": 22.0,
        "actualWorkedDays": 21.0,
        "paidLeaveQuantity": 1.0,
        "unpaidLeaveQuantity": 0.0,
        "absentDays": 0.0,
        "workedHours": 168.0,
        "expectedHours": 176.0,
        "overtimeHours": 0.0,
        "basicSalary": 60000.0,
        "grossSalary": 87000.0,
        "totalDeductions": 20400.0,
        "netSalary": 66600.0,
        "totalEmployerCost": 94200.0,
        "hasWarnings": false,
        "warningsJson": null,
        "pdfGeneratedAt": "2026-09-05T15:10:00Z",
        "emailSentAt": "2026-09-05T15:15:00Z",
        "emailDeliveryStatus": "SENT",
        "createdAt": "2026-09-05T14:00:00Z"
      }
    ]
  }
}
```

#### GET /api/payroll/payslips/[id]

**Permission Required:** `payroll.payrun.read` (or `payslip.self.read` for own)

**Response (200):** Returns single payslip with full details and `lines` array

**Example with lines:**
```json
{
  "success": true,
  "data": {
    "payslip": {
      "id": "01932e5a-...",
      "payslipNumber": "PS-2026-09-00102",
      "employeeNameSnapshot": "John Doe",
      "basicSalary": 60000.0,
      "grossSalary": 87000.0,
      "totalDeductions": 20400.0,
      "netSalary": 66600.0,
      "lines": [
        {
          "id": "01932e5a-...",
          "ruleCode": "BASIC",
          "ruleName": "Basic Salary",
          "category": "BASIC",
          "sequence": 10,
          "rate": null,
          "baseAmount": null,
          "amount": 60000.0,
          "formulaSnapshot": "Contract wage: 60000.00"
        },
        {
          "ruleCode": "HRA",
          "ruleName": "House Rent Allowance",
          "category": "ALLOWANCE",
          "sequence": 20,
          "rate": 40.0,
          "baseAmount": 60000.0,
          "amount": 24000.0,
          "formulaSnapshot": "40% of BASIC (60000.00)"
        },
        {
          "ruleCode": "TRANSPORT",
          "ruleName": "Transport Allowance",
          "category": "ALLOWANCE",
          "sequence": 30,
          "rate": null,
          "baseAmount": null,
          "amount": 3000.0,
          "formulaSnapshot": "Fixed amount"
        },
        {
          "ruleCode": "GROSS",
          "ruleName": "Gross Salary",
          "category": "GROSS",
          "sequence": 50,
          "amount": 87000.0,
          "formulaSnapshot": "BASIC (60000.00) + HRA (24000.00) + TRANSPORT (3000.00)"
        },
        {
          "ruleCode": "PF",
          "ruleName": "Provident Fund (Employee)",
          "category": "DEDUCTION",
          "sequence": 60,
          "rate": 12.0,
          "baseAmount": 60000.0,
          "amount": 7200.0,
          "formulaSnapshot": "12% of BASIC (60000.00)"
        },
        {
          "ruleCode": "TAX",
          "ruleName": "Income Tax Deduction",
          "category": "DEDUCTION",
          "sequence": 70,
          "rate": 10.0,
          "baseAmount": 87000.0,
          "amount": 8700.0,
          "formulaSnapshot": "10% of GROSS (87000.00)"
        },
        {
          "ruleCode": "UNPAID_DEDUCTION",
          "ruleName": "Unpaid Leave Deduction",
          "category": "DEDUCTION",
          "sequence": 80,
          "amount": 4500.0,
          "formulaSnapshot": "1.0 unpaid days of 22.0 scheduled * 60000.00"
        },
        {
          "ruleCode": "NET",
          "ruleName": "Net Salary",
          "category": "NET",
          "sequence": 100,
          "amount": 66600.0,
          "formulaSnapshot": "GROSS (87000.00) - PF (7200.00) - TAX (8700.00) - UNPAID_DEDUCTION (4500.00)"
        }
      ]
    }
  }
}
```

#### GET /api/payroll/payslips/[id]/pdf

**Permission Required:** `payslip.self.read` (for own) or `payroll.payrun.read`

**Response (200):** Binary PDF file

**Headers:**
```
Content-Type: application/pdf
Content-Disposition: inline; filename="payslip-PS-2026-09-00102.pdf"
Content-Length: 45678
Cache-Control: private, no-cache, no-store, must-revalidate
```

**Note:** Backend generates PDF using PDFKit with:
- Company branding
- Employee details snapshot
- Period and payment information
- Detailed earnings and deductions table
- Attendance summary
- Net pay prominently displayed

#### POST /api/payroll/payslips/[id]/email

**Permission Required:** `payroll.payrun.pay`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "delivery": {
      "payslipId": "01932e5a-...",
      "employeeEmail": "john.doe@peoplepay360.com",
      "status": "SENT",
      "sentAt": "2026-09-05T16:00:00Z"
    }
  }
}
```

### Frontend Changes Required

**Remove:** `MOCK_PAYSLIPS` from `src/lib/mocks/payroll.mock.ts`  
**Update:** Payslip list/detail pages to use real API  
**Update:** PDF download to call real `/api/payroll/payslips/[id]/pdf`  
**Update:** Display real payslip lines from backend  
**Add:** Show attendance metrics (workedDays, unpaidLeaveQuantity, etc.)  
**Add:** Show email delivery status (emailSentAt, emailDeliveryStatus)  
**Add:** Display warnings from `warningsJson` if present  
**Never:** Recalculate payslip totals in frontend - backend snapshots are authoritative  
**Never:** Generate fake browser PDF - use real backend PDF endpoint

---

## 12. DASHBOARD METRICS

### API Endpoint

#### GET /api/dashboard

**Permission Required:** Authenticated (role-based data filtering)

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalEmployees": 5,
      "activeEmployees": 5,
      "onLeaveEmployees": 0,
      "totalDepartments": 3,
      "pendingTimeOffRequests": 2,
      "pendingAllocations": 1,
      "currentMonthPayroll": {
        "payrunId": "01932e5a-...",
        "status": "COMPUTED",
        "totalGross": 345000.0,
        "totalNet": 262200.0,
        "payslipCount": 5
      },
      "attendanceHealthRate": 97.5,
      "departmentExpenditure": [
        {
          "departmentId": "01932e5a-...",
          "departmentName": "Engineering",
          "totalGross": 195000.0,
          "employeeCount": 3
        }
      ],
      "recentPayruns": [
        {
          "id": "01932e5a-...",
          "name": "September 2026 Regular Payroll",
          "status": "COMPUTED",
          "periodEndDate": "2026-09-30"
        }
      ]
    }
  }
}
```

**Note:** Backend calculates all metrics from actual database data

### Frontend Changes Required

**Remove:** `MOCK_DASHBOARD_METRICS` from `src/lib/mocks/dashboard.mock.ts`  
**Update:** Dashboard page to call real `/api/dashboard`  
**Update:** Service endpoint from `/api/payroll/metrics` to `/api/dashboard`  
**Never:** Hardcode statistics like `employees: 42` or `payroll: 125000`  
**Always:** Display backend-calculated metrics only

---

## 13. ENVIRONMENT CONFIGURATION

### Required Environment Variables

**.env (Backend):**
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/peoplepay360?schema=public"
NODE_ENV="development"
PORT="3000"
JWT_SECRET="development-jwt-secret-min-32-characters-long"
```

**Notes:**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - Secret for JWT signing (min 32 characters, required in production)
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default 3000)

### Frontend Configuration

**No environment variables required for frontend** - all API calls will be relative paths to the same Next.js server

---

## 14. RUNNING FRONTEND + BACKEND TOGETHER

### Option A: Separate Ports (Development)

**Backend (E:\peoplepay360hr-ep):**
```bash
# Install dependencies
npm install

# Set up database
createdb peoplepay360
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run migrations and seed
npm run db:generate
npm run db:migrate
npm run db:seed

# Start backend on port 3001
PORT=3001 npm run dev
```

**Frontend (D:\peoplepay360hr-ep):**
```bash
# Update API base URL to point to backend
# In src/lib/api/client.ts:
# this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

# Start frontend on port 3000
npm run dev
```

**Access:** http://localhost:3000 (frontend) → http://localhost:3001 (backend API)

### Option B: Merged Repository (Integration)

After frontend changes are complete:

```bash
# On your laptop
cd E:\peoplepay360hr-ep

# Merge frontend branch into backend branch
git checkout feature/backend-database
git pull origin feature/backend-database
git merge feature/frontend-foundation --no-commit

# Remove frontend mock files during merge
rm -rf src/lib/mocks/*.mock.ts
rm -rf src/app/api/* (keep only if needed for client-side routing)

# Resolve conflicts, test integration
npm install
npm run db:migrate
npm run dev

# Run integration tests
npm test
```

**Access:** http://localhost:3000 (unified app with real backend)

### Option C: Proxy Configuration (Alternative)

**Frontend next.config.ts:**
```typescript
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

---

## 15. INTEGRATION CHECKLIST

### Phase 1: Authentication (PRIORITY)

- [ ] Remove `DEMO_ACCOUNTS` from frontend login route
- [ ] Update `AuthContext` to use JWT flow
- [ ] Change cookie from `pp360_session` to `token`
- [ ] Update `authService.login()` to call backend
- [ ] Update `authService.getCurrentUser()` to call backend `/api/auth/me`
- [ ] Test login with all 6 test accounts
- [ ] Test session persistence across refresh
- [ ] Test logout functionality
- [ ] Verify role and permissions are loaded correctly

### Phase 2: Core HR Data

- [ ] Remove all mock files from `src/lib/mocks/`
- [ ] Update employees API to proxy/remove frontend routes
- [ ] Update departments API
- [ ] Update job positions API
- [ ] Update working schedules API
- [ ] Update contracts API
- [ ] Test employee CRUD operations
- [ ] Test permission-based access control

### Phase 3: Attendance & Time Off

- [ ] Update attendance list/detail pages
- [ ] Update check-in/check-out functionality
- [ ] Update time-off types/allocations/requests
- [ ] Update approval workflow
- [ ] Test attendance recording
- [ ] Test leave request submission and approval

### Phase 4: Payroll

- [ ] Update salary structures/rules pages
- [ ] Update payrun list/detail pages
- [ ] Update payrun compute button to real API
- [ ] Update payrun validate button to real API
- [ ] Update payrun mark paid button to real API
- [ ] Update email payslips button to real API
- [ ] Update payslip list/detail pages
- [ ] Update PDF download to real endpoint
- [ ] Remove all fake success messages
- [ ] Test full payroll lifecycle (create → compute → validate → paid → email)

### Phase 5: Dashboard & Polish

- [ ] Update dashboard to use real metrics API
- [ ] Fix all service endpoint URL mismatches
- [ ] Remove any remaining hardcoded data
- [ ] Add proper error handling for all API calls
- [ ] Add loading states for async operations
- [ ] Test all roles (EMPLOYEE, HR_MANAGER, HR_PAYROLL_MANAGER, ADMIN)

### Phase 6: Verification

- [ ] Run TypeScript compilation (`npm run build`)
- [ ] Run linter (`npm run lint`)
- [ ] Test E2E flow: Employee views payslip
- [ ] Test E2E flow: HR approves time off
- [ ] Test E2E flow: Payroll Manager runs payrun
- [ ] Verify no mock data remains in codebase
- [ ] Verify no DEMO_ACCOUNTS in code
- [ ] Verify all permissions are enforced

---

## 16. API ENDPOINT SUMMARY

### Authentication
- `POST /api/auth/login` - Authenticate user, get JWT token
- `GET /api/auth/me` - Get current user profile with permissions

### Employees
- `GET /api/employees` - List employees (with filters)
- `POST /api/employees` - Create employee
- `GET /api/employees/[id]` - Get employee details
- `PATCH /api/employees/[id]` - Update employee

### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department
- `GET /api/departments/[id]` - Get department
- `PATCH /api/departments/[id]` - Update department

### Job Positions
- `GET /api/job-positions?departmentId=...` - List positions
- `POST /api/job-positions` - Create position
- `GET /api/job-positions/[id]` - Get position
- `PATCH /api/job-positions/[id]` - Update position

### Working Schedules
- `GET /api/working-schedules` - List schedules
- `POST /api/working-schedules` - Create schedule
- `GET /api/working-schedules/[id]` - Get schedule
- `PATCH /api/working-schedules/[id]` - Update schedule

### Contracts
- `GET /api/employees/[id]/contracts` - List employee contracts
- `POST /api/contracts` - Create contract
- `GET /api/contracts/[id]` - Get contract
- `PATCH /api/contracts/[id]` - Update contract

### Attendance
- `GET /api/attendance?employeeId=...&startDate=...&endDate=...` - List attendance
- `POST /api/attendance/check-in` - Check in
- `POST /api/attendance/check-out` - Check out
- `GET /api/attendance/[id]` - Get attendance record
- `PATCH /api/attendance/[id]` - Manual correction

### Time Off
- `GET /api/time-off/types` - List time off types
- `GET /api/time-off/allocations?employeeId=...` - List allocations
- `POST /api/time-off/allocations` - Create allocation
- `GET /api/time-off/requests?employeeId=...&status=...` - List requests
- `POST /api/time-off/requests` - Create request
- `POST /api/time-off/requests/[id]/approve` - Approve request
- `POST /api/time-off/requests/[id]/reject` - Reject request
- `POST /api/time-off/requests/[id]/cancel` - Cancel request

### Payroll - Structures & Rules
- `GET /api/payroll/salary-structures` - List structures
- `POST /api/payroll/salary-structures` - Create structure
- `GET /api/payroll/salary-rules` - List rules
- `POST /api/payroll/salary-rules` - Create rule

### Payroll - Payruns
- `GET /api/payroll/payruns?status=...` - List payruns
- `POST /api/payroll/payruns` - Create payrun
- `GET /api/payroll/payruns/[id]` - Get payrun
- `POST /api/payroll/payruns/[id]/compute` - Compute payslips
- `POST /api/payroll/payruns/[id]/validate` - Validate payrun
- `POST /api/payroll/payruns/[id]/paid` - Mark as paid
- `POST /api/payroll/payruns/[id]/email-payslips` - Send bulk emails

### Payroll - Payslips
- `GET /api/payroll/payslips?employeeId=...&payrunId=...` - List payslips
- `GET /api/payroll/payslips/[id]` - Get payslip details
- `GET /api/payroll/payslips/[id]/pdf` - Download PDF
- `POST /api/payroll/payslips/[id]/email` - Send individual email

### Dashboard
- `GET /api/dashboard` - Get dashboard metrics

---

## 17. CRITICAL NOTES

### DO NOT:
- ❌ Create new Prisma schema
- ❌ Create new database
- ❌ Modify existing Prisma models
- ❌ Create new authentication system
- ❌ Keep DEMO_ACCOUNTS in code
- ❌ Keep any mock data files
- ❌ Implement payroll calculations in frontend
- ❌ Use `eval()` or `Function()` for formulas
- ❌ Show fake success messages
- ❌ Generate browser PDFs instead of backend PDFs
- ❌ Add public signup (not in MVP)
- ❌ Add role selection at login
- ❌ Modify backend database schema

### MUST DO:
- ✅ Use existing backend APIs exactly as documented
- ✅ Replace all mock data with real API calls
- ✅ Use JWT token authentication with `token` cookie
- ✅ Test with provided test accounts
- ✅ Display real backend responses only
- ✅ Handle all HTTP error codes properly
- ✅ Check permissions before showing UI features
- ✅ Use backend-calculated values (never recalculate in frontend)
- ✅ Verify all changes work with actual PostgreSQL database

---

## 18. NEXT STEPS

1. **Review this document** with your team
2. **Set up local backend** (E:\peoplepay360hr-ep)
3. **Run database migrations** and seed
4. **Test backend APIs** with Postman/curl
5. **Begin Phase 1 integration** (Authentication)
6. **Test each phase** before moving to next
7. **Document any backend issues** found during integration
8. **Request clarification** if any API behavior is unclear

---

**End of Backend Integration Map**
