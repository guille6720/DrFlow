import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { AgendaDayList } from "@/features/agenda/components/agenda/agenda-day-list";

import { LAMEJOR_DEMO_CLINIC_ID } from "@/lib/utils/appointment";

const mocks = vi.hoisted(() => ({
  updateStatus: vi.fn().mockResolvedValue({ success: true }),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/actions/appointments", () => ({ updateAppointmentStatus: mocks.updateStatus }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const day = new Date(2026, 10, 26, 16, 30);
const appointment: AppointmentAgendaRow = {
  id: "demo-web-appointment",
  clinic_id: LAMEJOR_DEMO_CLINIC_ID,
  patient_id: "demo-patient",
  professional_id: "demo-professional",
  location_id: null,
  specialty_id: null,
  start_at: day.toISOString(),
  end_at: new Date(2026, 10, 26, 17).toISOString(),
  status: "pending",
  booking_source: "online",
  notes: null,
  cancellation_reason: null,
  cancelled_at: null,
  cancelled_by: null,
  cancelled_by_type: null,
};

it("confirms a pending online appointment from the daily calendar row", async () => {
  const onAppointmentClick = vi.fn();
  const view = render(
    <AgendaDayList day={day} appointments={[appointment]} canManage onAppointmentClick={onAppointmentClick} />
  );
  expect(screen.queryByRole("button", { name: "Presente" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Confirmar turno online" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(mocks.updateStatus).toHaveBeenCalledWith(appointment.id, "confirmed", undefined, undefined, undefined);
  expect(onAppointmentClick).not.toHaveBeenCalled();

  view.rerender(<AgendaDayList day={day} appointments={[{ ...appointment, status: "confirmed" }]} canManage />);
  expect(screen.getByText("Confirmado", { exact: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Presente" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar turno online" })).not.toBeInTheDocument();
});

it("keeps confirmation limited to users who can manage the agenda", () => {
  render(<AgendaDayList day={day} appointments={[appointment]} canManage={false} />);
  expect(screen.queryByRole("button", { name: "Confirmar turno online" })).not.toBeInTheDocument();
});
