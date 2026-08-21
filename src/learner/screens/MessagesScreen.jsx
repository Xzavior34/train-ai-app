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

const DEFAULT_THREADS = [
  {
    counterpartId: "mentor-astrid",
    name: "Astrid Larsson",
    title: "Senior UI/UX & Design Systems Lead",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    last: "Great job on the Module 4 auto-layout assignment! Let's review tokens tonight.",
    unread: 1,
    history: [
      { id: "m-1", sender_id: "mentor-astrid", content: "Hi there! I reviewed your Figma auto-layout project. The nested auto-layouts are very clean." },
      { id: "m-2", sender_id: "me", content: "Thank you Astrid! I had a quick question regarding component variants vs boolean variables." },
      { id: "m-3", sender_id: "mentor-astrid", content: "Great question! Boolean variables are ideal for visibility toggles, whereas variants are better for distinct layout state changes." },
      { id: "m-4", sender_id: "mentor-astrid", content: "Great job on the Module 4 auto-layout assignment! Let's review tokens tonight." }
    ]
  },
  {
    counterpartId: "mentor-alex",
    name: "Alex Rivera",
    title: "AI Engineer & Full-Stack Architect",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    last: "Shared the updated vector embedding architecture template in the resources tab.",
    unread: 0,
    history: [
      { id: "m-1", sender_id: "mentor-alex", content: "Welcome to the Full-Stack GenAI track! Feel free to ping me if you encounter any vector DB index errors." },
      { id: "m-2", sender_id: "mentor-alex", content: "Shared the updated vector embedding architecture template in the resources tab." }
    ]
  },
  {
    counterpartId: "mentor-marcus",
    name: "Marcus Vance",
    title: "Autonomous Agent Specialist",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
    last: "Let me know when you finish the Prompt Engineering quiz!",
    unread: 0,
    history: [
      { id: "m-1", sender_id: "mentor-marcus", content: "Hey! Ready to dive into Axon AI autonomous agent workflows?" },
      { id: "m-2", sender_id: "mentor-marcus", content: "Let me know when you finish the Prompt Engineering quiz!" }
    ]
  }
];

export function MessagesScreen({
  activeMentorThread, setActiveMentorThread, messageInput, setMessageInput,
  messageThreads = [], threadsLoading, conversationMessages = [], conversationLoading,
  session, back, handleSendMessage
}) {
  const isNarrow = useIsNarrow();
  const [localCustomThreads, setLocalCustomThreads] = useState(DEFAULT_THREADS);
  const [localInput, setLocalInput] = useState("");

  const effectiveThreads = (messageThreads && messageThreads.length > 0) ? messageThreads : localCustomThreads;
  const currentThread = activeMentorThread || effectiveThreads[0];

  const showThreadList = !isNarrow || !activeMentorThread;
  const showConversation = !isNarrow || !!activeMentorThread;

  const currentMessages = (conversationMessages && conversationMessages.length > 0)
    ? conversationMessages
    : (currentThread?.history || []);

  function handleSendLocal() {
    const text = messageInput || localInput;
    if (!text || !text.trim()) return;

    if (handleSendMessage) {
      handleSendMessage();
    }

    if (currentThread) {
      const newMsg = {
        id: `msg-${Date.now()}`,
        sender_id: session?.user?.id || "me",
        content: text.trim()
      };
      setLocalCustomThreads(prev => prev.map(t => {
        if (t.counterpartId === currentThread.counterpartId) {
          return {
            ...t,
            last: text.trim(),
            history: [...(t.history || []), newMsg]
          };
        }
        return t;
      }));
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
          {effectiveThreads.map(t => {
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
