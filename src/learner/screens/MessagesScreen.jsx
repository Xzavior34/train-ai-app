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
  const showThreadList = !isNarrow || !activeMentorThread;
  const showConversation = !isNarrow || !!activeMentorThread;

  return (
    <div className="tai-fade-in">
      <TopBar title="Direct Messages" sub="Chat with your instructor" onBack={back} />
      <div className="tai-card" style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "220px 1fr", minHeight: 440 }}>

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
            const isActive = activeMentorThread?.counterpartId === t.counterpartId;
            return (
              <div
                key={t.counterpartId}
                onClick={() => setActiveMentorThread(t)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: isActive ? "var(--surface)" : "transparent",
                  borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="tai-row tai-gap8">
                  <Avatar initials={initialsOf(t.name)} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="tai-row tai-between">
                      <span style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                      {t.unread > 0 && (
                        <span style={{ fontSize: 9.5, fontWeight: 800, background: "var(--primary)", color: "#fff", borderRadius: 99, padding: "1px 6px" }}>{t.unread}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.last}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Conversation */}
        {showConversation && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {!activeMentorThread ? (
            <div className="tai-empty" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              Select a conversation to start chatting.
            </div>
          ) : (
            <>
              <div className="tai-row tai-gap8" style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13.5 }}>
                {isNarrow && (
                  <button className="tai-iconbtn" style={{ marginLeft: -6 }} onClick={() => setActiveMentorThread(null)} aria-label="Back to conversations">
                    <ChevronLeft size={18} />
                  </button>
                )}
                {activeMentorThread.name}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 14 }} className="tai-col tai-gap10">
                {conversationLoading && <div className="tai-empty">Loading messages...</div>}
                {!conversationLoading && conversationMessages.length === 0 && <div className="tai-empty">No messages in this conversation yet. Say hello!</div>}
                {conversationMessages.map(m => {
                  const isMe = m.sender_id === session?.user?.id;
                  return (
                    <div key={m.id} className="tai-row tai-gap8" style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                      {!isMe && <Avatar initials={initialsOf(activeMentorThread.name)} size={28} />}
                      <div style={{
                        background: isMe ? "var(--primary)" : "var(--surface-2)",
                        color: isMe ? "#fff" : "var(--text)",
                        padding: "10px 14px", borderRadius: 14, fontSize: 13.5
                      }}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="tai-row tai-gap8" style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
                <input
                  className="tai-input" style={{ flex: 1 }} placeholder="Write a message..."
                  value={messageInput} onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSendMessage(); }}
                />
                <button className="tai-iconbtn" style={{ background: "var(--primary)", color: "#fff" }} onClick={handleSendMessage}>
                  <Send size={16} />
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
