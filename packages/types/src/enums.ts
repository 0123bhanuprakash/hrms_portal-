// ============================================================
// Enums — Fully implemented in Chunk 3
// Placeholder stubs so the package compiles now
// ============================================================

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
}

export enum CompanyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export enum DefaultRole {
  SUPER_ADMIN = 'super_admin',
  COMPANY_ADMIN = 'company_admin',
  HR = 'hr',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERN = 'intern',
}

export enum EmploymentStatus {
  ACTIVE = 'active',
  PROBATION = 'probation',
  NOTICE_PERIOD = 'notice_period',
  ON_LEAVE = 'on_leave',
  TERMINATED = 'terminated',
}
