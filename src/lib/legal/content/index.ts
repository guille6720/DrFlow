import { backupsPolicyDocument } from "@/lib/legal/content/backups-policy";
import { cookiesPolicyDocument } from "@/lib/legal/content/cookies-policy";
import { privacyPolicyDocument } from "@/lib/legal/content/privacy-policy";
import { securityPolicyDocument } from "@/lib/legal/content/security-policy";
import { softwareLicensesDocument } from "@/lib/legal/content/software-licenses";
import { termsOfServiceDocument } from "@/lib/legal/content/terms-of-service";
import type { LegalDocument } from "@/lib/legal/content/types";

export { LEGAL_CONTENT_VERSION } from "@/lib/legal/content/types";
export { privacyPolicyDocument } from "@/lib/legal/content/privacy-policy";
export { termsOfServiceDocument } from "@/lib/legal/content/terms-of-service";

export const legalDocuments: LegalDocument[] = [
  termsOfServiceDocument,
  privacyPolicyDocument,
  cookiesPolicyDocument,
  securityPolicyDocument,
  backupsPolicyDocument,
  softwareLicensesDocument,
];

export function getLegalDocument(id: string): LegalDocument | undefined {
  return legalDocuments.find((doc) => doc.id === id);
}
