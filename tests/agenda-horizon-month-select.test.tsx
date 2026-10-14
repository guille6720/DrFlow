import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { addMonths, format, startOfMonth } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppointmentDatetimePicker } from "@/features/agenda/components/agenda/appointment-datetime-picker";
import { HorizonMonthSelect } from "@/features/agenda/components/agenda/horizon-month-select";
import { MonthOverviewGrid } from "@/features/agenda/components/agenda/month-overview-grid";

import { APPOINTMENT_HORIZON_MONTHS } from "@/lib/utils/appointment-booking-horizon";

afterEach(cleanup);

const thisMonth = startOfMonth(new Date());
const monthKey = (d: Date) => format(d, "yyyy-MM");

describe("HorizonMonthSelect", () => {
  it("lists the booking horizon months and emits the chosen month", () => {
    const onChange = vi.fn();
    render(<HorizonMonthSelect id="m" label="Mes" value={thisMonth} onChange={onChange} />);

    const select = screen.getByLabelText("Mes") as HTMLSelectElement;
    expect(select.options).toHaveLength(APPOINTMENT_HORIZON_MONTHS);
    expect(select.value).toBe(monthKey(thisMonth));

    const target = addMonths(thisMonth, 3);
    fireEvent.change(select, { target: { value: monthKey(target) } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(monthKey(onChange.mock.calls[0][0])).toBe(monthKey(target));
  });

  it("ignores values outside the horizon", () => {
    const onChange = vi.fn();
    render(<HorizonMonthSelect id="m" label="Mes" value={thisMonth} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "1999-01" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("MonthOverviewGrid", () => {
  const appointments = [
    { start_at: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 10, 9).toISOString() },
    { start_at: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 10, 11).toISOString() },
  ] as Parameters<typeof MonthOverviewGrid>[0]["appointments"];

  it("renders the month jump when onSelectMonth is provided", () => {
    const onSelectMonth = vi.fn();
    render(<MonthOverviewGrid monthDate={thisMonth} appointments={appointments} onSelectMonth={onSelectMonth} />);

    const select = screen.getByLabelText("Ir a un mes");
    fireEvent.change(select, { target: { value: monthKey(addMonths(thisMonth, 1)) } });
    expect(onSelectMonth).toHaveBeenCalledTimes(1);
    expect(screen.getByText("2 turnos")).toBeTruthy();
  });

  it("renders a static month title without onSelectMonth", () => {
    render(<MonthOverviewGrid monthDate={thisMonth} appointments={[]} />);
    expect(screen.queryByLabelText("Ir a un mes")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
  });
});

describe("AppointmentDatetimePicker", () => {
  it("moves the calendar when a month is picked from the horizon select", () => {
    render(<AppointmentDatetimePicker value="" onChange={vi.fn()} />);

    const select = screen.getByLabelText("Mes") as HTMLSelectElement;
    expect(select.value).toBe(monthKey(thisMonth));

    const target = monthKey(addMonths(thisMonth, 2));
    fireEvent.change(select, { target: { value: target } });
    expect((screen.getByLabelText("Mes") as HTMLSelectElement).value).toBe(target);
  });
});
