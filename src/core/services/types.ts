export type ServiceResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function serviceOk<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function serviceErr<T = never>(error: string): ServiceResult<T> {
  return { ok: false, error };
}

export function fromRepo<T>(result: { ok: true; data: T } | { ok: false; error: string }): ServiceResult<T> {
  return result.ok ? serviceOk(result.data) : serviceErr(result.error);
}
