import React, { useState, useEffect } from "react";
import { TopBar, Avatar, initialsOf } from "../components/LearnerUI.jsx";
import { Send, ChevronLeft, Search, X, MessageSquare, CheckCheck, Users } from "lucide-react";

function useIsNarrow(breakpoint = 680) {
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
  const [searchThread, setSearchThread] = useState("");

  const currentThread = activeMentorThread;

  const showThreadList = !isNarrow || !activeMentorThread;
  const showConversation = !isNarrow || !!activeMentorThread;

  const currentMessages = conversationMessages || [];

  const filteredThreads = messageThreads.filter(t =>
    t.name?.toLowerCase().includes(searchThread.toLowerCase()) ||
    t.last?.toLowerCase().includes(searchThread.toLowerCase())
  );

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
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <TopBar title="Direct Messages" sub="Chat with your instructor" onBack={back} />

      {/* =========================================================================
          HERO BANNER: Direct Messages & Mentorship
          ========================================================================= */}
      {/* =========================================================================
          HERO BANNER: Direct Messages & Mentorship (Adaptive Liquid Glass)
          ========================================================================= */}
      <div
        className="tai-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "clamp(18px, 2.5vw, 24px)",
          boxShadow: "inset 0 1px 0 var(--glass-specular), 0 10px 30px -10px rgba(0,0,0,0.10)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div className="tai-row tai-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="tai-row tai-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{
                background: "var(--primary-tint)", color: "var(--primary)",
                border: "1px solid var(--border)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
              }}>
                <Send size={13} color="var(--primary)" /> 1-ON-1 INSTRUCTOR CHAT
              </span>
              <span style={{
                background: "rgba(16, 185, 129, 0.12)", color: "#10B981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
              }}>
                {messageThreads.length} CONVERSATION{messageThreads.length === 1 ? "" : "S"}
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", color: "var(--text)", lineHeight: 1.2 }}>
              Direct Messages &amp; Mentorship
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, maxWidth: 640, lineHeight: 1.45 }}>
              Ask project questions, receive code review guidance, and communicate directly with your academy instructors.
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MESSAGING INTERFACE
          ========================================================================= */}
      <div className="tai-card" style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "300px 1fr", minHeight: 540, borderRadius: 10 }}>

        {/* Thread list */}
        {showThreadList && (
        <div style={{ borderRight: isNarrow ? "none" : "1px solid var(--border)", background: "var(--surface-3)", display: "flex", flexDirection: "column" }}>
          
          {/* Thread Search Bar */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={14} color="var(--text-3)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Find conversation..."
                value={searchThread}
                onChange={(e) => setSearchThread(e.target.value)}
                style={{
                  width: "100%", height: 34, paddingLeft: 32, paddingRight: 28,
                  borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)",
                  fontSize: 12.5, color: "var(--text)", outline: "none"
                }}
              />
              {searchThread && (
                <button
                  type="button"
                  onClick={() => setSearchThread("")}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center"
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {threadsLoading && <div className="tai-empty" style={{ padding: 24, fontSize: 12.5 }}>Loading conversations...</div>}
            {!threadsLoading && messageThreads.length === 0 && (
              <div className="tai-empty" style={{ padding: 24, fontSize: 12.5 }}>
                No conversations yet. Message an instructor from Community or Instructors to start one.
              </div>
            )}
            {!threadsLoading && messageThreads.length > 0 && filteredThreads.length === 0 && (
              <div className="tai-empty" style={{ padding: 24, fontSize: 12.5 }}>
                No conversations matched "{searchThread}".
              </div>
            )}
            {filteredThreads.map(t => {
              const isActive = currentThread?.counterpartId === t.counterpartId;
              return (
                <div
                  key={t.counterpartId}
                  onClick={() => setActiveMentorThread ? setActiveMentorThread(t) : null}
                  style={{
                    padding: "12px 14px",
                    cursor: "pointer",
                    background: isActive ? "var(--surface)" : "transparent",
                    borderLeft: isActive ? "3px solid #4F46E5" : "3px solid transparent",
                    borderBottom: "1px solid var(--border)",
                    transition: "background .15s ease"
                  }}
                >
                  <div className="tai-row tai-gap10">
                    <Avatar initials={initialsOf(t.name)} size={36} src={t.avatar} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="tai-row tai-between">
                        <span style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{t.name}</span>
                        {t.unread > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, background: "#4F46E5", color: "#fff", borderRadius: 99, padding: "2px 7px" }}>{t.unread}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{t.last || "No messages yet"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Conversation Area */}
        {showConversation && (
        <div style={{ display: "flex", flexDirection: "column", background: "var(--surface)", height: "100%" }}>
          {!currentThread ? (
            <div className="tai-empty" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <MessageSquare size={22} color="var(--text-3)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Select an Instructor Conversation</div>
              <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>Choose a thread from the left to view messages and ask questions.</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="tai-row tai-between" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                  {isNarrow && (
                    <button className="tai-iconbtn" style={{ marginLeft: -6 }} onClick={() => setActiveMentorThread(null)} aria-label="Back to conversations">
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <Avatar initials={initialsOf(currentThread.name)} size={34} src={currentThread.avatar} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{currentThread.name}</div>
                    <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} /> Verified Instructor
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Stream */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }} className="tai-col tai-gap12">
                {conversationLoading && <div className="tai-empty">Loading messages...</div>}
                {!conversationLoading && currentMessages.length === 0 && (
                  <div className="tai-empty" style={{ padding: "32px 0", textAlign: "center" }}>
                    No messages in this conversation yet. Send a message to start the conversation!
                  </div>
                )}
                {currentMessages.map((m, idx) => {
                  const isMe = m.sender_id === session?.user?.id || m.sender_id === "me";
                  return (
                    <div key={m.id || idx} className="tai-row tai-gap10" style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%", flexDirection: isMe ? "row-reverse" : "row" }}>
                      {!isMe && <Avatar initials={initialsOf(currentThread.name)} size={28} src={currentThread.avatar} />}
                      <div style={{
                        background: isMe ? "#4F46E5" : "var(--surface-2)",
                        color: isMe ? "#FFFFFF" : "var(--text)",
                        padding: "10px 14px", borderRadius: 10, fontSize: 13.5,
                        lineHeight: 1.45,
                        boxShadow: isMe ? "0 1px 4px rgba(79, 70, 229, 0.15)" : "none"
                      }}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input Bar */}
              <div className="tai-row tai-gap10" style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", alignItems: "center" }}>
                <input
                  className="tai-input"
                  style={{ flex: 1, background: "var(--surface)", height: 38, borderRadius: 8, fontSize: 13 }}
                  placeholder={`Reply to ${currentThread.name}...`}
                  value={messageInput !== undefined ? messageInput : localInput}
                  onChange={e => setMessageInput ? setMessageInput(e.target.value) : setLocalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSendLocal(); }}
                />
                <button
                  className="tai-btn tai-btn-primary"
                  style={{ height: 38, padding: "0 16px", borderRadius: 8, background: "#4F46E5", color: "#FFFFFF", fontWeight: 700 }}
                  onClick={handleSendLocal}
                >
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
