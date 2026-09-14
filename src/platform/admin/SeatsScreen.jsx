import React, { useState, useContext, useMemo } from "react";
import { TopBar, ToastContext, Tag, Avatar, NavigationContext } from "../components/PlatformUI.jsx";
import {
  Armchair, CreditCard, Users, Plus, Minus, RefreshCw, ShieldCheck, AlertTriangle,
  Receipt, ArrowRight, UserPlus, Info,
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchOrgSeatsSummary, fetchSeatPurchaseHistory, startSeatPurchasePayment,
  SEAT_PRICE_USD, SEAT_PRICE_NGN,
} from "../../lib/api/organizations.js";
import { fetchOrganizationById, fetchOrgMembers, fetchPendingInvitations } from "../../lib/api/platform.js";
import { DEMO_MODE } from "../../lib/demoMode.js";

/**
 * Operations -> Seats & Licensing.
 *
 * The whole seat-based payment model already existed server-side and had
 * almost no interface: `seat_purchases`, `get_org_seats_summary()`,
 * `purchase_seats()` and `check_seat_available()` (0129_seat_based_payments.sql),
 * plus `fetchOrgSeatsSummary` / `purchaseSeats` / `startSeatPurchasePayment` /
 * `fetchSeatPurchaseHistory` in lib/api/organizations.js. Only a small card
 * inside the Settings Hub ever touched any of it, `fetchSeatPurchaseHistory`
 * was exported and called by nothing at all, and there was no page an admin
 * could be sent to when an invite was refused for lack of seats.
 *
 * That refusal is real and it is enforced in the database, not the UI:
 * `create_user_invitation()` raises "No seats available - purchase more seats
 * before inviting additional users" once an organization's status is 'active'.
 * Trial organizations are deliberately exempt and keep the older `max_users`
 * soft cap. This screen exists so that message has somewhere to point.
 */

const PROVIDERS = [
  { key: "paystack", label: "Paystack", currency: "NGN", symbol: "₦", unit: SEAT_PRICE_NGN, hint: "Cards & bank transfer (Nigeria)" },
  { key: "stripe", label: "Stripe", currency: "USD", symbol: "$", unit: SEAT_PRICE_USD, hint: "International cards" },
];

const QUICK_PICKS = [5, 10, 25, 50];

function money(symbol, amount) {
  return `${symbol}${Number(amount || 0).toLocaleString()}`;
}

export function SeatsScreen({ orgId, orgSelector, setScreen, userEmail }) {
  const showToast = useContext(ToastContext);
  const navigate = useContext(NavigationContext);

  const orgQuery = useSupabaseQuery(async () => (orgId ? fetchOrganizationById(orgId) : null), [orgId]);
  const seatsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgSeatsSummary(orgId) : null), [orgId]);
  const historyQuery = useSupabaseQuery(async () => (orgId ? fetchSeatPurchaseHistory(orgId) : []), [orgId]);
  const membersQuery = useSupabaseQuery(async () => (orgId ? fetchOrgMembers(orgId) : []), [orgId]);
  const invitesQuery = useSupabaseQuery(async () => (orgId ? fetchPendingInvitations(orgId) : []), [orgId]);

  const org = orgQuery.data;
  const seats = seatsQuery.data || { purchased: 0, used: 0, available: 0 };
  const history = historyQuery.data || [];
  const members = membersQuery.data || [];
  const invites = invitesQuery.data || [];

  const [provider, setProvider] = useState("paystack");
  const [quantity, setQuantity] = useState(5);
  const [starting, setStarting] = useState(false);

  const chosen = PROVIDERS.find((p) => p.key === provider) || PROVIDERS[0];
  const total = chosen.unit * Math.max(0, Number(quantity) || 0);

  // Seat enforcement only applies to an 'active' (paid) organization - that is
  // exactly what check_seat_available() does server-side, so the copy here has
  // to say the same thing rather than implying every org is gated.
  const enforced = org?.status === "active";
  // Pending invites are not yet counted in `used` (that counts active
  // organization_members), but each one will consume a seat when accepted -
  // so an admin needs to see them against the available figure.
  const committed = seats.used + invites.length;
  const shortfall = Math.max(0, invites.length - seats.available);

  const seatedMembers = useMemo(
    () => members.filter((m) => (m.status || "active") === "active"),
    [members]
  );

  async function handleBuy() {
    const qty = Number(quantity);
    if (!qty || qty <= 0) { showToast("Enter how many seats you need."); return; }
    if (!userEmail) { showToast("No billing email on your account - add one in Settings first."); return; }
    setStarting(true);
    try {
      const res = await startSeatPurchasePayment({ orgId, seats: qty, email: userEmail, provider });
      // On success the browser is redirected to the provider, so nothing below
      // runs. Only a failure returns here.
      if (!res.success) { showToast(res.error); setStarting(false); }
    } catch (e) {
      showToast(e?.message || "Could not start the seat purchase.");
      setStarting(false);
    }
  }

  return (
    <div className="ta-fade">
      <TopBar
        title="Seats & Licensing"
        sub="Buy seats, see who occupies them, and review every purchase"
        orgSelector={orgSelector}
        onNavigate={setScreen}
        right={
          <button className="ta-btn ta-btn-outline" onClick={() => { seatsQuery.refetch(); historyQuery.refetch(); invitesQuery.refetch(); }}>
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* ---- Summary ---- */}
        <div className="ta-grid ta-grid-4 anim-stagger">
          {[
            { label: "Seats purchased", value: seats.purchased, hint: "Total ever bought", Icon: Receipt },
            { label: "Seats in use", value: seats.used, hint: "Active members right now", Icon: Users },
            { label: "Available", value: seats.available, hint: seats.available > 0 ? "Ready to assign" : "Nothing left to assign", Icon: Armchair, tone: seats.available > 0 ? "var(--success)" : "var(--danger)" },
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
                <Tag tone="success">Seat in use</Tag>
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
      </div>
    </div>
  );
}

export default SeatsScreen;
