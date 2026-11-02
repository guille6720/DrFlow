import { createHash } from "node:crypto";

export type StorageOperation = {
  clinicId: string;
  key: string;
  path: string;
  contentType: string;
  bytes: number;
  sha256: string;
};

export type StorageReservation = {
  id: string;
  operation: StorageOperation;
  state: "reserved" | "uncertain" | "verified";
};

export interface VerifiedStoragePorts {
  authorize(operation: StorageOperation): Promise<void>;
  reserve(operation: StorageOperation): Promise<StorageReservation>;
  upload(operation: StorageOperation, bytes: Uint8Array): Promise<void>;
  download(operation: StorageOperation): Promise<Uint8Array>;
  complete(reservation: StorageReservation): Promise<void>;
  markUncertain(reservation: StorageReservation): Promise<void>;
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameOperation(expected: StorageOperation, actual: StorageOperation): boolean {
  return expected.clinicId === actual.clinicId && expected.key === actual.key &&
    expected.path === actual.path && expected.contentType === actual.contentType &&
    expected.bytes === actual.bytes && expected.sha256 === actual.sha256;
}

export async function uploadVerifiedStorage(
  ports: VerifiedStoragePorts,
  input: Omit<StorageOperation, "bytes" | "sha256">,
  source: Uint8Array,
): Promise<StorageReservation> {
  if (!input.clinicId || !input.key || !input.contentType ||
    !input.path.startsWith(`${input.clinicId}/`) ||
    input.path.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
    /[\\%\u0000-\u001f]/.test(input.path)) {
    throw new Error("INVALID_STORAGE_OPERATION");
  }
  const bytes = Uint8Array.from(source);
  const operation = { ...input, bytes: bytes.byteLength, sha256: digest(bytes) };
  await ports.authorize(operation);
  const reservation = await ports.reserve(operation);
  if (!sameOperation(operation, reservation.operation)) {
    throw new Error("STORAGE_IDEMPOTENCY_CONFLICT");
  }
  if (reservation.state === "verified") return reservation;
  try {
    if (reservation.state === "reserved") {
      try {
        await ports.upload(operation, Uint8Array.from(bytes));
      } catch {
        const downloaded = await ports.download(operation);
        if (downloaded.byteLength !== operation.bytes || digest(downloaded) !== operation.sha256) {
          throw new Error("STORAGE_INTEGRITY_MISMATCH");
        }
        await ports.complete(reservation);
        return { ...reservation, state: "verified" };
      }
    }
    const downloaded = await ports.download(operation);
    if (downloaded.byteLength !== operation.bytes || digest(downloaded) !== operation.sha256) {
      throw new Error("STORAGE_INTEGRITY_MISMATCH");
    }
    await ports.complete(reservation);
    return { ...reservation, state: "verified" };
  } catch (error) {
    await ports.markUncertain(reservation).catch(() => undefined);
    throw error;
  }
}
