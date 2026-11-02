import { describe, expect, it, vi } from "vitest";

import { type StorageOperation, type StorageReservation, uploadVerifiedStorage, type VerifiedStoragePorts } from "../src/core/entitlements/verified-storage";

function fixture(state: StorageReservation["state"] = "reserved") {
  let stored = new Uint8Array([1, 2, 3]);
  const ports: VerifiedStoragePorts = {
    authorize: vi.fn(async () => undefined),
    reserve: vi.fn(async (operation: StorageOperation) => ({ id: "reservation", operation, state })),
    upload: vi.fn(async (_operation, bytes) => { stored = Uint8Array.from(bytes); }),
    download: vi.fn(async () => stored),
    complete: vi.fn(async () => undefined),
    markUncertain: vi.fn(async () => undefined),
  };
  return { ports, input: { clinicId: "clinic", key: "request", path: "clinic/files/test", contentType: "application/pdf" }, bytes: new Uint8Array([1, 2, 3]) };
}

describe("verified storage protocol", () => {
  it("authorizes before reserving and completes only after download", async () => {
    const { ports, input, bytes } = fixture();
    expect((await uploadVerifiedStorage(ports, input, bytes)).state).toBe("verified");
    expect(ports.authorize).toHaveBeenCalledBefore(ports.reserve);
    expect(ports.download).toHaveBeenCalledBefore(ports.complete);
  });

  it("recovers a lost upload response by verifying the stored bytes", async () => {
    const { ports, input, bytes } = fixture();
    ports.upload = vi.fn(async () => { throw new Error("timeout"); });
    await uploadVerifiedStorage(ports, input, bytes);
    expect(ports.complete).toHaveBeenCalledOnce();
  });

  it("retains an uncertain reservation when storage cannot be inspected", async () => {
    const { ports, input, bytes } = fixture();
    ports.download = vi.fn(async () => { throw new Error("offline"); });
    await expect(uploadVerifiedStorage(ports, input, bytes)).rejects.toThrow("offline");
    expect(ports.markUncertain).toHaveBeenCalledOnce();
    expect(ports.complete).not.toHaveBeenCalled();
  });

  it("rejects corruption even when size matches", async () => {
    const { ports, input, bytes } = fixture();
    ports.download = vi.fn(async () => new Uint8Array([3, 2, 1]));
    await expect(uploadVerifiedStorage(ports, input, bytes)).rejects.toThrow("STORAGE_INTEGRITY_MISMATCH");
    expect(ports.complete).not.toHaveBeenCalled();
  });

  it("reconciles uncertainty without overwriting the object", async () => {
    const { ports, input, bytes } = fixture("uncertain");
    await uploadVerifiedStorage(ports, input, bytes);
    expect(ports.upload).not.toHaveBeenCalled();
  });

  it("rejects an idempotency conflict", async () => {
    const { ports, input, bytes } = fixture();
    ports.reserve = vi.fn(async (operation) => ({ id: "reservation", operation: { ...operation, sha256: "different" }, state: "reserved" }));
    await expect(uploadVerifiedStorage(ports, input, bytes)).rejects.toThrow("STORAGE_IDEMPOTENCY_CONFLICT");
    expect(ports.upload).not.toHaveBeenCalled();
  });

  it("checks authorization even for a completed retry", async () => {
    const { ports, input, bytes } = fixture("verified");
    ports.authorize = vi.fn(async () => { throw new Error("denied"); });
    await expect(uploadVerifiedStorage(ports, input, bytes)).rejects.toThrow("denied");
    expect(ports.reserve).not.toHaveBeenCalled();
  });

  it.each(["other/file", "clinic/../file", "clinic/%2e%2e/file", "clinic/a\\b"])("rejects unsafe path %s", async (path) => {
    const { ports, input, bytes } = fixture();
    await expect(uploadVerifiedStorage(ports, { ...input, path }, bytes)).rejects.toThrow("INVALID_STORAGE_OPERATION");
    expect(ports.reserve).not.toHaveBeenCalled();
  });
});
