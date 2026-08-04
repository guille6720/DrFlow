/** Platform guards and tenant scope — shared across features. */
export { requireClinicPermission, requireActiveClinic } from "@/core/actions/clinic-guard";
export {
  assertSameClinic,
  clinicScopedIdFilter,
  CLINIC_SCOPED_TABLES,
  isSameClinic,
  requireResourceInClinic,
  TenantScopeError,
} from "@/core/security/tenant-scope";
