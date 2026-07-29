export const employeeStatuses = ["working", "temporarily_inactive", "dismissed", "archived"] as const;
export type EmployeeStatus = (typeof employeeStatuses)[number];

export const employeeStatusLabels: Record<EmployeeStatus, string> = {
  working: "Работает",
  temporarily_inactive: "Временно не работает",
  dismissed: "Уволен",
  archived: "Архивный"
};

export type EmployeeRow = {
  id: string;
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  startDate: string | null;
  endDate: string | null;
  status: EmployeeStatus;
  comment: string | null;
  personnelNumber: string | null;
  userId: string | null;
  userEmail: string | null;
  isActive: boolean;
  expenseTotal: number;
};
