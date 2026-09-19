import React, { useState, useContext, useMemo } from "react";
import { TopBar, ToastContext, Tag, Avatar, NavigationContext } from "../components/PlatformUI.jsx";
import {
  Armchair, CreditCard, Users, Plus, Minus, RefreshCw, ShieldCheck, AlertTriangle,
  Receipt, ArrowRight, UserPlus, Info, Zap, Check, X, Clock, Search, Send, Sparkles,
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgSeatsSummary, fetchSeatPurchaseHistory, startSeatPurchasePayment, fetchSeatPrice,
} from "../../lib/api/organizations.js";
import { fetchOrganizationById, fetchOrgMembers, fetchPendingInvitations, updateUserPlatformRole } from "../../lib/api/platform.js";
import {
  fetchOrgCreditRequests, approveCreditRequest, denyCreditRequest, grantDirectCredits,
} from "../../lib/api/creditRequests.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import { DEMO_MODE } from "../../lib/demoMode.js";

const PROVIDER_META = [
  { key: "paystack", label: "Paystack", currency: "NGN", symbol: "₦", hint: "Cards & bank transfer (Nigeria)" },
  { key: "stripe", label: "Stripe", currency: "USD", symbol: "$", hint: "International cards" },
];

const QUICK_PICKS = [5, 10, 25, 50];
const CREDIT_QUICK_PICKS = [25, 50, 100, 250, 500];

function money(symbol, amount) {
  return `${symbol}${Number(amount || 0).toLocaleString()}`;
}

