import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persist: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => '/historias/nueva',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/core/supabase/client', () => ({
  createClient: () => ({ from: mocks.from }),
}));
vi.mock('@/core/notifications/toast', () => ({
  toast: { error: vi.fn() },
}));
vi.mock('@/lib/actions/appointments', () => ({
  startConsultationFromAppointment: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/features/historias/utils/persist-clinical-record-request', () => ({
  persistClinicalRecordRequest: mocks.persist,
}));

import { useNuevaConsultaForm } from '@/features/historias/hooks/use-nueva-consulta-form';

import { consultationDraftKey, readConsultationDraft } from '@/lib/utils/consultation-draft';

const key = consultationDraftKey({ patientId: 'test-patient-a' });
const date = '2026-10-01T14:58';
const workspace = {
  patientId: 'test-patient-a',
  professionalId: 'test-professional',
  onSaved: vi.fn(),
  onClose: vi.fn(),
};
const options = { patients: [], professionals: [], templates: [], workspace };
const content = {
  evolution: 'PRUEBA SINTETICA. Sin valor asistencial.',
  chiefComplaint: '', diagnosis: '', diagnoses: [], indications: '',
  clinicalTreatments: [], treatmentMedications: [], vitals: '', consultationAt: date,
};

function storeDraft(extra: Record<string, unknown> = {}) {
  sessionStorage.setItem(key, JSON.stringify({
    v: 1, ...content, recordId: 'test-record',
    savedFingerprint: JSON.stringify(content), updatedAt: '2026-10-01T17:58:00Z',
    ...extra,
  }));
}

function attachForm(state: ReturnType<typeof useNuevaConsultaForm>) {
  const form = document.createElement('form');
  for (const [name, value] of Object.entries({
    patient_id: workspace.patientId, professional_id: workspace.professionalId,
  })) {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.append(input);
  }
  state.formRef.current = form;
}

