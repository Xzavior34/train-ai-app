import React, { useState, useContext, useEffect } from "react";
import { TopBar, ToastContext, Tag } from "../components/PlatformUI.jsx";
import { Plus, Trash2, BadgeCheck, Link as LinkIcon } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  updateMentorProfile,
  fetchMentorCredentials, addMentorCredential, deleteMentorCredential,
  fetchMentorPortfolioItems, addMentorPortfolioItem, deleteMentorPortfolioItem,
} from "../../lib/api/schemaHelper.js";

const CREDENTIAL_TYPES = ["certification", "degree", "license", "award", "other"];
const PORTFOLIO_TYPES = ["project", "case_study", "publication", "link", "video"];

export function MentorSettingsScreen({ mentorId, mentorProfileQuery }) {
  const showToast = useContext(ToastContext);
  const mentor = mentorProfileQuery?.data || null;

  const [rate, setRate] = useState(75);
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (mentor) {
      setRate(mentor.hourly_rate ?? 75);
      setBio(mentor.bio || "");
    }
  }, [mentor]);

  async function handleSaveProfile() {
    if (!mentorId) { showToast("Your instructor profile isn't linked to a mentor record yet."); return; }
    setSavingProfile(true);
    try {
      await updateMentorProfile(mentorId, { hourly_rate: Number(rate) || 0, bio });
      mentorProfileQuery?.refetch?.();
      showToast("Instructor profile updated!");
    } catch (e) {
      showToast(e.message || "Could not save settings.");
    } finally {
      setSavingProfile(false);
    }
  }

  // Credentials
  const credentialsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorCredentials(mentorId) : [], [mentorId]);
  const [credTitle, setCredTitle] = useState("");
  const [credType, setCredType] = useState(CREDENTIAL_TYPES[0]);
  const [credOrg, setCredOrg] = useState("");
  const [credUrl, setCredUrl] = useState("");
  const [savingCred, setSavingCred] = useState(false);

  async function handleAddCredential() {
    if (!mentorId || !credTitle.trim() || !credOrg.trim()) { showToast("Title and issuing organization are required."); return; }
    setSavingCred(true);
    try {
      await addMentorCredential(mentorId, { title: credTitle.trim(), credentialType: credType, issuingOrganization: credOrg.trim(), verificationUrl: credUrl.trim() || null });
      setCredTitle(""); setCredOrg(""); setCredUrl("");
      credentialsQuery.refetch();
      showToast("Credential added.");
    } catch (e) {
      showToast(e.message || "Could not add credential.");
    } finally {
      setSavingCred(false);
    }
  }

  async function handleDeleteCredential(id) {
    try {
      await deleteMentorCredential(id);
      credentialsQuery.refetch();
      showToast("Credential removed.");
    } catch (e) {
      showToast(e.message || "Could not remove credential.");
    }
  }

  // Portfolio
  const portfolioQuery = useSupabaseQuery(async () => mentorId ? fetchMentorPortfolioItems(mentorId) : [], [mentorId]);
  const [pfTitle, setPfTitle] = useState("");
  const [pfType, setPfType] = useState(PORTFOLIO_TYPES[0]);
  const [pfDescription, setPfDescription] = useState("");
  const [pfUrl, setPfUrl] = useState("");
  const [savingPf, setSavingPf] = useState(false);

  async function handleAddPortfolioItem() {
    if (!mentorId || !pfTitle.trim()) { showToast("Title is required."); return; }
    setSavingPf(true);
    try {
      await addMentorPortfolioItem(mentorId, { title: pfTitle.trim(), itemType: pfType, description: pfDescription.trim() || null, mediaUrl: pfUrl.trim() || null });
      setPfTitle(""); setPfDescription(""); setPfUrl("");
      portfolioQuery.refetch();
      showToast("Portfolio item added.");
    } catch (e) {
      showToast(e.message || "Could not add portfolio item.");
    } finally {
      setSavingPf(false);
    }
  }

  async function handleDeletePortfolioItem(id) {
    try {
      await deleteMentorPortfolioItem(id);
      portfolioQuery.refetch();
      showToast("Portfolio item removed.");
    } catch (e) {
      showToast(e.message || "Could not remove portfolio item.");
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Instructor Settings" sub="Hourly rate, bio, credentials & portfolio" />
      <div className="ta-content">
        <div className="ta-card" style={{ maxWidth: 600 }}>
          <div className="ta-label">Hourly Rate ($)</div>
          <input className="ta-input ta-mt6" type="number" value={rate} onChange={e => setRate(Number(e.target.value))} />
          <div className="ta-label ta-mt16">Bio / Specialization</div>
          <textarea className="ta-input ta-mt6" rows={3} value={bio} onChange={e => setBio(e.target.value)} />
          <button className="ta-btn ta-btn-primary ta-mt16" disabled={savingProfile} onClick={handleSaveProfile}>Save settings</button>
        </div>

        <div className="ta-card ta-mt20" style={{ maxWidth: 700 }}>
          <div className="ta-title">Credentials & Certifications</div>
          <div className="ta-col ta-gap8 ta-mt12">
            {credentialsQuery.loading && <div className="ta-empty">Loading credentials...</div>}
            {!credentialsQuery.loading && (credentialsQuery.data || []).length === 0 && <div className="ta-empty">No credentials added yet.</div>}
            {(credentialsQuery.data || []).map(c => (
              <div key={c.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12 }}>
                <div className="ta-row ta-gap10">
                  <BadgeCheck size={16} color={c.is_verified ? "var(--success)" : "var(--text-3)"} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{c.issuing_organization} · {(c.credential_type || "").replace(/_/g, " ")}</div>
                  </div>
                </div>
                <div className="ta-row ta-gap8">
                  <Tag tone={c.is_verified ? "success" : "warning"}>{c.is_verified ? "verified" : "unverified"}</Tag>
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => handleDeleteCredential(c.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="ta-row ta-gap8 ta-mt16" style={{ flexWrap: "wrap" }}>
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Title (e.g. AWS ML Specialty)" value={credTitle} onChange={e => setCredTitle(e.target.value)} />
            <select className="ta-input" value={credType} onChange={e => setCredType(e.target.value)}>
              {CREDENTIAL_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Issuing organization" value={credOrg} onChange={e => setCredOrg(e.target.value)} />
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Verification URL (optional)" value={credUrl} onChange={e => setCredUrl(e.target.value)} />
            <button className="ta-btn ta-btn-outline" disabled={!mentorId || savingCred} onClick={handleAddCredential}><Plus size={14} /> Add</button>
          </div>
        </div>

        <div className="ta-card ta-mt20" style={{ maxWidth: 700 }}>
          <div className="ta-title">Portfolio</div>
          <div className="ta-col ta-gap8 ta-mt12">
            {portfolioQuery.loading && <div className="ta-empty">Loading portfolio...</div>}
            {!portfolioQuery.loading && (portfolioQuery.data || []).length === 0 && <div className="ta-empty">No portfolio items added yet.</div>}
            {(portfolioQuery.data || []).map(p => (
              <div key={p.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12 }}>
                <div>
                  <div className="ta-row ta-gap8">
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{p.title}</span>
                    <Tag>{(p.item_type || "link").replace(/_/g, " ")}</Tag>
                  </div>
                  {p.description && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>{p.description}</div>}
                  {p.media_urls?.[0] && (
                    <a href={p.media_urls[0]} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <LinkIcon size={12} /> {p.media_urls[0]}
                    </a>
                  )}
                </div>
                <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => handleDeletePortfolioItem(p.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="ta-row ta-gap8 ta-mt16" style={{ flexWrap: "wrap" }}>
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Title" value={pfTitle} onChange={e => setPfTitle(e.target.value)} />
            <select className="ta-input" value={pfType} onChange={e => setPfType(e.target.value)}>
              {PORTFOLIO_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Description (optional)" value={pfDescription} onChange={e => setPfDescription(e.target.value)} />
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Link URL (optional)" value={pfUrl} onChange={e => setPfUrl(e.target.value)} />
            <button className="ta-btn ta-btn-outline" disabled={!mentorId || savingPf} onClick={handleAddPortfolioItem}><Plus size={14} /> Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
