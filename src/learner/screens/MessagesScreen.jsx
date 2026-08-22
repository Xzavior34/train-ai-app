import React, { useState, useEffect } from "react";
import { TopBar, Avatar, initialsOf } from "../components/LearnerUI.jsx";
import { Send, ChevronLeft } from "lucide-react";

function useIsNarrow(breakpoint = 640) {
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

export function MessagesScreen({
  activeMentorThread, setActiveMentorThread, messageInput, setMessageInput,
  messageThreads = [], threadsLoading, conversationMessages = [], conversationLoading,
  session, back, handleSendMessage
}) {
  const isNarrow = useIsNarrow();
  const [localInput, setLocalInput] = useState("");

  const currentThread = activeMentorThread;

  const showThreadList = !isNarrow || !activeMentorThread;
  const showConversation = !isNarrow || !!activeMentorThread;

  const currentMessages = conversationMessages || [];

  function handleSendLocal() {
    const text = messageInput !== undefined ? messageInput : localInput;
    if (!text || !text.trim()) return;

    if (handleSendMessage) {
      handleSendMessage();
    }

    if (setMessageInput) setMessageInput("");
    setLocalInput("");
  }

  return (
    <div className="tai-fade-in">
      <TopBar title="Direct Messages" sub="Chat with your instructor" onBack={back} />
      <div className="tai-card" style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "260px 1fr", minHeight: 480 }}>

        {/* Thread list */}
        {showThreadList && (
        <div style={{ borderRight: isNarrow ? "none" : "1px solid var(--border)", background: "var(--surface-2)", overflowY: "auto" }}>
          {threadsLoading && <div className="tai-empty" style={{ padding: 16, fontSize: 12.5 }}>Loading...</div>}
          {!threadsLoading && messageThreads.length === 0 && (
            <div className="tai-empty" style={{ padding: 16, fontSize: 12.5 }}>
              No conversations yet. Message an instructor from Community or Instructors to start one.
            </div>
          )}
          {messageThreads.map(t => {
            const isActive = currentThread?.counterpartId === t.counterpartId;
            return (
              <div
                key={t.counterpartId}
                onClick={() => setActiveMentorThread ? setActiveMentorThread(t) : null}
                style={{
                  padding: "12px 14px",
                  cursor: "pointer",
                  background: isActive ? "var(--surface)" : "transparent",
                  borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                  borderBottom: "1px solid var(--border)",
                  transition: "background .16s ease"
                }}
              >
                <div className="tai-row tai-gap10">
                  <Avatar initials={initialsOf(t.name)} size={36} src={t.avatar} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="tai-row tai-between">
                      <span style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{t.name}</span>
                      {t.unread > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 800, background: "var(--primary)", color: "#fff", borderRadius: 99, padding: "2px 7px" }}>{t.unread}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{t.last}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Conversation */}
        {showConversation && (
        <div style={{ display: "flex", flexDirection: "column", background: "var(--surface)" }}>
          {!currentThread ? (
            <div className="tai-empty" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              Select a conversation to start chatting.
            </div>
          ) : (
            <>
              <div className="tai-row tai-between" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
                <div className="tai-row tai-gap10">
                  {isNarrow && (
                    <button className="tai-iconbtn" style={{ marginLeft: -6 }} onClick={() => setActiveMentorThread(null)} aria-label="Back to conversations">
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <Avatar initials={initialsOf(currentThread.name)} size={32} src={currentThread.avatar} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{currentThread.name}</div>
                    <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 700 }}>● Online • Instructor</div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 18 }} className="tai-col tai-gap12">
                {conversationLoading && <div className="tai-empty">Loading messages...</div>}
                {!conversationLoading && currentMessages.length === 0 && <div className="tai-empty">No messages in this conversation yet. Say hello!</div>}
                {currentMessages.map((m, idx) => {
                  const isMe = m.sender_id === session?.user?.id || m.sender_id === "me";
                  return (
                    <div key={m.id || idx} className="tai-row tai-gap10" style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%", flexDirection: isMe ? "row-reverse" : "row" }}>
                      {!isMe && <Avatar initials={initialsOf(currentThread.name)} size={28} src={currentThread.avatar} />}
                      <div style={{
                        background: isMe ? "var(--primary)" : "var(--surface-2)",
                        color: isMe ? "#fff" : "var(--text)",
                        padding: "10px 14px", borderRadius: 14, fontSize: 13.5,
                        lineHeight: 1.4,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
                      }}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="tai-row tai-gap10" style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <input
                  className="tai-input" style={{ flex: 1, background: "var(--surface)" }}
                  placeholder={`Reply to ${currentThread.name}...`}
                  value={messageInput !== undefined ? messageInput : localInput}
                  onChange={e => setMessageInput ? setMessageInput(e.target.value) : setLocalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSendLocal(); }}
                />
                <button className="tai-btn tai-btn-primary" style={{ padding: "0 18px" }} onClick={handleSendLocal}>
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
