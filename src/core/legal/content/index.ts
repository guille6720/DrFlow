import { backupsPolicyDocument } from "@/core/legal/content/backups-policy";
import { cookiesPolicyDocument } from "@/core/legal/content/cookies-policy";
import { privacyPolicyDocument } from "@/core/legal/content/privacy-policy";
import { securityPolicyDocument } from "@/core/legal/content/security-policy";
import { softwareLicensesDocument } from "@/core/legal/content/software-licenses";
import { termsOfServiceDocument } from "@/core/legal/content/terms-of-service";
import type { LegalDocument } from "@/core/legal/content/types";

export { privacyPolicyDocument } from "@/core/legal/content/privacy-policy";
export { termsOfServiceDocument } from "@/core/legal/content/terms-of-service";
export { LEGAL_CONTENT_VERSION } from "@/core/legal/content/types";

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
