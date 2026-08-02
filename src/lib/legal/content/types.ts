export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "h4"; text: string };

export type LegalSection = {
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  id: string;
  title: string;
  sections: LegalSection[];
};

export const LEGAL_CONTENT_VERSION = "2026-08-01";
