import React, { useCallback, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { PageLoadingContext } from "./PageLoadingContext.js";
import { Skeleton, SkeletonCard, SkeletonCourseCard, SkeletonStatCard, SkeletonText } from "./Skeleton.jsx";

export function skeletonLayoutFor(screen = "") {
  if (/leaderboard/i.test(screen)) return "leaderboard";
  if (/message/i.test(screen)) return "messages";
  if (/dashboard|overview|home|workforce|analytics|Progress|achievement/i.test(screen)) return "dashboard";
  if (/coursebuilder|settings|branding|integrations|onboarding|roleaccess|access|profile/i.test(screen)) return "settings";
  if (/detail|lesson|^cohort$/i.test(screen)) return "detail";
  if (/content|courses|paths|tracks|studygroups|studyGroup|mentors/i.test(screen)) return "catalog";
  if (/community|feed|discussions/i.test(screen)) return "feed";
  return "table";
}

function LoadingRows({ rows = 6 }) {
  return <div className="tai-skeleton-rows">{Array.from({ length: rows }, (_, index) => <div key={index} className="tai-skeleton-list-row">
    <Skeleton width="34px" height="34px" borderRadius="50%" style={{ flexShrink: 0 }} />
    <SkeletonText lines={2} /><Skeleton width="15%" height="14px" />
  </div>)}</div>;
}

export function LoadingSkeleton({ label = "Loading content", rows = 3 }) {
  return <div className="tai-feature-skeleton" role="status" aria-label={label}>
    <span className="tai-loading-sr">{label}</span><LoadingRows rows={rows} />
  </div>;
}

export function PageSkeleton({ layout = "dashboard", label = "Loading page", padded = true, onOpenMenu }) {
  return <div className={`tai-page-skeleton ${padded ? "tai-page-skeleton-padded" : ""}`} data-skeleton-layout={layout} role="status" aria-label={label}>
    <span className="tai-loading-sr">{label}</span>
    <div className="tai-skeleton-page-heading">
      {onOpenMenu && <button type="button" className="tai-skeleton-menu" aria-label="Open navigation menu" onClick={onOpenMenu}><Menu size={20} /></button>}
      <Skeleton width="min(55%, 320px)" height="26px" /><Skeleton width="min(75%, 520px)" height="13px" />
    </div>
    <div className="tai-skeleton-hero"><Skeleton width="55%" height="24px" /><Skeleton width="75%" height="13px" />
      {layout === "leaderboard" && <div className="tai-skeleton-three">{[0, 1, 2].map(index => <SkeletonCard key={index} height={190} />)}</div>}
    </div>
    {layout === "dashboard" && <div className="tai-skeleton-stats">{[0, 1, 2, 3].map(index => <SkeletonStatCard key={index} />)}</div>}
    {!["dashboard", "leaderboard", "messages"].includes(layout) && <div className="tai-skeleton-toolbar"><Skeleton width="60%" height="38px" /><Skeleton width="110px" height="38px" /></div>}
    {layout === "catalog" ? <div className="tai-skeleton-three">{[0, 1, 2, 3, 4, 5].map(index => <SkeletonCourseCard key={index} />)}</div>
      : layout === "messages" ? <div className="tai-skeleton-message-layout"><SkeletonCard height={440} /><SkeletonCard height={440} /></div>
      : ["dashboard", "detail", "settings"].includes(layout) ? <div className="tai-skeleton-panels"><SkeletonCard height={260} /><SkeletonCard height={260} /><SkeletonCard height={190} /><SkeletonCard height={190} /></div>
      : <div className="tai-skeleton-surface"><LoadingRows rows={layout === "feed" ? 4 : 7} /></div>}
  </div>;
}

// Keep screens mounted while their initial queries run. Unmounting them would
// restart the requests. Later feature refreshes use their local skeletons and
// never hide a page containing an in-progress form or an open discussion.
export function PageLoadingBoundary({ children, screen, loading = false, padded = true, onOpenMenu }) {
  const pending = useRef(new Set());
  const finished = useRef(false);
  const [version, setVersion] = useState(0);
  const [initial, setInitial] = useState(true);
  const report = useCallback((id, busy) => {
    if (finished.current) return;
    const had = pending.current.has(id);
    if (busy) pending.current.add(id); else pending.current.delete(id);
    if (had !== busy) setVersion(value => value + 1);
  }, []);
  useEffect(() => {
    if (!loading && pending.current.size === 0) {
      // Allow dependent queries started by parent effects to report before
      // declaring the page ready (for example, course -> lessons -> progress).
      const frame = requestAnimationFrame(() => {
        if (pending.current.size === 0) {
          finished.current = true;
          setInitial(false);
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [version, loading]);
  return <PageLoadingContext.Provider value={report}>
    <div className="tai-screen-loading-boundary" aria-busy={initial}>
      {initial && <PageSkeleton layout={skeletonLayoutFor(screen)} padded={padded} onOpenMenu={onOpenMenu} />}
      <div className="ta-screen-content" hidden={initial}>{children}</div>
    </div>
  </PageLoadingContext.Provider>;
}
