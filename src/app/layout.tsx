import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'PeoplePay360 - Integrated HR & Payroll Operations Platform',
  description: 'Enterprise HR, Attendance, Time-off, and Payroll Platform for Odoo Full-Stack Hackathon',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