export function SeatsScreen({ orgId, orgSelector, setScreen, userEmail, defaultTab = "seats" }) {
  const showToast = useContext(ToastContext);
  const navigate = useContext(NavigationContext);

  const [activeTab, setActiveTab] = useState(defaultTab);

  const orgQuery = useSupabaseQuery(async () => (orgId ? fetchOrganizationById(orgId) : null), [orgId]);
  const seatsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgSeatsSummary(orgId) : null), [orgId]);
  const historyQuery = useSupabaseQuery(async () => (orgId ? fetchSeatPurchaseHistory(orgId) : []), [orgId]);
  const membersQuery = useSupabaseQuery(async () => (orgId ? fetchOrgMembers(orgId) : []), [orgId]);
  const invitesQuery = useSupabaseQuery(async () => (orgId ? fetchPendingInvitations(orgId) : []), [orgId]);
  const ngnPriceQuery = useSupabaseQuery(async () => fetchSeatPrice("NGN"), []);
  const usdPriceQuery = useSupabaseQuery(async () => fetchSeatPrice("USD"), []);

  // Credit requests query
  const creditRequestsQuery = useSupabaseQuery(async () => fetchOrgCreditRequests(orgId), [orgId]);
  const creditRequests = creditRequestsQuery.data || [];

  const pendingRequests = useMemo(() => creditRequests.filter((r) => r.status === "pending"), [creditRequests]);
  const approvedRequests = useMemo(() => creditRequests.filter((r) => r.status === "approved"), [creditRequests]);

  const org = orgQuery.data;
  const seats = seatsQuery.data || { purchased: 0, used: 0, available: 0 };
  const history = historyQuery.data || [];
  const members = membersQuery.data || [];
  const invites = invitesQuery.data || [];

  const PROVIDERS = [
    { ...PROVIDER_META[0], unit: (ngnPriceQuery.data?.unit_amount_minor || 0) / 100 },
    { ...PROVIDER_META[1], unit: (usdPriceQuery.data?.unit_amount_minor || 0) / 100 },
  ];

  const [provider, setProvider] = useState("paystack");
  const [quantity, setQuantity] = useState(5);
  const [starting, setStarting] = useState(false);

  const chosen = PROVIDERS.find((p) => p.key === provider) || PROVIDERS[0];
  const total = chosen.unit * Math.max(0, Number(quantity) || 0);

  const enforced = org?.status === "active";
  const committed = seats.used + invites.length;
  const shortfall = Math.max(0, invites.length - seats.available);

  const seatedMembers = useMemo(
    () => members.filter((m) => (m.status || "active") === "active"),
    [members]
  );

  // Credit requests state & actions
  const [creditSearch, setCreditSearch] = useState("");
  const [creditStatusFilter, setCreditStatusFilter] = useState("all");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Direct Grant Modal state
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [grantSelectedUserId, setGrantSelectedUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState(50);
  const [grantReason, setGrantReason] = useState("");
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  async function handleBuy() {
    const qty = Number(quantity);
    if (!qty || qty <= 0) { showToast("Enter how many seats you need."); return; }
    if (!userEmail) { showToast("No billing email on your account - add one in Settings first."); return; }
    setStarting(true);
    try {
      const res = await startSeatPurchasePayment({ orgId, seats: qty, email: userEmail, provider });
      if (!res.success) { showToast(res.error); setStarting(false); }
    } catch (e) {
      showToast(e?.message || "Could not start the seat purchase.");
      setStarting(false);
    }
  }

  async function handleApproveRequest(req) {
    setActionLoadingId(req.id);
    try {
      await approveCreditRequest(req.id, orgId);
      showToast(`Approved ${req.amount} credits for ${req.user?.display_name || "Learner"}`);
      creditRequestsQuery.refetch();
    } catch (err) {
      showToast(err?.message || "Could not approve request");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDenyRequest(req) {
    setActionLoadingId(req.id);
    try {
      await denyCreditRequest(req.id);
      showToast("Credit request denied");
      creditRequestsQuery.refetch();
    } catch (err) {
      showToast(err?.message || "Could not deny request");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleGrantDirectCredits() {
    if (!grantSelectedUserId) {
      showToast("Select a learner to grant credits to.");
      return;
    }
    const amt = Number(grantAmount);
    if (!amt || amt <= 0) {
      showToast("Enter a valid credit amount.");
      return;
    }

    setGrantSubmitting(true);
    try {
      await grantDirectCredits({
        userId: grantSelectedUserId,
        organizationId: orgId,
        amount: amt,
        reason: grantReason.trim() || "Admin direct grant",
      });
      showToast(`Successfully granted ${amt} AI credits!`);
      setGrantModalOpen(false);
      setGrantReason("");
      setGrantSelectedUserId("");
      creditRequestsQuery.refetch();
    } catch (err) {
      showToast(err?.message || "Could not grant credits");
    } finally {
      setGrantSubmitting(false);
    }
  }

  const filteredCreditRequests = useMemo(() => {
    return creditRequests.filter((r) => {
      const matchesStatus = creditStatusFilter === "all" || r.status === creditStatusFilter;
      const term = creditSearch.trim().toLowerCase();
      const matchesSearch =
        !term ||
        (r.user?.display_name || "").toLowerCase().includes(term) ||
        (r.reason || "").toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [creditRequests, creditStatusFilter, creditSearch]);

  const totalCreditsRequested = useMemo(() => {
    return creditRequests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [creditRequests]);

  const totalCreditsApproved = useMemo(() => {
    return approvedRequests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [approvedRequests]);

  return (
    <div className="ta-fade">
      <TopBar
        title="Seats & AI Credits"
        sub="Manage member seats, licenses, and review learner AI credit requests"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={
          <button
            className="ta-btn ta-btn-outline"
            onClick={() => {
              seatsQuery.refetch();
              historyQuery.refetch();
              invitesQuery.refetch();
              creditRequestsQuery.refetch();
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            background: "var(--surface-2)",
            padding: 4,
            borderRadius: 10,
            border: "1px solid var(--border)",
            width: "fit-content",
          }}
        >
          <button
            className={`ta-btn ta-btn-sm ${activeTab === "seats" ? "ta-btn-primary" : "ta-btn-outline"}`}
            style={{ border: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => setActiveTab("seats")}
          >
            <Armchair size={14} /> Seats &amp; Licensing
          </button>
          <button
            className={`ta-btn ta-btn-sm ${activeTab === "credits" ? "ta-btn-primary" : "ta-btn-outline"}`}
            style={{ border: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => setActiveTab("credits")}
          >
            <Zap size={14} /> AI Credit Requests
            {pendingRequests.length > 0 && (
              <span
                style={{
                  background: "var(--warning, #B45309)",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 10,
                  marginLeft: 4,
                }}
              >
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "seats" && (
          <>
            {/* ---- Summary ---- */}
            <div className="ta-grid ta-grid-4 anim-stagger">
              {[
                { label: "Seats purchased", value: seats.purchased, hint: "Total ever bought", Icon: Receipt },
                { label: "Seats in use", value: seats.used, hint: "Active members right now", Icon: Users },
                {
                  label: "Available",
                  value: seats.available,
                  hint: seats.available > 0 ? "Ready to assign" : "Nothing left to assign",
                  Icon: Armchair,
                  tone: seats.available > 0 ? "var(--success)" : "var(--danger)",
                },
                { label: "Pending invites", value: invites.length, hint: invites.length ? "Each will take a seat" : "None outstanding", Icon: UserPlus },
              ].map((k) => {
                const Icon = k.Icon;
                return (
                  <div key={k.label} className="ta-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
                    <div className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                      <Icon size={13} /> {k.label}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: k.tone || "var(--text)" }}>
                      {seatsQuery.loading ? "..." : k.value}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{k.hint}</div>
                  </div>
                );
              })}
            </div>

            {/* ---- Enforcement status ---- */}
            <div
              className="ta-card"
              style={{
                padding: 16,
                borderColor: enforced && seats.available === 0 ? "var(--danger)" : "var(--border)",
              }}
            >
              <div className="ta-row ta-gap10" style={{ alignItems: "flex-start" }}>
                {enforced && seats.available === 0
                  ? <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                  : <ShieldCheck size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {orgQuery.loading
                      ? "Checking your plan..."
                      : enforced
                        ? seats.available > 0
                          ? `${seats.available} seat${seats.available === 1 ? "" : "s"} available to invite into`
                          : "Invitations are blocked until you buy more seats"
                        : "Seat limits don't apply on your current plan yet"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4, lineHeight: 1.5 }}>
                    {enforced
                      ? "Seat checks run in the database, at the moment an invite is created and again when it is accepted — so this figure is the real constraint, not a display counter."
                      : `This organization's status is "${org?.status || "unknown"}". Seat purchases are only required once a plan goes active; until then the older ${org?.max_users ?? "member"} -user soft cap applies.`}
                  </div>
                  {shortfall > 0 && (
                    <div style={{ fontSize: 12.5, color: "var(--warning)", marginTop: 6, fontWeight: 600 }}>
                      {invites.length} invite{invites.length === 1 ? " is" : "s are"} outstanding but only {seats.available} seat
                      {seats.available === 1 ? " is" : "s are"} free — {shortfall} of them will fail on acceptance unless you buy {shortfall} more.
                    </div>
                  )}
                  <div className="ta-row ta-gap8 ta-mt12" style={{ flexWrap: "wrap" }}>
                    <button
                      className="ta-btn ta-btn-outline ta-btn-sm"
                      onClick={() => (navigate ? navigate("people") : setScreen?.("people"))}
                    >
                      <UserPlus size={13} /> Go to Users &amp; Access <ArrowRight size={12} />
                    </button>
                    <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      {committed} of {seats.purchased} purchased seat{seats.purchased === 1 ? "" : "s"} committed (members + pending invites)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Buy seats ---- */}
            <div className="ta-card">
              <div className="ta-row ta-gap8">
                <CreditCard size={17} color="var(--primary)" />
                <div style={{ fontWeight: 800, fontSize: 15 }}>Buy seats</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                Seats are added to your organization once the payment provider confirms the charge. Nothing is
                granted before that confirmation lands.
              </div>

              <div className="ta-label ta-mt16">How many seats</div>
              <div className="ta-row ta-gap8 ta-mt6" style={{ flexWrap: "wrap" }}>
                <button className="ta-iconbtn" aria-label="Fewer seats" onClick={() => setQuantity((q) => Math.max(1, (Number(q) || 1) - 1))}>
                  <Minus size={14} />
                </button>
                <input
                  className="ta-input"
                  style={{ width: 110, textAlign: "center", fontWeight: 700 }}
                  type="number" min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                />
                <button className="ta-iconbtn" aria-label="More seats" onClick={() => setQuantity((q) => (Number(q) || 0) + 1)}>
                  <Plus size={14} />
                </button>
                {QUICK_PICKS.map((n) => (
                  <button
                    key={n}
                    className={`ta-pill ${Number(quantity) === n ? "ta-pill-active" : "ta-pill-inactive"}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setQuantity(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="ta-label ta-mt16">Pay with</div>
              <div className="ta-grid ta-grid-2 ta-gap8 ta-mt6">
                {PROVIDERS.map((p) => {
                  const active = provider === p.key;
                  return (
                    <div
                      key={p.key}
                      onClick={() => setProvider(p.key)}
                      className="ta-card ta-card-hover"
                      style={{
                        padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                        background: active ? "var(--primary-tint)" : "var(--surface)",
                      }}
                    >
                      <div className="ta-row ta-between" style={{ gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--primary)" : "var(--text)" }}>{p.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>{money(p.symbol, p.unit)}/seat</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{p.hint}</div>
                    </div>
                  );
                })}
              </div>

              <div className="ta-row ta-between ta-mt16" style={{ gap: 12, flexWrap: "wrap", padding: "12px 14px", background: "var(--surface-2)", borderRadius: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Total due now</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{money(chosen.symbol, total)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {Number(quantity) || 0} × {money(chosen.symbol, chosen.unit)} · charged in {chosen.currency}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>After this purchase</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {seats.available + (Number(quantity) || 0)} seat{seats.available + (Number(quantity) || 0) === 1 ? "" : "s"} available
                  </div>
                </div>
              </div>

              <button className="ta-btn ta-btn-primary ta-mt16" disabled={starting || !quantity || Number(quantity) <= 0} onClick={handleBuy}>
                <CreditCard size={15} />
                {starting ? "Redirecting to checkout..." : `Pay ${money(chosen.symbol, total)} for ${Number(quantity) || 0} seat${Number(quantity) === 1 ? "" : "s"}`}
              </button>

              {!userEmail && (
                <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 11.5, color: "var(--warning)" }}>
                  <Info size={13} /> No billing email is available for your account, so checkout can't be started.
                </div>
              )}
              {DEMO_MODE && (
                <div className="ta-row ta-gap6 ta-mt8" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                  <Info size={13} /> No database is connected, so checkout is unavailable in this preview.
                </div>
              )}
            </div>

            {/* ---- Who occupies the seats ---- */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ gap: 10, flexWrap: "wrap" }}>
                <div className="ta-row ta-gap8">
                  <Users size={17} color="var(--primary)" />
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Seat allocation</div>
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                  Every active member occupies one seat
                </span>
              </div>

              {membersQuery.loading && <div className="ta-empty ta-mt12">Loading members...</div>}
              {!membersQuery.loading && seatedMembers.length === 0 && (
                <div className="ta-empty ta-mt12">No active members yet, so no seats are in use.</div>
              )}

              <div className="ta-col ta-gap6 ta-mt12" style={{ maxHeight: 320, overflowY: "auto" }}>
                {seatedMembers.map((m) => (
                  <div key={m.id} className="ta-row ta-between" style={{ gap: 10, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 10, flexWrap: "wrap" }}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                      <Avatar
                        initials={(m.display_name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                        size={28}
                        src={m.avatar_url || undefined}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{m.display_name || "Member"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "capitalize" }}>{m.role || "learner"}</div>
                      </div>
                    </div>
                    <div className="ta-row ta-gap8" style={{ alignItems: "center" }}>
                      <select
                        className="ta-input"
                        style={{ fontSize: 11, padding: "2px 6px", height: 26 }}
                        value={m.role || "learner"}
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          try {
                            const res = await updateUserPlatformRole(m.id, newRole, orgId);
                            if (res.success) {
                              showToast(`Role updated to ${newRole}`);
                              membersQuery.refetch();
                            } else {
                              showToast(res.error || "Failed to update role");
                            }
                          } catch (err) {
                            showToast("Could not update role");
                          }
                        }}
                      >
                        <option value="learner">Learner</option>
                        <option value="mentor">Instructor</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Tag tone="success">Seat in use</Tag>
                    </div>
                  </div>
                ))}

                {invites.map((i) => (
                  <div key={i.id} className="ta-row ta-between" style={{ gap: 10, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 10, flexWrap: "wrap", opacity: 0.85 }}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                      <Avatar initials={(i.email || "?").slice(0, 2).toUpperCase()} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{i.email}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>Invited, not yet accepted</div>
                      </div>
                    </div>
                    <Tag tone="warning">Seat reserved</Tag>
                  </div>
                ))}
              </div>
            </div>

            {/* ---- Purchase history ---- */}
            <div className="ta-card">
              <div className="ta-row ta-gap8">
                <Receipt size={17} color="var(--primary)" />
                <div style={{ fontWeight: 800, fontSize: 15 }}>Purchase history</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                Every row is a confirmed charge recorded against a real payment reference.
              </div>
              <div className="ta-table-wrap ta-mt12">
                <table className="ta-table">
                  <thead><tr><th>Date</th><th>Seats</th><th>Amount</th><th>Reference</th></tr></thead>
                  <tbody>
                    {historyQuery.loading && <tr><td colSpan={4} className="ta-empty">Loading purchase history...</td></tr>}
                    {!historyQuery.loading && history.length === 0 && (
                      <tr><td colSpan={4} className="ta-empty">No seats have been purchased yet.</td></tr>
                    )}
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{h.purchased_at ? new Date(h.purchased_at).toLocaleString() : "N/A"}</td>
                        <td style={{ fontWeight: 700 }}>+{h.seats_purchased}</td>
                        <td>{h.amount_paid != null ? `${h.currency || ""} ${Number(h.amount_paid).toLocaleString()}`.trim() : "N/A"}</td>
                        <td style={{ fontSize: 11.5, color: "var(--text-3)", overflowWrap: "anywhere" }}>{h.payment_reference || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "credits" && (
          <>
            {/* AI Credits Metrics Summary */}
            <div className="ta-grid ta-grid-4 anim-stagger">
              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
                <div className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                  <Clock size={13} color="var(--warning, #B45309)" /> Pending Review
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: pendingRequests.length > 0 ? "var(--warning, #B45309)" : "var(--text)" }}>
                  {creditRequestsQuery.loading ? "..." : pendingRequests.length}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Awaiting admin approval</div>
              </div>

              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
                <div className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                  <Check size={13} color="var(--success, #059669)" /> Approved Requests
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "var(--success, #059669)" }}>
                  {creditRequestsQuery.loading ? "..." : approvedRequests.length}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Granted to learners</div>
              </div>

              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
                <div className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                  <Zap size={13} color="var(--primary)" /> Total Credits Granted
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "var(--primary)" }}>
                  {creditRequestsQuery.loading ? "..." : totalCreditsApproved}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Allocated AI credits</div>
              </div>

              <div className="ta-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
                <div className="ta-row ta-gap6" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                  <Sparkles size={13} color="var(--text-3)" /> Total Requests
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                  {creditRequestsQuery.loading ? "..." : creditRequests.length}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>All-time submissions</div>
              </div>
            </div>

            {/* Credit Requests Controls & Table */}
            <div className="ta-card">
              <div className="ta-row ta-between" style={{ gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="ta-row ta-gap8" style={{ alignItems: "center" }}>
                    <Zap size={18} color="var(--primary)" />
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Learner AI Credit Requests</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                    Learners submit requests from their AI Coach &amp; Checkout screens when they need organizational AI credits.
                  </div>
                </div>

                <button
                  className="ta-btn ta-btn-primary ta-btn-sm"
                  onClick={() => setGrantModalOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Plus size={14} /> Grant Credits Directly
                </button>
              </div>

              {/* Filters */}
              <div className="ta-row ta-between ta-mt16" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="ta-row ta-gap8" style={{ flex: "1 1 240px", maxWidth: 360, position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                  <input
                    className="ta-input"
                    style={{ width: "100%", paddingLeft: 30, fontSize: 12.5 }}
                    placeholder="Search by learner name or reason..."
                    value={creditSearch}
                    onChange={(e) => setCreditSearch(e.target.value)}
                  />
                </div>

                <div className="ta-row ta-gap6" style={{ flexWrap: "wrap" }}>
                  {["all", "pending", "approved", "denied"].map((status) => (
                    <button
                      key={status}
                      className={`ta-pill ${creditStatusFilter === status ? "ta-pill-active" : "ta-pill-inactive"}`}
                      style={{ textTransform: "capitalize", cursor: "pointer" }}
                      onClick={() => setCreditStatusFilter(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* List of Requests */}
              {creditRequestsQuery.loading && <div className="ta-empty ta-mt16">Loading credit requests...</div>}
              {!creditRequestsQuery.loading && filteredCreditRequests.length === 0 && (
                <div className="ta-empty ta-mt16">
                  {creditRequests.length === 0
                    ? "No credit requests submitted yet. When learners request credits from their organization, they will appear here."
                    : "No credit requests match your search filter."}
                </div>
              )}

              {!creditRequestsQuery.loading && filteredCreditRequests.length > 0 && (
                <div className="ta-col ta-gap8 ta-mt16">
                  {filteredCreditRequests.map((req) => {
                    const isPending = req.status === "pending";
                    const isActing = actionLoadingId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="ta-card"
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          background: "var(--surface-2)",
                          border: isPending ? "1px solid var(--border-focus, #3B82F6)" : "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div className="ta-row ta-between" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                          <div className="ta-row ta-gap10" style={{ minWidth: 0, alignItems: "center" }}>
                            <Avatar
                              initials={(req.user?.display_name || "L").slice(0, 2).toUpperCase()}
                              size={34}
                              src={req.user?.avatar_url || undefined}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                                {req.user?.display_name || "Learner"}
                              </div>
                              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                                Requested on {new Date(req.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            </div>
                          </div>

                          <div className="ta-row ta-gap8" style={{ alignItems: "center" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "4px 10px",
                                borderRadius: 8,
                                background: "rgba(59, 130, 246, 0.12)",
                                color: "var(--primary)",
                                fontWeight: 800,
                                fontSize: 13,
                              }}
                            >
                              <Zap size={14} /> {req.amount} credits
                            </div>
                            <Tag tone={req.status === "approved" ? "success" : req.status === "denied" ? "danger" : "warning"}>
                              {req.status === "pending" ? "Pending Review" : req.status === "approved" ? "Approved" : "Denied"}
                            </Tag>
                          </div>
                        </div>

                        {req.reason && (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "var(--text-2)",
                              background: "var(--surface)",
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              fontStyle: "italic",
                              lineHeight: 1.45,
                            }}
                          >
                            &ldquo;{req.reason}&rdquo;
                          </div>
                        )}

                        {isPending && (
                          <div className="ta-row ta-gap8 ta-mt4" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button
                              className="ta-btn ta-btn-outline ta-btn-sm"
                              style={{ color: "var(--danger, #EF4444)", borderColor: "var(--danger, #EF4444)" }}
                              disabled={isActing}
                              onClick={() => handleDenyRequest(req)}
                            >
                              <X size={13} /> Deny
                            </button>
                            <button
                              className="ta-btn ta-btn-primary ta-btn-sm"
                              style={{ background: "var(--success, #059669)", borderColor: "var(--success, #059669)" }}
                              disabled={isActing}
                              onClick={() => handleApproveRequest(req)}
                            >
                              <Check size={13} /> Approve &amp; Grant {req.amount} Credits
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Grant Direct Credits Modal */}
      {grantModalOpen && (
        <PortalModal isOpen={grantModalOpen} onClose={() => setGrantModalOpen(false)} maxWidth={500}>
          <div style={{ padding: 24 }}>
            <div className="ta-row ta-between" style={{ marginBottom: 16 }}>
              <div className="ta-row ta-gap8" style={{ alignItems: "center" }}>
                <Zap size={18} color="var(--primary)" />
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Grant AI Credits Directly</div>
              </div>
              <button className="ta-iconbtn" onClick={() => setGrantModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 18, lineHeight: 1.5 }}>
              Allocate AI credits directly to an organization member. Credits are available immediately in their AI Coach queries and simulations.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="ta-label" style={{ display: "block", marginBottom: 6 }}>Select Member</label>
              <select
                className="ta-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                value={grantSelectedUserId}
                onChange={(e) => setGrantSelectedUserId(e.target.value)}
              >
                <option value="">-- Choose an active member --</option>
                {members.map((m) => (
                  <option key={m.id || m.user_id} value={m.id || m.user_id}>
                    {m.display_name || m.email || "Member"} ({m.role || "learner"})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="ta-label" style={{ display: "block", marginBottom: 6 }}>Credit Amount</label>
              <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                {CREDIT_QUICK_PICKS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`ta-pill ${grantAmount === amt ? "ta-pill-active" : "ta-pill-inactive"}`}
                    onClick={() => setGrantAmount(amt)}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
              <input
                className="ta-input"
                type="number"
                min="1"
                style={{ width: "100%", boxSizing: "border-box" }}
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="ta-label" style={{ display: "block", marginBottom: 6 }}>Reason / Note (optional)</label>
              <textarea
                className="ta-input"
                style={{ width: "100%", boxSizing: "border-box", minHeight: 60, resize: "vertical" }}
                placeholder="e.g. Capstone project sprint bonus"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
              />
            </div>

            <div className="ta-row ta-gap8" style={{ justifyContent: "flex-end" }}>
              <button className="ta-btn ta-btn-outline" onClick={() => setGrantModalOpen(false)}>
                Cancel
              </button>
              <button
                className="ta-btn ta-btn-primary"
                disabled={grantSubmitting || !grantSelectedUserId}
                onClick={handleGrantDirectCredits}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Send size={14} /> {grantSubmitting ? "Granting..." : `Grant ${grantAmount || 0} Credits`}
              </button>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
}

export default SeatsScreen;

