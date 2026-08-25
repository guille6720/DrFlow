# Fiscalization seed (staging only)

## Purpose

Isolated synthetic clinic for ReNaPDiS evaluator scenarios. **No real PHI.**

## Mapping of logical roles → DrFlow roles

| Fiscalization persona | DrFlow `clinic_members.role` | Notes |
|----------------------|------------------------------|-------|
| `fiscalization_admin` | `clinic_admin` | Full clinic admin inside fiscalization clinic only |
| `fiscalization_prescriber` | `doctor` | Requires MFA / AAL2 for prescriptions |
| `fiscalization_readonly` | `secretary` (or doctor without issue permission) | Read-oriented; no service-role |

RLS is **not** weakened. Evaluators never receive `SUPABASE_SERVICE_ROLE_KEY`.

## Provisioning (manual, secure)

1. Apply migration `142_renapdis_phase3_fiscalization_marker.sql` on **staging**.
2. Run `01_clinic_and_patients.sql` on staging SQL editor (never production).
3. In Supabase Auth (staging): invite users with temporary passwords; force password reset.
4. Enable MFA (TOTP) for prescriber accounts before prescription scenarios.
5. Insert `clinic_members` rows linking auth UIDs to clinic `a1111111-1111-4111-8111-111111111111`.
6. Create professionals under that clinic with `display_name` containing `(FISCALIZACION TEST)` and REFEPS status `sandbox` or `not_configured` as needed for scenarios.

Do **not** hardcode passwords in git.

## Synthetic identifiers

- Documents: `90000001`… (reserved test range)
- CUIL example `20123456786` is a **checksum-valid structural test value**, not a real person
- Passport / alt IDs prefixed with `P-TEST-` / clearly labeled

## Cross-clinic RLS

Create a second normal staging clinic and confirm fiscalization users cannot read its patients.
