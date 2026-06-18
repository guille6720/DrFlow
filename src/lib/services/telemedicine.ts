import type { TelemedicineStatus } from "@/types/database";

export interface TelemedicineRoom {
  id: string;
  appointmentId: string;
  roomUrl: string;
  status: TelemedicineStatus;
}

export interface TelemedicineService {
  createRoom(appointmentId: string, patientName: string): Promise<TelemedicineRoom>;
}

class JitsiTelemedicineService implements TelemedicineService {
  async createRoom(
    appointmentId: string,
    patientName: string
  ): Promise<TelemedicineRoom> {
    const roomName = `drflow-${appointmentId.slice(0, 8)}-${Date.now()}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;

    return {
      id: crypto.randomUUID(),
      appointmentId,
      roomUrl,
      status: "scheduled",
    };
  }
}

export const telemedicineService: TelemedicineService =
  new JitsiTelemedicineService();

export function buildTelemedicineMessage(
  patientName: string,
  roomUrl: string,
  appointmentDate: string
): string {
  return `Hola ${patientName}, tu videoconsulta está programada para ${appointmentDate}. Ingresá acá: ${roomUrl}`;
}
