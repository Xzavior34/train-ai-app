import React, { useState, useEffect } from "react";
import { Link2, Share2, Check, Copy, Mail, QrCode, Users, X } from "lucide-react";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { activeProject, SUPABASE_PROJECTS } from "../../lib/supabaseClient.js";
import { getOrganizationJoinUrl, fetchOrganizationPublicInfo } from "../../lib/api/organizations.js";

export function OrganizationReferralCard({ orgId, orgName, orgSlug, showToast, members = [], referralFilter = "all", onToggleReferralFilter }) {
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [resolvedOrg, setResolvedOrg] = useState(null);

  useEffect(() => {
    let active = true;
    const isSaraProject = activeProject === SUPABASE_PROJECTS.SARA_FOUNDATION;
    const initialTarget = orgSlug || orgId || orgName || (isSaraProject ? "sara-foundation" : "");
    if (initialTarget) {
      fetchOrganizationPublicInfo(initialTarget)
        .then((info) => {
          if (active && info) setResolvedOrg(info);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [orgId, orgName, orgSlug]);

  const isSaraWorkspace =
    activeProject === SUPABASE_PROJECTS.SARA_FOUNDATION ||
    String(orgName || resolvedOrg?.name || "").toLowerCase().includes("sara");
  const effectiveTarget = isSaraWorkspace
    ? "sara-foundation"
    : resolvedOrg?.slug || orgSlug || orgId || "sara-foundation";
  const displayOrgName = isSaraWorkspace
    ? "Sara Foundation Africa"
    : resolvedOrg?.name || orgName || "your organization";

  const joinUrl = getOrganizationJoinUrl(effectiveTarget);
  const msgTemplate = `Hi everyone! Click this special link to join ${displayOrgName} on Train AI as a learner (includes 20 free AI credits): ${joinUrl}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      if (showToast) showToast("Organization join link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this organization join link:", joinUrl);
    }
  }

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(msgTemplate);
      setCopiedMsg(true);
      if (showToast) showToast("Invite message template copied!");
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      window.prompt("Copy this invite message:", msgTemplate);
    }
  }

  return (
    <div
      style={{
        padding: "16px 20px",
        background: "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(59,130,246,0.02) 100%)",
        border: "1.5px solid rgba(37,99,235,0.22)",
        borderRadius: 12,
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="ta-decoration-icon" style={{
            width: 36, height: 36, borderRadius: 8,
            background: "#EFF6FF", color: "#2563EB",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}>
            <Share2 size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text)" }}>
                Organization Shareable Invite &amp; Referral Link
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#2563EB",
                background: "#EFF6FF", padding: "2px 7px", borderRadius: 4,
                textTransform: "uppercase", letterSpacing: ".04em"
              }}>
                Automated Join
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.4 }}>
              Share this single link with your team, cohort, or students. Anyone who signs up or logs in automatically joins your organization workspace without adding emails one by one.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{
          flex: "1 1 280px",
          display: "flex",
          alignItems: "center",
          background: "var(--bg-card, #FFFFFF)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 12px",
          minWidth: 0
        }}>
          <Link2 size={14} color="#64748B" style={{ flexShrink: 0, marginRight: 8 }} />
          <span style={{
            fontSize: 12.5,
            fontFamily: "monospace",
            color: "#2563EB",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1
          }}>
            {joinUrl}
          </span>
        </div>

        <button
          type="button"
          className="ta-btn ta-btn-primary ta-btn-sm"
          onClick={handleCopyLink}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
        >
          {copied ? <Check size={14} color="#FFFFFF" /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy Link"}
        </button>

        <button
          type="button"
          className="ta-btn ta-btn-outline ta-btn-sm"
          onClick={handleCopyMessage}
          title="Copy ready-made WhatsApp or Slack invite message"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {copiedMsg ? <Check size={14} color="#16A34A" /> : <Mail size={14} />}
          {copiedMsg ? "Message Copied!" : "Copy Message"}
        </button>

        <button
          type="button"
          className="ta-btn ta-btn-outline ta-btn-sm"
          onClick={() => setShowQr(true)}
          title="Display QR code for in-person workshops"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <QrCode size={14} /> QR Code
        </button>

        {typeof onToggleReferralFilter === "function" && (() => {
          const linkMembers = members.filter((m) => (m.join_source || "shareable_link") === "shareable_link");
          const clicksCount = linkMembers.filter((m) => m.status === "link_clicked").length;
          const registeredCount = linkMembers.filter((m) => m.status !== "link_clicked").length;
          return (
            <button
              type="button"
              className={referralFilter === "shareable_link" ? "ta-btn ta-btn-primary ta-btn-sm" : "ta-btn ta-btn-outline ta-btn-sm"}
              onClick={() => onToggleReferralFilter(referralFilter === "shareable_link" ? "all" : "shareable_link")}
              title="Filter user directory to show all members and prospective learners from this link"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <Users size={14} />
              {referralFilter === "shareable_link"
                ? `Showing Link Users (${linkMembers.length} • ${registeredCount} joined, ${clicksCount} link clicks)`
                : `Track Link Traffic (${linkMembers.length} • ${registeredCount} joined, ${clicksCount} link clicks)`}
            </button>
          );
        })()}
      </div>

      {showQr && (
        <PortalModal isOpen={showQr} onClose={() => setShowQr(false)} maxWidth={360} zIndex={10000}>
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Organization QR Code</div>
              <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => setShowQr(false)}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 16 }}>
              Scan with any mobile camera to sign up and join your organization workspace automatically.
            </p>
            <div style={{
              display: "inline-block",
              padding: 16,
              background: "#FFFFFF",
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid #E2E8F0"
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`}
                alt="Organization Invite QR Code"
                style={{ width: 220, height: 220, display: "block" }}
              />
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                type="button"
                className="ta-btn ta-btn-primary ta-btn-sm"
                onClick={handleCopyLink}
              >
                <Copy size={13} /> {copied ? "Link Copied!" : "Copy Link"}
              </button>
              <button
                type="button"
                className="ta-btn ta-btn-outline ta-btn-sm"
                onClick={() => setShowQr(false)}
              >
                Close
              </button>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
}
