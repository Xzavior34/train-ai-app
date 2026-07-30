import React, { useState, useEffect } from "react";
import { X, Gift, Link2, Copy, Check, Users, MousePointerClick, TrendingUp } from "lucide-react";
import { fetchMyReferralCode, fetchMyReferralStats } from "../../lib/api/referrals.js";

/**
 * "Refer a friend" panel — opened from a settings row on ProfileScreen.jsx,
 * matching the bottom-sheet modal pattern used by AccessibilityPanel.jsx.
 * Shows this learner's real referral_links code/URL (get-or-create on open)
 * plus stats from referral_links + the get_my_referral_signups() RPC.
 */
export default function ReferralPanel({ userId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState(null);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([fetchMyReferralCode(userId), fetchMyReferralStats(userId)])
      .then(([codeResult, statsResult]) => {
        if (cancelled) return;
        setLink(codeResult);
        setStats(statsResult);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  function handleCopy() {
    if (!link?.url) return;
    navigator.clipboard.writeText(link.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // clipboard API can be blocked (permissions/private browsing) — the
      // link text is still visible for the learner to copy by hand.
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Refer a friend"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000, background: "rgba(16,20,42,.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440, background: "#FFFFFF", borderRadius: 20,
          boxShadow: "0 20px 60px -15px rgba(16,20,42,.4)", padding: 20,
          maxHeight: "85vh", overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Gift size={18} color="#2563EB" />
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "#10142A" }}>Refer a friend</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 10, border: "1px solid #E6E9F5", background: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#656C86"
            }}
          >
            <X size={15} />
          </button>
        </div>
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12.5, color: "#656C86", lineHeight: 1.45 }}>
          Share your link — when a friend signs up with it, it shows up here.
        </p>

        {loading ? (
          <div style={{ padding: "28px 0", textAlign: "center", fontSize: 12.5, color: "#9AA1B9" }}>Loading your referral link…</div>
        ) : !link ? (
          <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12.5, color: "#9AA1B9" }}>
            Couldn't load your referral link right now. Please try again later.
          </div>
        ) : (
          <>
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "#656C86", textTransform: "uppercase", letterSpacing: ".06em" }}>
              <Link2 size={13} /> Your referral link
            </div>
            <div style={{
              marginTop: 8, display: "flex", alignItems: "center", gap: 8, background: "#F4F6FC",
              border: "1.5px solid #E6E9F5", borderRadius: 13, padding: "10px 12px"
            }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#10142A", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {link.url}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  flexShrink: 0, border: "none", cursor: "pointer", borderRadius: 10, padding: "7px 12px",
                  fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5,
                  color: "#fff", background: copied ? "#17A673" : "#2563EB"
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 18 }}>
              <StatCard icon={<MousePointerClick size={15} color="#2563EB" />} value={stats?.totalClicks ?? 0} label="Clicks" />
              <StatCard icon={<Users size={15} color="#17A673" />} value={stats?.completedSignups ?? 0} label="Sign-ups" />
              <StatCard icon={<TrendingUp size={15} color="#F5A524" />} value={`${stats?.conversionRate ?? 0}%`} label="Conversion" />
            </div>

            {stats?.recentSignups?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#656C86", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                  Recent sign-ups
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {stats.recentSignups.slice(0, 5).map((s, idx) => (
                    <div
                      key={`${s.referral_link_id ?? "none"}-${idx}`}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#F4F6FC", borderRadius: 11 }}
                    >
                      <span style={{ fontSize: 12, color: "#10142A", fontWeight: 600 }}>
                        {s.signed_up_at ? new Date(s.signed_up_at).toLocaleDateString() : "Recently"}
                      </span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
                        color: s.signup_completed ? "#17A673" : "#B45309",
                        background: s.signup_completed ? "rgba(23,166,115,.12)" : "rgba(180,83,9,.12)"
                      }}>
                        {s.signup_completed ? "Completed" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 22, width: "100%", border: "none", cursor: "pointer", borderRadius: 14, fontWeight: 700,
            fontSize: 14, padding: "13px 18px", color: "#fff",
            background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%)"
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <div style={{ background: "#F4F6FC", borderRadius: 13, padding: "12px 8px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 15, color: "#10142A" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#656C86", marginTop: 2 }}>{label}</div>
    </div>
  );
}
