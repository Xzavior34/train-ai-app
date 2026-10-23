import React, { useState } from "react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { LoadingSkeleton } from "../../components/common/PageLoadingBoundary.jsx";
import {
  fetchCapWorkspace,
  saveCapTeam,
  joinCapTeam,
  removeCapTeamMember,
  saveCapLearningGoal,
  saveCapProblem,
  reviewCapProblem,
  saveCapSkillOption,
  saveCapCheckin,
} from "../../lib/api/capProgram.js";

const card = {
  padding: 18,
  minWidth: 0,
  overflowWrap: "anywhere",
  background: "var(--surface,#fff)",
  border: "1px solid var(--border,#e2e8f0)",
  borderRadius: 12,
};
const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))",
  gap: 14,
};
function Field({ label, children }) {
  return (
    <label
      style={{
        display: "grid",
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
        minWidth: 0,
      }}
    >
      {label}
      {children}
    </label>
  );
}
function Input({ label, ...props }) {
  return (
    <Field label={label}>
      <input aria-label={label} className="ta-input" {...props} />
    </Field>
  );
}
function Textarea({ label, ...props }) {
  return (
    <Field label={label}>
      <textarea aria-label={label} className="ta-input" rows={3} {...props} />
    </Field>
  );
}
function Select({ label, children, ...props }) {
  return (
    <Field label={label}>
      <select aria-label={label} className="ta-input" {...props}>
        {children}
      </select>
    </Field>
  );
}
const preferenceText = (value) =>
  Array.isArray(value)
    ? value.join(", ")
    : typeof value === "string"
      ? value
      : value
        ? JSON.stringify(value)
        : "Not recorded";
const valuesOf = (form) => Object.fromEntries(new FormData(form));
function ProjectLinks({ team }) {
  return (
    <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
      {[
        ["github_url", "Repository"],
        ["demo_url", "Live demo"],
        ["presentation_url", "Presentation"],
      ].map(([key, label]) =>
        /^https?:\/\//i.test(team[key] || "") ? (
          <a
            className="ta-btn ta-btn-outline ta-btn-sm"
            key={key}
            href={team[key]}
            target="_blank"
            rel="noreferrer"
          >
            {label}
          </a>
        ) : null,
      )}
    </div>
  );
}

