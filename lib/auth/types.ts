export interface JWTPayload {
  userId: string;
  email: string;
  roleCode: string;
}

export interface SafeUser {
  id: string;
  email: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  role: {
    id: string;
    code: string;
    name: string;
  };
  permissions: string[];
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department: {
      id: string;
      name: string;
      code: string;
    };
    jobPosition: {
      id: string;
      title: string;
      code: string;
    };
  } | null;
}

export interface AuthSession {
  token: string;
  user: SafeUser;
}

export interface RolePermissionMatrixItem {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}
