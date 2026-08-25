# ReNaPDiS fiscalization scenarios (staging)

Reproducible evaluator scenarios. Capture screenshots / audit IDs as evidence. **Synthetic data only.**

## Shared prerequisites

- Staging app on same commit as production candidate
- Fiscalization clinic seeded (`supabase/seeds/fiscalization/`)
- MFA enrolled for prescriber persona
- Migration 142 applied (`clinics.is_fiscalization`)

---

### 1. Successful login

- **Steps:** Open fiscalization URL → sign in as provisioned user  
- **Expected:** Dashboard for fiscalization clinic  
- **Evidence:** Session screenshot (no PHI beyond synthetic names)

### 2. MFA enrollment / AAL2

- **Steps:** Enroll TOTP → elevate session before prescribing  
- **Expected:** Prescription issue blocked until AAL2  
- **Evidence:** Error message + MFA UI

### 3. Professional validation

- **Steps:** Open valid fiscalization professional → Validar REFEPS (sandbox)  
- **Expected:** Status `sandbox`  
- **Evidence:** Professional profile section

### 4. Invalid professional blocked

- **Steps:** Attempt national submit with invalid professional  
- **Expected:** Blocked; audit `national_prescription_blocked`  
- **Evidence:** Error + audit row metadata (no full PHI)

### 5. Patient identity validation

- **Steps:** Edit patient with CUIL / without CUIL / foreign alt ID  
- **Expected:** Local save OK without CUIL; national path requires CUIL or alt  
- **Evidence:** Form + national block message

### 6. Local prescription

- **Steps:** Issue local Rx with MFA  
- **Expected:** `national_rx_status=local` / REFEPS local  
- **Evidence:** Prescription list + print preview

### 7. National sandbox prescription

- **Steps:** Submit with valid patient + sandbox professional  
- **Expected:** Sandbox CUIR debug / sandbox labeling — **not** official numeric CUIR as legal  
- **Evidence:** Print shows **CUIR SANDBOX — SIN VALIDEZ LEGAL**

### 8. CUIR sandbox labeling

- **Steps:** Inspect QR/title on sandbox Rx  
- **Expected:** Explicit non-legal wording  
- **Evidence:** Screenshot

### 9. Official mode blocked without DNSISA IDs

- **Steps:** Attempt official CUIR generation without M1/M2  
- **Expected:** pending/failed; no official concatenation claimed  
- **Evidence:** Gate error codes

### 10. Cross-clinic denial

- **Steps:** Fiscalization user queries other clinic patient IDs  
- **Expected:** Empty / forbidden (RLS)  
- **Evidence:** Query result / UI denial

### 11. Audit event review

- **Steps:** Filter audit for Phase 2/3 events  
- **Expected:** Immutable events without secrets/OTP  
- **Evidence:** Audit table export (sanitized)

### 12. External dependency outage

- **Steps:** Set `REFEPS_FORCE_OUTAGE=true` on staging → submit national  
- **Expected:** Failed/pending; never “submitted” nationally  
- **Evidence:** Error string + prescription status

### 13. Health endpoint

- **Steps:** `GET /api/health/live`, `/api/health/ready`  
- **Expected:** 200 when healthy; no secrets in JSON  
- **Evidence:** Response bodies

### 14. Backup / recovery evidence

- **Steps:** Follow restore drill to **temporary** project (not active staging overwrite)  
- **Expected:** Documented RPO/RTO measurements  
- **Evidence:** Completed `RENAPDIS_DR_DRILL.md` form
