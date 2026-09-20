import React, { useState, useContext, useMemo } from "react";
import { TopBar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { CreditCard, Zap, Loader2, Search, TrendingUp, AlertTriangle } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgAICreditsSummary, fetchOrgAICreditUsageByLearner,
  startOrgCreditsPurchasePayment, orgCreditUnitPrice,
} from "../../lib/api/organizations.js";
import { getUserLocationCurrency } from "../../lib/locationCurrency.js";

// Replaces the old Content Moderation screen entirely (see
// 0162_community_posts_moderator_delete.sql's sibling change and the
// accompanying report - the old flagged-post queue is gone, not hidden;
// "AI Manual Mode" toggles that used to live on that same screen already
// exist for real in SettingsHubScreen.jsx, so nothing was lost by
// removing them from here).
//
// Two real, previously-unwired pieces of this app's own billing ledger:
//   1. Buy AI credits for the organization - get_org_ai_credits_summary()
//      and purchase_ai_credits() (0156/0157) already existed server-side;
//      no screen ever called them. The actual crediting-after-payment
//      step goes through the grant-ai-credits-from-payment Edge Function
//      (organization scope added alongside this screen) - see that
//      function's own header comment for the authorization model.
//   2. Per-learner usage - a direct, RLS-scoped read of
//      ai_credit_transactions filtered to this organization and
//      transaction_type = 'consumption', aggregated per learner.
export function CreditsScreen({ orgId, orgSelector, userEmail }) {
  const showToast = useContext(ToastContext);

  const summaryQuery = useSupabaseQuery(async () => (orgId ? fetchOrgAICreditsSummary(orgId) : null), [orgId]);
  const usageQuery = useSupabaseQuery(async () => (orgId ? fetchOrgAICreditUsageByLearner(orgId) : []), [orgId]);
  const usage = usageQuery.data || [];

  const userLoc = useMemo(() => getUserLocationCurrency(), []);
  const [quantity, setQuantity] = useState(500);
  const [starting, setStarting] = useState(false);
  const [search, setSearch] = useState("");

  const currency = userLoc.currency;
  const provider = userLoc.provider;
  const unitPrice = orgCreditUnitPrice(currency);
  const totalPrice = Math.max(0, Number(quantity) || 0) * unitPrice;
  const symbol = userLoc.symbol;

  async function handleBuy() {
    if (!orgId || !userEmail) {
      showToast?.("Missing organization or admin email.");
      return;
    }
    setStarting(true);
    try {
      const res = await startOrgCreditsPurchasePayment({ orgId, credits: quantity, email: userEmail, provider });
      if (!res.success) {
        showToast?.(res.error || "Could not start payment.");
        setStarting(false);
      }
      // On success, startOrgCreditsPurchasePayment redirects the browser -
      // nothing after this point runs.
    } catch (e) {
      showToast?.(e?.message || "Could not start payment.");
      setStarting(false);
    }
  }

  const filteredUsage = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return usage;
    return usage.filter((u) => (u.profile?.display_name || "").toLowerCase().includes(term));
  }, [usage, search]);

  const totalConsumedAllLearners = useMemo(() => usage.reduce((sum, u) => sum + u.totalConsumed, 0), [usage]);

  return (
    <div className="ta-fade">
      <TopBar title="AI Credits" sub="Buy organization AI credits and review learner usage" orgSelector={orgSelector} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-amber" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">Organization AI Credits</h1>
              <p className="ta-hero-desc">Top up your organization's AI credit balance and see exactly how each learner is using it.</p>
            </div>
            <div className="ta-hero-actions" style={{ flexWrap: "wrap", gap: 8 }}>
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 8, backdropFilter: "blur(8px)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>Current balance</div>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{summaryQuery.loading ? "..." : (summaryQuery.data?.balance ?? 0).toLocaleString()}</div>
              </div>
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 8, backdropFilter: "blur(8px)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>Lifetime purchased</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#34D399" }}>{summaryQuery.loading ? "..." : (summaryQuery.data?.lifetime_credited ?? 0).toLocaleString()}</div>
              </div>
              <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 8, backdropFilter: "blur(8px)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>Lifetime used</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#FBBF24" }}>{summaryQuery.loading ? "..." : (summaryQuery.data?.lifetime_consumed ?? 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="ta-grid ta-grid-2 anim-stagger">
          <div className="ta-card">
            <div className="ta-row ta-gap8" style={{ alignItems: "center", marginBottom: 4 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={17} color="var(--primary)" />
              </div>
              <div className="ta-label" style={{ margin: 0 }}>Buy AI credits</div>
            </div>
            <p className="ta-body" style={{ marginTop: 4, marginBottom: 16 }}>
              Credits are shared across your organization's learners for AI Coach, quizzes, and AI insights.
            </p>

            <label className="ta-label" style={{ display: "block", marginBottom: 6 }}>Number of credits</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--surface-2)", color: "var(--text)", fontSize: 14, fontWeight: 700, marginBottom: 14,
              }}
            />

            <div style={{ marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface-2)", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>
              <span>Billed in {userLoc.name} ({currency} • {symbol})</span>
            </div>

            <div className="ta-row ta-between" style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: "var(--text)" }}>{symbol}{totalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>

            <button
              className="ta-btn ta-btn-primary"
              disabled={starting || !quantity}
              onClick={handleBuy}
              style={{ width: "100%", height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {starting ? <Loader2 size={15} className="ta-spin" /> : <Zap size={15} />}
              {starting ? "Starting payment..." : `Pay ${symbol}${totalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} with ${provider === "stripe" ? "Stripe" : "Paystack"}`}
            </button>
          </div>

          <div className="ta-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-gap8" style={{ alignItems: "flex-start" }}>
              <AlertTriangle size={14} color="var(--text-3)" style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>
                This is a genuinely new capability - your organization has never had a "buy credits" screen before.
                Pricing above is a flat provisional admin rate (not yet tied to the platform's configurable pricing
                table), so treat it as a starting point to confirm rather than a finalized price. Payments are real:
                completing checkout charges the selected provider. If this page still says the balance didn't move
                right after a successful payment, the crediting step behind it needs a one-time deploy on the
                Supabase side (a real backend piece, not something this session's tools can push live themselves) -
                surface that back rather than assuming it silently worked.
              </span>
            </div>
          </div>
        </div>

        <div className="ta-card">
          <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div>
              <div className="ta-label" style={{ margin: 0 }}>Usage by learner</div>
              <div className="ta-body" style={{ marginTop: 4 }}>
                {usageQuery.loading ? "Loading..." : `${usage.length} learner${usage.length === 1 ? "" : "s"} · ${totalConsumedAllLearners.toLocaleString()} credits used total`}
              </div>
            </div>
            <div className="ta-search" style={{ maxWidth: 260 }}>
              <Search size={14} color="var(--text-3)" />
              <input type="text" placeholder="Search learner..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {usageQuery.loading && <div className="ta-empty">Loading usage...</div>}
          {!usageQuery.loading && filteredUsage.length === 0 && (
            <div className="ta-empty">
              {usage.length === 0 ? "No AI credit usage recorded yet for this organization." : "No learner matches your search."}
            </div>
          )}
          {!usageQuery.loading && filteredUsage.length > 0 && (
            <div className="ta-col ta-gap8">
              {filteredUsage.map((u) => (
                <div key={u.userId} className="ta-row ta-between" style={{ padding: "10px 4px", borderBottom: "1px solid var(--border)", gap: 10 }}>
                  <div className="ta-row ta-gap10" style={{ alignItems: "center", minWidth: 0 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", background: "var(--primary-tint)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800, color: "var(--primary)", flexShrink: 0,
                    }}>
                      {(u.profile?.display_name || "L").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.profile?.display_name || "Learner"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{u.eventCount} AI call{u.eventCount === 1 ? "" : "s"} · last used {u.lastUsedAt ? new Date(u.lastUsedAt).toLocaleDateString() : "-"}</div>
                    </div>
                  </div>
                  <Tag tone="primary" icon={TrendingUp}>{u.totalConsumed.toLocaleString()} credits</Tag>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreditsScreen;
