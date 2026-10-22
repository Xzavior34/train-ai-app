import { LoadingSkeleton } from "./../../components/common/PageLoadingBoundary.jsx";
import { useAssignmentRefresh } from "../../lib/useAssignmentRefresh.js";
import React, { useContext, useState } from "react";
import { TopBar, ToastContext } from "../components/PlatformUI.jsx";
import { MemberLearningTrack } from "../components/MemberLearningTrack.jsx";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMentorActiveCohorts, fetchInstructorCohortWorkspace, addCohortResource, createCohortSession } from "../../lib/api/platform.js";

export function InstructorCohortsScreen({ currentUserId, cohortId, onOpenCohort, onBack, profileQuery }) {
  const showToast = useContext(ToastContext);
  const [learnerId, setLearnerId] = useState(null);
  const [busy, setBusy] = useState(false);
  const query = useSupabaseQuery(() => cohortId ? fetchInstructorCohortWorkspace(cohortId) : fetchMentorActiveCohorts(currentUserId), [cohortId, currentUserId]);
  useAssignmentRefresh(currentUserId, query.refetch);
  async function save(e, kind) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      if (kind === "resource") await addCohortResource({ cohortId, createdBy: currentUserId, title: values.title, externalUrl: values.url });
      else await createCohortSession({ cohortId, createdBy: currentUserId, title: values.title, startsAt: new Date(values.startsAt).toISOString(), joinUrl: values.url });
      form.reset(); query.refetch(); showToast(kind === "resource" ? "Resource added." : "Session scheduled.");
    } catch (error) { showToast(error.message); }
    finally { setBusy(false); }
  }
  const data = query.data;
  return <div className="ta-fade"><TopBar profileQuery={{ data: { ...profileQuery?.data, role: "Instructor", display_name: profileQuery?.data?.display_name || "Instructor" } }} title={cohortId ? data?.cohort?.name || "Teaching cohort" : "My teaching cohorts"} sub="Assigned cohorts, learner progress, resources and sessions" />
    <div className="ta-content">
      {cohortId && <button className="ta-btn ta-btn-outline" onClick={onBack}>Back to my cohorts</button>}
      {query.loading ? <div className="ta-empty" role="status"><LoadingSkeleton label="Loading your assignments..." rows={3} /></div> : query.error ? <div className="ta-empty" role="alert">{query.error} <button className="ta-btn ta-btn-outline" onClick={query.refetch}>Retry</button></div> : !cohortId ? <div className="ta-col ta-gap12">
        {!(data || []).length && <div className="ta-empty">No active teaching cohorts assigned. Ask your administrator to assign you as an instructor.</div>}
        {(data || []).map(cohort => <button key={cohort.id} className="ta-card ta-btn" onClick={() => onOpenCohort(cohort.id)} style={{ textAlign: "left", padding: 20 }}>{cohort.name} · Open teaching space</button>)}
      </div> : data && <>
        <section className="ta-card ta-mt16" style={{ padding: 20 }}><h2>Learners</h2>
          {!(data.members || []).some(member => member.cohort_role !== "instructor") && <p>No learners assigned yet.</p>}
          {(data.members || []).filter(member => member.cohort_role !== "instructor").map(member => <div className="ta-row ta-between ta-gap10 ta-mt12" key={member.user_id}>
            <span>{member.display_name || "Learner"}</span><button className="ta-btn ta-btn-outline" aria-expanded={learnerId === member.user_id} onClick={() => setLearnerId(learnerId === member.user_id ? null : member.user_id)}>View learning track</button>
          </div>)}
          {learnerId && <MemberLearningTrack key={`${cohortId}-${learnerId}`} orgId={data.cohort.organization_id} userId={learnerId} cohortId={cohortId} />}
        </section>
        <section className="ta-card ta-mt16" style={{ padding: 20 }}><h2>Resources</h2>
          {(data.resources || []).map(resource => <p key={resource.id}>{resource.title}{/^https?:\/\//i.test(resource.external_url || "") && <> · <a href={resource.external_url} target="_blank" rel="noreferrer">Open resource</a></>}</p>)}
          <form onSubmit={e => save(e, "resource")} className="ta-col ta-gap10"><label>Resource title<input className="ta-input" name="title" required maxLength="200" /></label><label>Resource link<input className="ta-input" name="url" type="url" pattern="https?://.*" required /></label><button className="ta-btn ta-btn-primary" disabled={busy}>Add resource</button></form>
        </section>
        <section className="ta-card ta-mt16" style={{ padding: 20 }}><h2>Sessions</h2>
          {(data.sessions || []).map(session => <p key={session.id}>{session.title} · {new Date(session.starts_at).toLocaleString()}{/^https?:\/\//i.test(session.join_url || "") && <> · <a href={session.join_url} target="_blank" rel="noreferrer">Join session</a></>}</p>)}
          <form onSubmit={e => save(e, "session")} className="ta-col ta-gap10"><label>Session title<input className="ta-input" name="title" required maxLength="200" /></label><label>Starts at<input className="ta-input" name="startsAt" type="datetime-local" required /></label><label>Meeting link<input className="ta-input" name="url" type="url" pattern="https?://.*" required /></label><button className="ta-btn ta-btn-primary" disabled={busy}>Schedule session</button></form>
        </section>
      </>}
    </div></div>;
}
