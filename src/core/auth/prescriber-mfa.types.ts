export type PrescriberMfaStatus = {
  enrolled: boolean;
  currentLevel: "aal1" | "aal2" | string;
  nextLevel: "aal1" | "aal2" | string | null;
  elevated: boolean;
  factorCount: number;
  factors: Array<{ id: string; friendlyName: string | null }>;
};