function LearningGoal({ cohortId, workspace, userId, run, busy }) {
  const own = workspace.intentions.find((i) => i.user_id === userId);
  const options = workspace.skillOptions.filter((o) => o.is_active);
  const [track, setTrack] = useState(own?.track || "");
  const [skill, setSkill] = useState(own?.specific_skill || "");
  return (
    <section className="ta-card" style={card}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>What do you want to learn?</h2>
      <p className="ta-sub">
        Your administrator can see your exact choice. Choosing a goal does not
        enroll you in a course.
      </p>
      <p className="ta-sub">
        Registration preferences:{" "}
        {preferenceText(workspace.selfRegistration?.tracks)}
        {workspace.selfRegistration?.specificInterest
          ? ` · Specific interest: ${preferenceText(workspace.selfRegistration.specificInterest)}`
          : ""}
      </p>
      <p>
        {own?.track ? (
          <>
            <strong>Saved choice:</strong> {own.track} → {own.specific_skill}
          </>
        ) : (
          "No learning goal selected yet."
        )}
      </p>
      <form
        style={{ display: "grid", gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => saveCapLearningGoal(cohortId, track, skill),
            "Learning goal saved",
          );
        }}
      >
        <div style={grid}>
          <Select
            label="Track"
            required
            value={track}
            onChange={(e) => {
              setTrack(e.target.value);
              setSkill("");
            }}
          >
            <option value="">Choose a track</option>
            {[...new Set(options.map((o) => o.track))].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Select
            label="Specific skill"
            required
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          >
            <option value="">Choose a specific skill</option>
            {options
              .filter((o) => o.track === track)
              .map((o) => (
                <option key={o.id}>{o.skill}</option>
              ))}
          </Select>
        </div>
        {!options.length && (
          <p>
            Your administrator has not configured skill choices for this cohort
            yet.
          </p>
        )}
        <button
          className="ta-btn ta-btn-primary"
          disabled={
            busy || !options.some((o) => o.track === track && o.skill === skill)
          }
        >
          Save learning goal
        </button>
      </form>
    </section>
  );
}
function StaffGoals({ workspace, cohortId, run, busy }) {
  const [filter, setFilter] = useState("");
  return (
    <details className="ta-card" style={card}>
      <summary>View learner goals &amp; problem statements ({workspace.members.filter(m => m.cohort_role !== "instructor").length})</summary>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>
        Learner goals &amp; problem statements
      </h2>
      <p className="ta-sub">
        These are learners’ saved choices. “Not selected” means no choice has
        been recorded.
      </p>
      <Input
        label="Find learner or skill"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div style={{ ...grid, marginTop: 14 }}>
        {workspace.members
          .filter((m) => m.cohort_role !== "instructor")
          .map((m) => ({
            ...m,
            intention: workspace.intentions.find(
              (i) => i.user_id === m.user_id,
            ),
          }))
          .filter((m) =>
            `${m.name} ${preferenceText(m.registration_tracks)} ${preferenceText(m.registration_interest)} ${m.profile_goal?.track || ""} ${m.profile_goal?.skill || ""} ${m.intention?.track || ""} ${m.intention?.specific_skill || ""}`
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map((m) => (
            <article
              className="ta-card"
              key={m.user_id}
              style={{ padding: 14 }}
            >
              <strong>{m.name || "Cohort member"}</strong>
              {m.profile_goal?.track && <p>Profile learning goal: {m.profile_goal.track} → {m.profile_goal.skill}</p>}
              <p style={{ margin: "8px 0" }}>
                {m.intention?.track
                  ? `${m.intention.track} → ${m.intention.specific_skill}`
                  : "CAP goal: Not selected"}
              </p>
              <p className="ta-sub">
                Registration preferences:{" "}
                {preferenceText(m.registration_tracks)}
                {m.registration_interest
                  ? ` · Specific interest: ${preferenceText(m.registration_interest)}`
                  : ""}
              </p>
              {m.intention?.problem_statement && (
                <details>
                  <summary>
                    Problem statement · {m.intention.review_status}
                  </summary>
                  <h3 style={{ fontSize: 14 }}>
                    {m.intention.problem_title || "Problem statement"}
                  </h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {m.intention.problem_statement}
                  </p>
                  {m.intention.review_feedback && (
                    <p>Feedback: {m.intention.review_feedback}</p>
                  )}
                  <form
                    style={{ display: "grid", gap: 10 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = valuesOf(e.currentTarget);
                      run(
                        () =>
                          reviewCapProblem(
                            cohortId,
                            m.user_id,
                            v.status,
                            v.feedback,
                          ),
                        "Problem statement review saved",
                      );
                    }}
                  >
                    <Select label="Review status" name="status">
                      <option>Reviewed</option>
                      <option>Changes requested</option>
                    </Select>
                    <Textarea
                      label="Review feedback"
                      name="feedback"
                      maxLength={20000}
                      defaultValue={m.intention.review_feedback || ""}
                    />
                    <button className="ta-btn ta-btn-primary" disabled={busy}>
                      Save review
                    </button>
                  </form>
                </details>
              )}
            </article>
          ))}
      </div>
      {workspace.isAdmin && (
        <details style={{ marginTop: 18 }}>
          <summary>Manage track and skill choices</summary>
          <p className="ta-sub">
            Disabling a choice preserves existing learner selections.
          </p>
          <form
            style={{ display: "grid", gap: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              const v = valuesOf(e.currentTarget);
              run(
                () => saveCapSkillOption(cohortId, v.track, v.skill),
                "Skill choice saved",
              );
            }}
          >
            <div style={grid}>
              <Input label="Track name" name="track" required maxLength={120} />
              <Input
                label="Specific skill name"
                name="skill"
                required
                maxLength={160}
              />
            </div>
            <button className="ta-btn ta-btn-primary" disabled={busy}>
              Add skill choice
            </button>
          </form>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {workspace.skillOptions.map((o) => (
              <div
                className="ta-row ta-between"
                style={{ flexWrap: "wrap", gap: 8 }}
                key={o.id}
              >
                <span>
                  {o.track} → {o.skill} {!o.is_active && "(disabled)"}
                </span>
                <button
                  className="ta-btn ta-btn-outline ta-btn-sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        saveCapSkillOption(
                          cohortId,
                          o.track,
                          o.skill,
                          !o.is_active,
                        ),
                      "Skill choice updated",
                    )
                  }
                >
                  {o.is_active ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </details>
  );
}
function TeamForm({ team, workspace, cohortId, run, busy, onDone }) {
  const staff = workspace.canManage;
  return (
    <form
      style={{ display: "grid", gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        const v = valuesOf(e.currentTarget);
        const patch = {
          name: v.name,
          project_title: v.project,
          problem_statement: v.problem,
          technologies: (v.tech || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };
        if (team)
          Object.assign(patch, {
            id: team.id,
            github_url: v.repo || null,
            demo_url: v.demo || null,
            presentation_url: v.slides || null,
          });
        if (team && staff)
          Object.assign(patch, {
            phase: v.phase,
            mentor_id: v.mentor || null,
            demo_day_status: v.status,
            final_score: v.score === "" ? null : Number(v.score),
            judges_feedback: v.feedback || "",
          });
        if (!team) Object.assign(patch, { cohort_id: cohortId, role: v.role });
        run(
          async () => {
            await saveCapTeam(patch);
            onDone?.();
          },
          team ? "Team updated" : "Team created",
        );
      }}
    >
      <div style={grid}>
        <Input
          label="Team name"
          name="name"
          required
          maxLength={200}
          defaultValue={team?.name || ""}
        />
        <Input
          label="Project title"
          name="project"
          required
          maxLength={300}
          defaultValue={team?.project_title || ""}
        />
      </div>
      <Textarea
        label="Problem statement"
        name="problem"
        maxLength={20000}
        defaultValue={team?.problem_statement || ""}
      />
      <Input
        label="Technologies (comma separated)"
        name="tech"
        defaultValue={(team?.technologies || []).join(", ")}
      />
      {!team && !staff && (
        <Input
          label="Your team role"
          name="role"
          required
          maxLength={120}
          placeholder="e.g. Frontend developer"
        />
      )}
      {team && (
        <>
          <Input
            label="Repository URL"
            name="repo"
            type="url"
            defaultValue={team.github_url || ""}
          />
          <Input
            label="Live demo URL"
            name="demo"
            type="url"
            defaultValue={team.demo_url || ""}
          />
          <Input
            label="Presentation URL"
            name="slides"
            type="url"
            defaultValue={team.presentation_url || ""}
          />
        </>
      )}
      {team && staff && (
        <>
          <div style={grid}>
            <Select label="Team phase" name="phase" defaultValue={team.phase}>
              <option value="LEARN">Learn</option>
              <option value="BUILD">Build</option>
              <option value="LAUNCH">Launch</option>
            </Select>
            <Select
              label="Assigned mentor"
              name="mentor"
              defaultValue={team.mentor_id || ""}
            >
              <option value="">Not assigned</option>
              {workspace.members
                .filter((m) => m.cohort_role === "instructor")
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name}
                  </option>
                ))}
            </Select>
            <Select
              label="Demo Day status"
              name="status"
              defaultValue={team.demo_day_status}
            >
              {[
                "Draft",
                "Pending Review",
                "Demo Day Ready",
                "Featured",
                "Completed",
                "Needs Revision",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input
              label="Final score (0–100, blank if unscored)"
              name="score"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={team.final_score ?? ""}
            />
          </div>
          <Textarea
            label="Judges’ feedback"
            name="feedback"
            defaultValue={team.judges_feedback || ""}
          />
        </>
      )}
      <button className="ta-btn ta-btn-primary" disabled={busy}>
        {team ? "Save team" : staff ? "Create team" : "Register & join team"}
      </button>
    </form>
  );
}
function TeamCard({ team, workspace, cohortId, userId, run, busy }) {
  const [editing, setEditing] = useState(false);
  const own = (team.members || []).find((m) => m.user_id === userId);
  return (
    <article className="ta-card" style={card}>
      <h3 style={{ marginTop: 0 }}>
        {team.name} {team.is_archived && "(archived)"}
      </h3>
      <strong>{team.project_title}</strong>
      <p>{team.problem_statement}</p>
      <p>
        Phase: {team.phase} · {team.demo_day_status}
      </p>
      <p>Mentor: {team.mentor_name || "Not assigned"}</p>
      <ul style={{ paddingLeft: 18 }}>
        {(team.members || []).map((m) => (
          <li key={m.user_id}>
            {m.name} · {m.role}{" "}
            {workspace.canManage && (
              <button
                className="ta-btn ta-btn-ghost ta-btn-sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => removeCapTeamMember(team.id, m.user_id),
                    "Team member removed",
                  )
                }
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <ProjectLinks team={team} />
      {workspace.canManage && !team.is_archived && (
        <details style={{ marginTop: 12 }}>
          <summary>Add or update team member</summary>
          <form
            style={{ display: "grid", gap: 10, marginTop: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              const v = valuesOf(e.currentTarget);
              run(
                () =>
                  joinCapTeam({
                    teamId: team.id,
                    userId: v.member,
                    role: v.role,
                  }),
                "Team member saved",
              );
            }}
          >
            <Select label="Cohort member" name="member" required>
              <option value="">Choose member</option>
              {workspace.members
                .filter((m) => m.cohort_role !== "instructor")
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name}
                  </option>
                ))}
            </Select>
            <Input label="Team role" name="role" required maxLength={120} />
            <button className="ta-btn ta-btn-primary" disabled={busy}>
              Save member
            </button>
          </form>
        </details>
      )}
      {!workspace.canManage && !own && !team.is_archived && (
        <form
          style={{ display: "grid", gap: 10, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            const v = valuesOf(e.currentTarget);
            run(
              () => joinCapTeam({ teamId: team.id, userId, role: v.role }),
              "Joined team",
            );
          }}
        >
          <Input label="Your team role" name="role" required maxLength={120} />
          <button className="ta-btn ta-btn-outline" disabled={busy}>
            Join team
          </button>
        </form>
      )}
      {(workspace.canManage || own) && (
        <button
          className="ta-btn ta-btn-outline"
          style={{ marginTop: 12 }}
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
        >
          {editing ? "Close editor" : "Edit project"}
        </button>
      )}
      {editing && (
        <div style={{ marginTop: 14 }}>
          <TeamForm
            team={team}
            workspace={workspace}
            cohortId={cohortId}
            run={run}
            busy={busy}
            onDone={() => setEditing(false)}
          />
        </div>
      )}
      {workspace.canManage && (
        <button
          className="ta-btn ta-btn-ghost"
          disabled={busy}
          onClick={() =>
            run(
              () =>
                saveCapTeam({ id: team.id, is_archived: !team.is_archived }),
              team.is_archived ? "Team restored" : "Team archived",
            )
          }
        >
          {team.is_archived ? "Restore team" : "Archive team"}
        </button>
      )}
    </article>
  );
}
export default function CapCohort3Screen({
  session,
  user,
  cohortId,
  cohortName,
  courses = [],
  push,
  showToast,
}) {
  const userId = session?.user?.id || user?.id;
  const query = useSupabaseQuery(
    () => fetchCapWorkspace(cohortId),
    [cohortId, userId],
    { blocksPage: false },
  );
  const [phase, setPhase] = useState("LEARN");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [creating, setCreating] = useState(false);
  async function run(action, success) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text: success });
      showToast?.(success);
      query.refetch();
    } catch (e) {
      setMessage({
        text: e.message || "Could not save. Please retry.",
        error: true,
      });
      showToast?.(e.message || "Could not save");
    } finally {
      setBusy(false);
    }
  }
  if (query.loading)
    return <LoadingSkeleton label="Loading CAP workspace" rows={3} />;
  if (query.error)
    return (
      <div className="ta-card" role="alert" style={card}>
        <p>{query.error}</p>
        <button className="ta-btn ta-btn-outline" onClick={query.refetch}>
          Retry CAP workspace
        </button>
      </div>
    );
  const workspace = query.data || {
    teams: [],
    checkins: [],
    intentions: [],
    skillOptions: [],
    members: [],
  };
  const own = workspace.intentions.find((i) => i.user_id === userId);
  const activeTeams = workspace.teams.filter((t) => !t.is_archived);
  return (
    <div
      className="cap-workspace"
      style={{ display: "grid", gap: 16, minWidth: 0 }}
    >
      <style>{`.cap-workspace .ta-row{display:flex;align-items:center;gap:8px}.cap-workspace .ta-between{justify-content:space-between}.cap-workspace .ta-sub{color:var(--text-3,#64748b);font-size:13px}.cap-workspace .ta-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 12px;border-radius:8px;border:1px solid var(--border,#e2e8f0);background:var(--surface,#fff);color:var(--text,#142747);font:inherit;font-size:13px;cursor:pointer}.cap-workspace .ta-btn-primary{background:var(--primary,#2563eb);color:#fff;border-color:transparent}.cap-workspace .ta-btn:disabled{opacity:.5;cursor:default}.cap-workspace .ta-input{padding:9px 10px;border:1px solid var(--border,#e2e8f0);border-radius:8px;background:var(--surface,#fff);color:var(--text,#142747);font:inherit}.cap-workspace input,.cap-workspace select,.cap-workspace textarea{width:100%;max-width:100%;box-sizing:border-box;min-height:40px}.cap-workspace h1{font-size:clamp(20px,3vw,26px)}.cap-workspace button{white-space:normal}.cap-workspace summary{cursor:pointer;font-weight:600;padding:8px 0}.cap-workspace form{min-width:0}.cap-workspace p{line-height:1.5}.cap-workspace .ta-row{min-width:0}@media(max-width:540px){.cap-workspace input,.cap-workspace select,.cap-workspace textarea{font-size:16px}}`}</style>
      <header
        className="ta-card"
        style={{ ...card, background: "#142747", color: "white" }}
      >
        <div style={{ fontSize: 12 }}>Career Acceleration Programme</div>
        <h1 style={{ margin: "8px 0" }}>
          {workspace.cohort?.name || cohortName || "Cohort programme"}
        </h1>
        <p style={{ margin: 0 }}>
          {workspace.canManage
            ? "Manage learner goals, project teams, mentors and reviews."
            : "Set your learning goal, develop your project and follow mentor feedback."}
        </p>
      </header>
      {message && (
        <div
          role={message.error ? "alert" : "status"}
          className="ta-card"
          style={card}
        >
          {message.text}
        </div>
      )}
      {workspace.canManage ? (
        <StaffGoals
          workspace={workspace}
          cohortId={cohortId}
          run={run}
          busy={busy}
        />
      ) : (
        <LearningGoal
          key={cohortId}
          cohortId={cohortId}
          workspace={workspace}
          userId={userId}
          run={run}
          busy={busy}
        />
      )}
      <nav
        aria-label="CAP programme sections"
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        {[
          ["LEARN", "Learn"],
          ["BUILD", "Build & teams"],
          ["LAUNCH", "Demo Day"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`ta-btn ${phase === key ? "ta-btn-primary" : "ta-btn-outline"}`}
            aria-pressed={phase === key}
            onClick={() => setPhase(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {phase === "LEARN" && (
        <>
          <section className="ta-card" style={card}>
            <h2 style={{ fontSize: 17, marginTop: 0 }}>Assigned curriculum</h2>
            {courses.length ? (
              courses.map((c) => (
                <div key={c.id} style={{ padding: "10px 0" }}>
                  <strong>{c.title}</strong>
                  {push && (
                    <button
                      className="ta-btn ta-btn-ghost"
                      onClick={() => push("courseDetail", { id: c.id })}
                    >
                      Open course
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p>
                No courses assigned to this cohort yet. An administrator can
                configure course assignments from the cohort page.
              </p>
            )}
          </section>
          {!workspace.canManage && (
            <section className="ta-card" style={card}>
              <h2 style={{ fontSize: 17, marginTop: 0 }}>
                Your problem statement
              </h2>
              <p>Status: {own?.review_status || "Not submitted"}</p>
              {own?.review_feedback && (
                <p>Staff feedback: {own.review_feedback}</p>
              )}
              <form
                style={{ display: "grid", gap: 12 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = valuesOf(e.currentTarget);
                  run(
                    () => saveCapProblem(cohortId, v.title, v.statement),
                    "Problem statement submitted for review",
                  );
                }}
              >
                <Input
                  label="Problem title"
                  name="title"
                  maxLength={300}
                  defaultValue={own?.problem_title || ""}
                />
                <Textarea
                  label="Problem statement"
                  name="statement"
                  required
                  maxLength={20000}
                  defaultValue={own?.problem_statement || ""}
                />
                <button className="ta-btn ta-btn-primary" disabled={busy}>
                  Submit problem statement
                </button>
              </form>
            </section>
          )}
        </>
      )}
      {phase === "BUILD" && (
        <>
          <div
            className="ta-row ta-between"
            style={{ flexWrap: "wrap", gap: 10 }}
          >
            <h2 style={{ fontSize: 18, margin: 0 }}>
              Project teams ({activeTeams.length})
            </h2>
            <button
              className="ta-btn ta-btn-primary"
              onClick={() => setCreating((v) => !v)}
              aria-expanded={creating}
            >
              {creating
                ? "Cancel new team"
                : workspace.canManage
                  ? "Create team"
                  : "Register team & project"}
            </button>
          </div>
          {creating && (
            <section className="ta-card" style={card}>
              <TeamForm
                workspace={workspace}
                cohortId={cohortId}
                run={run}
                busy={busy}
                onDone={() => setCreating(false)}
              />
            </section>
          )}
          {!workspace.teams.length && (
            <p>No teams registered in this cohort yet.</p>
          )}
          <div style={grid}>
            {workspace.teams
              .filter((t) => workspace.canManage || !t.is_archived)
              .map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  workspace={workspace}
                  cohortId={cohortId}
                  userId={userId}
                  run={run}
                  busy={busy}
                />
              ))}
          </div>
          <section className="ta-card" style={card}>
            <h2 style={{ fontSize: 17, marginTop: 0 }}>Mentorship check-ins</h2>
            {workspace.canManage && (
              <details>
                <summary>Log mentorship check-in</summary>
                <form
                  style={{ display: "grid", gap: 12 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = valuesOf(e.currentTarget);
                    run(
                      () =>
                        saveCapCheckin(v.team, {
                          ...v,
                          private: v.private === "on",
                        }),
                      "Mentorship check-in saved",
                    );
                  }}
                >
                  <div style={grid}>
                    <Select label="Team" name="team" required>
                      <option value="">Choose team</option>
                      {activeTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Check-in date"
                      name="date"
                      type="date"
                      required
                      defaultValue={new Date().toLocaleDateString("en-CA")}
                    />
                    <Select
                      label="Progress rating (1–5)"
                      name="rating"
                      defaultValue="3"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </Select>
                    <Input
                      label="Next check-in date"
                      name="nextDate"
                      type="date"
                    />
                  </div>
                  <Textarea
                    label="Progress notes"
                    name="notes"
                    required
                    maxLength={20000}
                  />
                  <Textarea label="Blockers" name="blockers" />
                  <Textarea label="Recommended next steps" name="actions" />
                  {workspace.isAdmin && (
                    <label>
                      <input
                        type="checkbox"
                        name="private"
                        style={{ width: "auto", minHeight: 0 }}
                      />{" "}
                      Private admin note
                    </label>
                  )}
                  <button
                    className="ta-btn ta-btn-primary"
                    disabled={busy || !activeTeams.length}
                  >
                    Save check-in
                  </button>
                </form>
              </details>
            )}
            {!workspace.checkins.length && (
              <p>No mentorship check-ins recorded yet.</p>
            )}
            {workspace.checkins.map((c) => (
              <article
                key={c.id}
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                  marginTop: 12,
                }}
              >
                <strong>
                  {c.team_name} · {c.mentor_name}
                </strong>
                <p>
                  {c.checkin_date} · Rating {c.progress_rating}/5{" "}
                  {c.is_private_admin && "· Private admin note"}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>{c.notes}</p>
                {c.issues_blockers && <p>Blockers: {c.issues_blockers}</p>}
                {c.recommended_actions && (
                  <p>Next steps: {c.recommended_actions}</p>
                )}
                {c.next_checkin_date && (
                  <p>Next check-in: {c.next_checkin_date}</p>
                )}
              </article>
            ))}
          </section>
        </>
      )}
      {phase === "LAUNCH" && (
        <section className="ta-card" style={card}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>
            Project submissions &amp; Demo Day reviews
          </h2>
          {!activeTeams.length && <p>No project submissions yet.</p>}
          <div style={grid}>
            {activeTeams.map((t) => (
              <article className="ta-card" key={t.id} style={card}>
                <h3>{t.project_title}</h3>
                <p>
                  {t.name} · {t.demo_day_status}
                </p>
                <p>
                  Final score:{" "}
                  {t.final_score == null
                    ? "Not scored"
                    : `${t.final_score}/100`}
                </p>
                <p>
                  {t.judges_feedback || "No judges’ feedback recorded yet."}
                </p>
                <ProjectLinks team={t} />
                {workspace.canManage && (
                  <details>
                    <summary>Edit review</summary>
                    <TeamForm
                      team={t}
                      workspace={workspace}
                      cohortId={cohortId}
                      run={run}
                      busy={busy}
                    />
                  </details>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
