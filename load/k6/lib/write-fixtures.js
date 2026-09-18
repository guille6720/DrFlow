/**
 * Load Phase 7B fixtures + session pool for write scenarios.
 * Pool file must NOT be committed (contains cookies).
 *
 * IMPORTANT: k6 `open()` is only allowed at init time — call loadWritePoolInit()
 * at module scope, then use getWritePool() in VU/setup code.
 */
let _pool = null;

export function loadWritePoolInit() {
  const poolPath = __ENV.K6_SESSION_POOL_FILE || "e2e/.phase7b-session-pool.json";
  let raw;
  try {
    raw = open(poolPath);
  } catch (e) {
    const cookie = __ENV.K6_SESSION_COOKIE || "";
    if (!cookie) {
      throw new Error(
        `Missing session pool (${poolPath}) and K6_SESSION_COOKIE — mint via phase7b-mint-session-pool.mjs (${String(e)})`
      );
    }
    _pool = {
      sessions: [
        {
          clinic_id: __ENV.K6_CLINIC_ID || "",
          cookie,
          records: [],
          record_ids: (__ENV.K6_RECORD_IDS || "").split(",").filter(Boolean),
          patient_ids: (__ENV.K6_PATIENT_IDS || "").split(",").filter(Boolean),
          professional_ids: (__ENV.K6_PROFESSIONAL_IDS || "").split(",").filter(Boolean),
          appointment_ids: (__ENV.K6_APPOINTMENT_IDS || "").split(",").filter(Boolean),
        },
      ],
    };
    return _pool;
  }
  _pool = JSON.parse(raw);
  return _pool;
}

export function getWritePool() {
  if (!_pool) {
    throw new Error("Write pool not initialized — call loadWritePoolInit() at module scope");
  }
  return _pool;
}

/** @deprecated use getWritePool after loadWritePoolInit */
export function loadWritePool() {
  return getWritePool();
}

export function pickSession(pool, vu) {
  const sessions = pool.sessions || [];
  if (!sessions.length) throw new Error("Session pool empty");
  return sessions[(vu - 1) % sessions.length];
}

export function pickRecord(session, vu, iter) {
  const records = session.records || [];
  if (records.length) {
    const idx = (vu * 31 + iter * 17) % records.length;
    return records[idx];
  }
  const ids = session.record_ids || [];
  if (!ids.length) throw new Error(`No records for clinic ${session.clinic_id}`);
  const idx = (vu * 31 + iter * 17) % ids.length;
  return {
    id: ids[idx],
    patient_id: (session.patient_ids || [])[idx] || (session.patient_ids || [])[0],
    professional_id: (session.professional_ids || [])[0],
  };
}
