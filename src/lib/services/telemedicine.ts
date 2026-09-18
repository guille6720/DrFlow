import {
  createTelemedicineRoom,
  type TelemedicineProviderId,
} from "@/core/telemedicine/provider";

import type { TelemedicineStatus } from "@/types/database";

export interface TelemedicineRoom {
  id: string;
  appointmentId: string;
  roomUrl: string;
  status: TelemedicineStatus;
  provider: TelemedicineProviderId;
  externalRoomId: string | null;
  expiresAt: string | null;
}

export interface TelemedicineService {
  createRoom(
    appointmentId: string,
    patientName: string,
    appointmentStartAt: string
  ): Promise<TelemedicineRoom>;
}

class DrFlowTelemedicineService implements TelemedicineService {
  async createRoom(
    appointmentId: string,
    _patientName: string,
    appointmentStartAt: string
  ): Promise<TelemedicineRoom> {
    const room = await createTelemedicineRoom({ appointmentId, appointmentStartAt });

    return {
      id: crypto.randomUUID(),
      appointmentId,
      roomUrl: room.roomUrl,
      status: "scheduled",
      provider: room.provider,
      externalRoomId: room.externalRoomId,
      expiresAt: room.expiresAt,
    };
  }
}

export const telemedicineService: TelemedicineService = new DrFlowTelemedicineService();

export function buildTelemedicineMessage(input: {
  patientName: string;
  appointmentDate: string;
  clinicName: string;
  joinUrl: string;
}): string {
  return [
    `Hola ${input.patientName},`,
    "",
    `Tu videoconsulta con ${input.clinicName} está programada para ${input.appointmentDate}.`,
    "",
    `Ingresá acá: ${input.joinUrl}`,
    "",
    "Recomendamos usar Chrome o Safari con cámara y micrófono habilitados.",
    "",
    "NexClinic",
  ].join("\n");
}
