import { describe, it, expect } from "vitest";
import { JOB_STATUSES, isJobFinished } from "@/pages/admin/AdminWorkerDetail";

// Root-cause regression test for the broken warehouse auto-handoff.
//
// WorkerPortal.tsx's submitUpdate() decides whether to flip a job's
// warehouse_status to "in_warehouse" with:
//
//   const isFinished = isJobFinished(nextStatus);
//   ... isFinished ? { status: nextStatus, warehouse_status: "in_warehouse" }
//                  : { status: nextStatus }
//
// Before the fix, isFinished checked for "completed"/"done" — values
// JOB_STATUSES never produces, since the worker's own status picker only
// ever offers assigned/started/in_progress/ready/delivered. That meant the
// handoff could never fire through the real UI. This test exercises the
// exact same decision (via the real isJobFinished import, not a
// reimplementation) across every status a worker can actually pick, and
// mirrors the patch shape submitUpdate() builds from it.

// Mirrors the patch-building ternary in WorkerPortal.tsx's submitUpdate().
const buildStatusPatch = (nextStatus: string) =>
  isJobFinished(nextStatus)
    ? { status: nextStatus, warehouse_status: "in_warehouse" }
    : { status: nextStatus };

describe("job_work_orders status -> warehouse handoff", () => {
  it("does NOT fire for any in-progress status a worker can pick", () => {
    for (const s of ["assigned", "started", "in_progress"]) {
      expect(isJobFinished(s)).toBe(false);
      expect(buildStatusPatch(s)).toEqual({ status: s });
    }
  });

  it("fires for every real 'finished' status a worker can pick", () => {
    for (const s of ["ready", "delivered"]) {
      expect(isJobFinished(s)).toBe(true);
      expect(buildStatusPatch(s)).toEqual({ status: s, warehouse_status: "in_warehouse" });
    }
  });

  it("every JOB_STATUSES option round-trips through the real status picker's values", () => {
    // Guards against JOB_STATUSES and this test's expectations drifting
    // apart if the canonical list is ever edited.
    expect(JOB_STATUSES.map((j) => j.value)).toEqual([
      "assigned", "started", "in_progress", "ready", "delivered",
    ]);
  });

  it("REGRESSION: the old dead values never trigger the handoff either way", () => {
    // "completed"/"done" are not reachable via the worker's own status
    // picker (JOB_STATUSES doesn't offer them) — this documents that even
    // if one leaked in from elsewhere (e.g. old data), it would NOT
    // silently trigger a handoff we didn't intend.
    expect(isJobFinished("completed")).toBe(false);
    expect(isJobFinished("done")).toBe(false);
  });
});
