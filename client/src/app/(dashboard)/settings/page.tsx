import { requireSession } from "@/lib/session";
import { getSettings, listAuditLogs } from "@omnipost/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { context } = await requireSession();
  const settings = await getSettings(context.organizationId);
  const audit = await listAuditLogs(context.organizationId, { pageSize: 15 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="muted text-sm mt-1">Organization defaults and account.</p>
      </div>

      <section className="card">
        <h2 className="font-semibold mb-3">Profile</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm max-w-md">
          <dt className="muted">Email</dt>
          <dd>{context.user.email}</dd>
          <dt className="muted">Name</dt>
          <dd>{context.user.name ?? "—"}</dd>
          <dt className="muted">Role</dt>
          <dd>
            <span className="badge badge-ok">{context.user.role}</span>
          </dd>
        </dl>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Organization</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm max-w-md">
          <dt className="muted">Timezone</dt>
          <dd>{settings.timezone}</dd>
          <dt className="muted">Auto-reply master switch</dt>
          <dd>{settings.autoReplyMaster ? "On" : "Off (default; Phase 10)"}</dd>
        </dl>
        <p className="muted text-xs mt-2">
          Editing UI lands with campaign management (Phase 3); the REST endpoint is live now.
        </p>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Recent activity (audit log)</h2>
        {audit.data.length === 0 ? (
          <p className="muted text-sm">No activity recorded yet.</p>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead className="muted text-left">
                <tr>
                  <th className="py-1 pr-4 font-medium">When</th>
                  <th className="py-1 pr-4 font-medium">Actor</th>
                  <th className="py-1 pr-4 font-medium">Action</th>
                  <th className="py-1 font-medium">Resource</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((log: any) => (
                  <tr key={log.id} className="border-t border-[var(--border)]">
                    <td className="py-1.5 pr-4 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-4">{log.actorType}</td>
                    <td className="py-1.5 pr-4">{log.action}</td>
                    <td className="py-1.5">
                      {log.resourceType}/{log.resourceId.slice(0, 10)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
