/**
 * Weighted application journeys + think times (Phase 7).
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { classify, errorRate, opDuration } from "./metrics.js";
import { baseUrl, requireSessionOrAbort } from "./auth.js";

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function thinkNav() {
  sleep(rand(0.5, 2));
}
export function thinkRead() {
  sleep(rand(1, 4));
}
export function thinkClinical() {
  sleep(rand(2, 8));
}

function taggedGet(path, name, headers) {
  const started = Date.now();
  const res = http.get(`${baseUrl()}${path}`, {
    headers,
    tags: { operation: name },
    timeout: "30s",
  });
  opDuration.add(Date.now() - started, { operation: name });
  classify(res);
  const ok = check(res, {
    [`${name} expected 2xx/3xx`]: (r) => r.status >= 200 && r.status < 400,
  });
  if (!ok) errorRate.add(1);
  return res;
}

/**
 * Traffic mix (documented):
 * 35% dashboard/nav
 * 20% patient search/list
 * 15% patient workspace
 * 10% clinical history
 * 10% appointments / waiting room
 * 5% consultation reads
 * 5% health (safe synthetic probe — not a write)
 *
 * Writes are intentionally omitted from default mix until dedicated
 * synthetic write fixtures + CSRF tokens are provided via env.
 */
const JOURNEYS = [
  { weight: 35, name: "dashboard", run: (h) => taggedGet("/dashboard", "dashboard", h) },
  { weight: 12, name: "patient_list", run: (h) => taggedGet("/pacientes", "patient_list", h) },
  {
    weight: 8,
    name: "patient_search",
    run: (h) => taggedGet("/api/patients/search?q=Phase", "patient_search", h),
  },
  {
    weight: 15,
    name: "patient_workspace",
    run: (h) => {
      // Synthetic patient path uses list first; deep links require env IDs.
      const id = __ENV.K6_PATIENT_ID || "";
      if (id) return taggedGet(`/pacientes/${id}`, "patient_workspace", h);
      return taggedGet("/pacientes", "patient_list", h);
    },
  },
  {
    weight: 10,
    name: "clinical_history",
    run: (h) => taggedGet("/pacientes?seccion=historias", "clinical_history", h),
  },
  {
    weight: 6,
    name: "appointments",
    run: (h) => taggedGet("/turnos/agenda", "appointments", h),
  },
  {
    weight: 4,
    name: "waiting_room",
    run: (h) => taggedGet("/sala-espera", "waiting_room", h),
  },
  {
    weight: 5,
    name: "consultation_read",
    run: (h) => taggedGet("/consultas", "consultation_read", h),
  },
  { weight: 5, name: "health", run: (h) => taggedGet("/api/health/ready", "health", h) },
];

function pickJourney() {
  const total = JOURNEYS.reduce((s, j) => s + j.weight, 0);
  let r = Math.random() * total;
  for (const j of JOURNEYS) {
    r -= j.weight;
    if (r <= 0) return j;
  }
  return JOURNEYS[0];
}

export function runAppIteration() {
  const headers = requireSessionOrAbort();
  const journey = pickJourney();
  journey.run(headers);
  if (journey.name === "dashboard" || journey.name === "health") thinkNav();
  else if (journey.name.includes("patient") || journey.name === "clinical_history") thinkRead();
  else thinkClinical();
}

export { taggedGet };
