import { describe, expect, it, vi } from "vitest";
import { enqueueClinicJob } from "@/lib/jobs/enqueue";

describe("enqueueClinicJob", () => {
  it("inserts pending job with defaults", async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "job-1" }, error: null }),
      }),
    });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert }),
    };

    const result = await enqueueClinicJob(supabase as never, {
      clinicId: "clinic-1",
      jobType: "send_reminder",
      payload: { reminderId: "r1" },
    });

    expect(result.id).toBe("job-1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: "clinic-1",
        job_type: "send_reminder",
        status: "pending",
      })
    );
  });

  it("throws when insert fails", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "RLS" } }),
          }),
        }),
      }),
    };

    await expect(
      enqueueClinicJob(supabase as never, {
        clinicId: "c",
        jobType: "send_email",
        payload: {},
      })
    ).rejects.toThrow(/RLS|encolar/);
  });
});
