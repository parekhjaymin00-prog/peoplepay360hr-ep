# PeoplePay360 — Integrated HR & Payroll Operations Platform

PeoplePay360 is a full-stack, enterprise-grade Human Resources and Payroll operations platform featuring role-based access control (RBAC), multi-tier attendance tracking, time-off allocations & approvals, dynamic salary structure configuration, and an automated payroll calculation and payslip generation engine.

## Repository Architecture

- **Frontend (\src/\)**: Next.js App Router application with role-based dashboards (Admin, HR, Payroll, Manager, Employee), attendance check-in/out, time-off workflows, salary rules and structures UI, contract management, and payslip viewing.
- **Backend API & Services (\pp/\, \lib/\)**: Secure Next.js API route handlers, JWT/RBAC authentication guards, HR services, attendance calculation, time-off allocation engine, and payroll computation engine.
- **Database & Persistence (\prisma/\)**: PostgreSQL database managed through Prisma ORM with UUIDv7 primary keys, PostgreSQL exclusion constraints (\tree_gist\), check constraints, and comprehensive relational seed data.
- **Automated Tests (\	ests/\)**: Database integrity, authentication, attendance, time-off, salary rules, payroll engine, and payslip PDF generation tests.

## Getting Started

### 1. Install Dependencies
\\ash
npm install
\
### 2. Database Setup & Migrations
\\ash
npm run db:generate
npm run db:migrate
npm run db:seed
\
### 3. Run Development Server
\\ash
npm run dev
\
Open [http://localhost:3000](http://localhost:3000) with your browser.

### 4. Running Tests
\\ash
npm run test
\