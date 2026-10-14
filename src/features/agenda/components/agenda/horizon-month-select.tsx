"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";

import { listAppointmentHorizonMonths } from "@/lib/utils/appointment-booking-horizon";

const MONTH_KEY = "yyyy-MM";

interface HorizonMonthSelectProps {
  id: string;
  label: string;
  value: Date;
  onChange: (month: Date) => void;
  className?: string;
}

/** Month jump limited to the appointment booking horizon (shared by agenda month views). */
export function HorizonMonthSelect({ id, label, value, onChange, className }: HorizonMonthSelectProps) {
  const months = useMemo(() => listAppointmentHorizonMonths(), []);

  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={className}
        value={format(value, MONTH_KEY)}
        onChange={(event) => {
          const next = months.find((month) => format(month, MONTH_KEY) === event.target.value);
          if (next) onChange(next);
        }}
      >
        {months.map((month) => (
          <option key={format(month, MONTH_KEY)} value={format(month, MONTH_KEY)}>
            {format(month, "MMMM yyyy", { locale: es })}
          </option>
        ))}
      </select>
    </>
  );
}
