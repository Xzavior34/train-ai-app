import React, { useState, useContext } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { Plus, Building2, ExternalLink, ShieldCheck, Rocket } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchAllOrganizationsWithUserCounts, createOrganization } from "../../lib/api/platform.js";

export function OrganizationsScreen({ orgSelector, onSwitchToOrgWorkspace, onLaunchOnboarding }) {
  const showToast = useContext(ToastContext);
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [name, setName] = useState("");
  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), []);
  const orgs = orgsQuery.data || [];

  return (
    <div className="ta-fade">
      <TopBar
        title="Organizations" sub="All registered multi-tenant organizations on Train AI"
        orgSelector={orgSelector}
        right={
          <div className="ta-row ta-gap8">
            {onLaunchOnboarding && (
              <button className="ta-btn ta-btn-outline" onClick={onLaunchOnboarding}>
                <Rocket size={15} /> Set up new organization
              </button>
            )}
            <button className="ta-btn ta-btn-primary" onClick={() => setNewOrgOpen(true)}><Plus size={15} /> Create organization</button>
          </div>
        }
      />
      <div className="ta-content">
        <div className="ta-card">
          <table className="ta-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Members</th>
                <th>Created</th>
                <th>Isolation Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgsQuery.loading && <tr><td colSpan={5} className="ta-empty">Loading organizations...</td></tr>}
              {!orgsQuery.loading && orgs.length === 0 && <tr><td colSpan={5} className="ta-empty">No organizations created yet.</td></tr>}
              {orgs.map(o => (
                <tr key={o.id}>
                  <td>
                    <div className="ta-row ta-gap10">
                      <Building2 size={18} color="var(--primary)" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{o.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>ID: {o.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td>{o.user_count || 0} users</td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td><Tag tone="success"><ShieldCheck size={12} /> Isolated</Tag></td>
                  <td>
                    <button
                      className="ta-btn ta-btn-outline ta-btn-sm"
                      onClick={() => {
                        orgSelector?.onSelectOrg?.(o.id);
                        onSwitchToOrgWorkspace?.();
                        showToast(`Switched Super Admin context to ${o.name}`);
                      }}
                    >
                      <ExternalLink size={13} /> View Admin Workspace
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {newOrgOpen && (
          <div className="ta-card ta-mt16" style={{ borderColor: "var(--primary)" }}>
            <div className="ta-title">Create New Organization</div>
            <input className="ta-input ta-mt12" placeholder="Organization name..." value={name} onChange={e => setName(e.target.value)} />
            <div className="ta-row ta-gap8 ta-mt12">
              <button className="ta-btn ta-btn-primary" onClick={async () => {
                if (!name.trim()) return;
                await createOrganization({ name: name.trim() });
                setNewOrgOpen(false); setName("");
                orgsQuery.refetch();
                showToast("Organization created!");
              }}>Save organization</button>
              <button className="ta-btn ta-btn-outline" onClick={() => setNewOrgOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
