const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'src', 'platform', 'superadmin', 'OrganizationsScreen.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add grantFreeSeats to import
const targetImport = `import { fetchOrgFeatureFlagOverrides, setOrgFeatureFlag, fetchOrgSeatsSummary } from "../../lib/api/organizations.js";`;
const replacementImport = `import { fetchOrgFeatureFlagOverrides, setOrgFeatureFlag, fetchOrgSeatsSummary, grantFreeSeats } from "../../lib/api/organizations.js";`;

content = content.replace(targetImport, replacementImport);

// 2. Add grant states inside OrgManagePanel
const targetState = `  const [copiedLink, setCopiedLink] = useState(false);`;
const replacementState = `  const [copiedLink, setCopiedLink] = useState(false);
  const [grantSeatsQty, setGrantSeatsQty] = useState(300);
  const [grantReason, setGrantReason] = useState("");
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [submittingGrant, setSubmittingGrant] = useState(false);`;

content = content.replace(targetState, replacementState);

// 3. Update the Seats UI section in OrgManagePanel
const targetSeatsUI = `      <div className="ta-mt16">
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Seats</div>
        <div className="ta-row ta-gap16">
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.purchased}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Purchased</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.used}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Used</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800, color: seats.available > 0 ? "var(--success)" : "var(--danger)" }}>{seats.available}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Available</div></div>
        </div>
        {org.status === "active" && seats.available <= 0 && (
          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>This organization cannot add new users until they purchase more seats.</div>
        )}
      </div>`;

const replacementSeatsUI = `      <div className="ta-mt16">
        <div className="ta-row ta-between" style={{ alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Seats &amp; Capacity</div>
          <button
            type="button"
            className="ta-btn ta-btn-primary ta-btn-sm"
            onClick={() => setShowGrantModal((prev) => !prev)}
            style={{ fontSize: 11.5 }}
          >
            <Plus size={13} /> Grant Free Seats
          </button>
        </div>
        <div className="ta-row ta-gap16">
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.purchased}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Purchased / Granted</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{seats.used}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Used</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 800, color: seats.available > 0 ? "var(--success)" : "var(--danger)" }}>{seats.available}</div><div style={{ fontSize: 10.5, color: "var(--text-2)" }}>Available</div></div>
        </div>
        {org.status === "active" && seats.available <= 0 && (
          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>This organization cannot add new users until they purchase or are granted more seats.</div>
        )}

        {showGrantModal && (
          <div className="ta-mt12" style={{ padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--primary-tint)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
              Grant Free Seats to {org.name}
            </div>
            <div className="ta-row ta-gap6" style={{ marginBottom: 10, flexWrap: "wrap" }}>
              {[50, 100, 300, 500, 1000].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  className={grantSeatsQty === qty ? "ta-btn ta-btn-primary ta-btn-sm" : "ta-btn ta-btn-outline ta-btn-sm"}
                  style={{ height: 26, fontSize: 11 }}
                  onClick={() => setGrantSeatsQty(qty)}
                >
                  +{qty}
                </button>
              ))}
            </div>
            <div className="ta-row ta-gap8" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="number"
                min="1"
                className="ta-input"
                style={{ width: 100, height: 32, fontSize: 12 }}
                value={grantSeatsQty}
                onChange={(e) => setGrantSeatsQty(Math.max(1, parseInt(e.target.value) || 0))}
              />
              <input
                type="text"
                className="ta-input"
                style={{ flex: 1, minWidth: 160, height: 32, fontSize: 12 }}
                placeholder="Reason or reference (e.g. Platform Owner Grant)"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
              />
              <button
                type="button"
                className="ta-btn ta-btn-primary ta-btn-sm"
                style={{ height: 32 }}
                disabled={submittingGrant || grantSeatsQty <= 0}
                onClick={async () => {
                  setSubmittingGrant(true);
                  try {
                    const res = await grantFreeSeats(org.id, grantSeatsQty, grantReason || "Platform Owner Free Grant");
                    if (res.success) {
                      showToast(\`Successfully granted \${grantSeatsQty} seats to \${org.name}!\`);
                      setShowGrantModal(false);
                      setGrantReason("");
                      seatsSummaryQuery.refetch();
                      refetchOrgs();
                    } else {
                      showToast(res.error || "Failed to grant seats.");
                    }
                  } catch (err) {
                    showToast(err.message || "Failed to grant seats.");
                  } finally {
                    setSubmittingGrant(false);
                  }
                }}
              >
                {submittingGrant ? "Granting..." : "Confirm Grant"}
              </button>
              <button
                type="button"
                className="ta-btn ta-btn-ghost ta-btn-sm"
                style={{ height: 32 }}
                onClick={() => setShowGrantModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>`;

// Handle CRLF / LF matching
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetSeatsUI.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedTarget)) {
  console.error('Target seats UI not found in OrganizationsScreen.jsx!');
  process.exit(1);
}

const finalContent = normalizedContent.replace(normalizedTarget, replacementSeatsUI);
fs.writeFileSync(file, finalContent, 'utf8');
console.log('Successfully updated OrganizationsScreen.jsx with Grant Free Seats UI!');
