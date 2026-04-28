import { BacklogGate } from "@/components/admin/BacklogGate";
import AdminReceivables from "./AdminReceivables";

/**
 * Hidden Backlog area. Reachable via:
 *  - Keyboard shortcut Ctrl/Cmd + Shift + B (anywhere)
 *  - Direct URL /admin/backlog (or legacy /admin/receivables)
 * Always gated by a secondary admin PIN.
 */
export default function AdminBacklog() {
  return (
    <BacklogGate>
      <AdminReceivables />
    </BacklogGate>
  );
}
