import type { Role } from "@judilen/auth";

export function removesLastSuperAdmin(input: {
  currentRole: Role;
  currentActive: boolean;
  nextRole?: Role;
  nextActive?: boolean;
  activeSuperAdmins: number;
}) {
  if (input.currentRole !== "super_admin" || !input.currentActive) return false;
  const removesSuperAccess = input.nextActive === false || (input.nextRole !== undefined && input.nextRole !== "super_admin");
  return removesSuperAccess && input.activeSuperAdmins <= 1;
}