async function mount() {
  const hook = renderHook(() => {
    const state = useNuevaConsultaForm(options);
    attachForm(state);
    return state;
  });
  await act(async () => {});
  attachForm(hook.result.current);
  return hook;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.persist.mockResolvedValue({ data: { id: 'test-record' } });
  mocks.maybeSingle.mockResolvedValue({ data: { created_at: new Date(date).toISOString() }, error: null });
  const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('consultation draft date regression', () => {
  it('restores a saved date without autosaving on reload or unmount', async () => {
    storeDraft();
    const hook = await mount();
    expect(hook.result.current.consultationAt).toBe(date);
    expect(hook.result.current.isDirty).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    hook.unmount();
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(readConsultationDraft(key)).toMatchObject({ consultationAt: date, recordId: 'test-record' });
  });

  it('recovers a legacy saved date under patient-scoped RLS without writes', async () => {
    storeDraft({ consultationAt: undefined, savedFingerprint: undefined });
    const hook = await mount();
    expect(mocks.from).toHaveBeenCalledWith('clinical_records');
    expect(mocks.select).toHaveBeenCalledWith('created_at');
    expect(mocks.eq).toHaveBeenCalledWith('id', 'test-record');
    expect(mocks.eq).toHaveBeenCalledWith('patient_id', workspace.patientId);
    expect(hook.result.current.consultationAt).toBe(date);
    expect(hook.result.current.isDirty).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    hook.unmount();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('preserves the legacy draft while its date lookup is pending or denied', async () => {
    storeDraft({ consultationAt: undefined, savedFingerprint: undefined });
    const original = sessionStorage.getItem(key);
    let resolve!: (value: unknown) => void;
    mocks.maybeSingle.mockReturnValue(new Promise((done) => { resolve = done; }));
    const hook = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(sessionStorage.getItem(key)).toBe(original);
    expect(mocks.persist).not.toHaveBeenCalled();
    await act(async () => { resolve({ data: null, error: null }); });
    expect(hook.result.current.error).toBeTruthy();
    hook.unmount();
    expect(sessionStorage.getItem(key)).toBe(original);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('saves deliberate date edits and keeps the new date clean on the next reload', async () => {
    storeDraft();
    const hook = await mount();
    const newDate = '2026-10-01T15:30';
    act(() => hook.result.current.setConsultationAt(newDate));
    expect(mocks.persist).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(mocks.persist).toHaveBeenCalledTimes(1);
    expect(mocks.persist.mock.calls[0][0].consultation_at).toBe(new Date(newDate).toISOString());
    expect(readConsultationDraft(key)).toMatchObject({ consultationAt: newDate });
    hook.unmount();
    const restored = await mount();
    expect(restored.result.current.consultationAt).toBe(newDate);
    expect(restored.result.current.isDirty).toBe(false);
    restored.unmount();
    expect(mocks.persist).toHaveBeenCalledTimes(1);
  });

  it('retains unsaved content changes with the saved date until autosave', async () => {
    storeDraft({ evolution: 'PRUEBA SINTETICA. Cambio pendiente.' });
    const hook = await mount();
    expect(hook.result.current.consultationAt).toBe(date);
    expect(hook.result.current.isDirty).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(mocks.persist).toHaveBeenCalledTimes(1);
    expect(mocks.persist.mock.calls[0][0]).toMatchObject({
      evolution: 'PRUEBA SINTETICA. Cambio pendiente.', consultation_at: new Date(date).toISOString(),
    });
  });

  it('still restores plain-text drafts and stores a date when creating a record', async () => {
    sessionStorage.setItem(key, 'PRUEBA SINTETICA. Borrador nuevo.');
    const hook = await mount();
    expect(hook.result.current.evolution).toBe('PRUEBA SINTETICA. Borrador nuevo.');
    expect(hook.result.current.isDirty).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(mocks.persist).toHaveBeenCalledTimes(1);
    expect(readConsultationDraft(key)).toMatchObject({
      recordId: 'test-record', consultationAt: hook.result.current.consultationAt,
    });
  });

  it('does not treat a loaded clean record as dirty when leaving', async () => {
    const hook = await mount();
    act(() => hook.result.current.loadConsultationForEdit({
      id: 'test-record', created_at: new Date(date).toISOString(), evolution: content.evolution,
    }));
    expect(hook.result.current.isDirty).toBe(false);
    hook.unmount();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('restores structured fields without phantom changes', async () => {
    const fields = { ...content, diagnoses: [{ name: 'PRUEBA SINTETICA' }],
      clinicalTreatments: [{ product: 'PRUEBA SINTETICA' }] };
    storeDraft({ ...fields, savedFingerprint: JSON.stringify(fields) });
    const hook = await mount();
    expect(hook.result.current.diagnoses).toEqual(fields.diagnoses);
    expect(hook.result.current.clinicalTreatments).toEqual(fields.clinicalTreatments);
    expect(hook.result.current.isDirty).toBe(false);
    hook.unmount();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('ignores late legacy lookups after loading another record', async () => {
    storeDraft({ consultationAt: undefined, savedFingerprint: undefined });
    let resolve!: (value: unknown) => void;
    mocks.maybeSingle.mockReturnValue(new Promise((done) => { resolve = done; }));
    const hook = await mount();
    const nextDate = '2026-09-30T08:30';
    act(() => hook.result.current.loadConsultationForEdit({
      id: 'another-test-record', created_at: new Date(nextDate).toISOString(),
      evolution: 'OTRA PRUEBA SINTETICA',
    }));
    await act(async () => {
      resolve({ data: { created_at: new Date(date).toISOString() }, error: null });
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(hook.result.current.consultationAt).toBe(nextDate);
    expect(hook.result.current.editingRecordId).toBe('another-test-record');
    expect(hook.result.current.evolution).toBe('OTRA PRUEBA SINTETICA');
    expect(hook.result.current.isDirty).toBe(false);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('flushes unsaved changes on exit with the latest chosen date', async () => {
    storeDraft();
    const hook = await mount();
    const nextDate = '2026-10-01T16:00';
    act(() => hook.result.current.setConsultationAt(nextDate));
    hook.unmount();
    expect(mocks.persist).toHaveBeenCalledTimes(1);
    expect(mocks.persist.mock.calls[0]).toEqual([
      expect.objectContaining({ consultation_at: new Date(nextDate).toISOString() }),
      { keepalive: true },
    ]);
  });
});
