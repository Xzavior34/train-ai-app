import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function ScrollableContent({ children, label, className, style, tabList = false }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const element = ref.current;
    const update = () => setEdges({ left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 });
    update();
    element.addEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); };
  }, [children]);
  return <div style={{ minWidth: 0, maxWidth: "100%", ...style }}>
    {(edges.left || edges.right) && <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 6 }}>
      <button type="button" className="ta-iconbtn" aria-label={`Scroll ${label} left`} disabled={!edges.left} onClick={() => ref.current.scrollBy({ left: -Math.max(180, ref.current.clientWidth * .7), behavior: "smooth" })}><ChevronLeft size={16} /></button>
      <button type="button" className="ta-iconbtn" aria-label={`Scroll ${label} right`} disabled={!edges.right} onClick={() => ref.current.scrollBy({ left: Math.max(180, ref.current.clientWidth * .7), behavior: "smooth" })}><ChevronRight size={16} /></button>
    </div>}
    <div ref={ref} className={className} role={tabList ? "tablist" : "region"} aria-label={label} tabIndex={tabList ? undefined : 0} style={{ overflowX: "auto", maxWidth: "100%", minWidth: 0, WebkitOverflowScrolling: "touch" }}>
      {children}
    </div>
  </div>;
}

export function ScrollableTabsBar({ activeTab, onChange, tabs }) {
  return <ScrollableContent label="People tabs" className="ta-tabs" tabList>
    {tabs.map((tab, index) => <button key={tab.k} type="button" role="tab" aria-selected={activeTab === tab.k} className={`ta-tab ${activeTab === tab.k ? "active" : ""}`} tabIndex={activeTab === tab.k ? 0 : -1} onClick={() => onChange(tab.k)} onKeyDown={event => {
      let next;
      if(event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if(event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      if(event.key === "Home") next = 0;
      if(event.key === "End") next = tabs.length - 1;
      if(next !== undefined) { event.preventDefault(); onChange(tabs[next].k); event.currentTarget.parentElement.children[next].focus(); }
    }} style={{ flexShrink: 0 }}>{tab.label}</button>)}
  </ScrollableContent>;
}

export function ScrollableTableWrap({ children, label = "Table", style }) {
  return <ScrollableContent label={label} className="ta-table-wrap" style={style}>{children}</ScrollableContent>;
}
