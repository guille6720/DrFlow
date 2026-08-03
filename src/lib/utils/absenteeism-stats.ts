export function absenteeismRate(noShowCount: number, totalAppointments: number): number {
  if (totalAppointments <= 0) return 0;
  return Math.round((noShowCount / totalAppointments) * 100);
}

export type AbsenteeismPeriodSummary = {
  label: string;
  noShowCount: number;
  totalAppointments: number;
  rate: number;
};
