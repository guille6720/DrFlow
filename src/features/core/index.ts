/** Platform guards and tenant scope — shared across features. */
export { requireClinicPermission, requireActiveClinic } from "@/lib/actions/clinic-guard";
export {
  assertSameClinic,
  clinicScopedIdFilter,
  CLINIC_SCOPED_TABLES,
  isSameClinic,
  requireResourceInClinic,
  TenantScopeError,
} from "@/lib/security/tenant-scope";
