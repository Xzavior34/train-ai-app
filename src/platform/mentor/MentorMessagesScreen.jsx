import React, { useState, useEffect, useRef, useContext } from "react";
import { TopBar, Avatar, Tag, ToastContext } from "../components/PlatformUI.jsx";
import { Send, Search, BookOpen, CheckCheck, X, ChevronLeft } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMentorMessageThreads, sendMentorMessage, fetchAllPlatformLearners, fetchOrgInstructorsMonitor } from "../../lib/api/platform.js";
import { fetchMentorMessageThread, markMentorMessagesRead } from "../../lib/api/schemaHelper.js";

function useIsNarrow(breakpoint = 720) {
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

export function MentorMessagesScreen({ userId, mentorId, orgSelector, selectedLearnerForChat, setScreen, orgId }) {
  const showToast = useContext(ToastContext);
  const isNarrow = useIsNarrow();

  // Real conversations this mentor already has
  const threadsQuery = useSupabaseQuery(async () => userId ? fetchMentorMessageThreads(userId) : [], [userId]);
  const threads = threadsQuery.data || [];

  // All platform learners, so an instructor can search & message any learner
  const menteesQuery = useSupabaseQuery(async () => fetchAllPlatformLearners(), []);
  const mentees = menteesQuery.data || [];
  // Fellow Instructors - confirmed directly against the real 1.0
  // reference codebase (FellowMentors.tsx). The RLS on mentor_messages
  // already permits this (mm_insert_sender, 0108_messaging_restriction.sql,
  // requires only that EITHER party has the mentor role - an instructor
  // sending to another instructor already satisfies it on its own) - this
  // only needed the discovery UI, reusing the exact same generic
  // messaging functions already used for mentor-learner chat, not a new
  // messaging system.
  const instructorsQuery = useSupabaseQuery(async () => (orgId ? fetchOrgInstructorsMonitor(orgId) : []), [orgId]);
  const fellowInstructors = (instructorsQuery.data || [])
    .filter((m) => m.user_id && m.user_id !== userId)
    .map((m) => ({ id: m.user_id, name: m.display_name, initials: (m.display_name || "I").slice(0, 2).toUpperCase() }));

  const threadIds = new Set(threads.map(t => t.id));
  const contacts = [
    ...threads,
    ...mentees
      .filter(m => !threadIds.has(m.id))
      .map(m => ({ id: m.id, name: m.name, initials: m.initials, last: null, time: null, unread: 0 })),
    ...fellowInstructors
      .filter(m => !threadIds.has(m.id))
      .map(m => ({ id: m.id, name: `${m.name} (Instructor)`, initials: m.initials, last: null, time: null, unread: 0 })),
  ];

  const [searchLearner, setSearchLearner] = useState("");
  const [activeContactId, setActiveContactId] = useState(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (selectedLearnerForChat?.id) setActiveContactId(selectedLearnerForChat.id);
  }, [selectedLearnerForChat]);

  useEffect(() => {
    if (!activeContactId && contacts.length > 0) setActiveContactId(contacts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadsQuery.loading, menteesQuery.loading]);

  const activeContact = contacts.find(c => c.id === activeContactId) ||
    (selectedLearnerForChat ? { id: selectedLearnerForChat.id, name: selectedLearnerForChat.name, initials: selectedLearnerForChat.initials } : null);

  const conversationQuery = useSupabaseQuery(async () => {
    if (!userId || !activeContact?.id) return [];
    return fetchMentorMessageThread(userId, activeContact.id);
  }, [userId, activeContact?.id]);

  const activeMessages = conversationQuery.data || [];

  useEffect(() => {
    if (userId && activeContact?.id) {
      markMentorMessagesRead(userId, activeContact.id).then(() => threadsQuery.refetch());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeContact?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchLearner.toLowerCase())
  );

  async function handleSendMessage() {
    if (!input.trim() || !activeContact?.id || !userId) return;
    try {
      await sendMentorMessage(userId, activeContact.id, input.trim());
      setInput("");
      conversationQuery.refetch();
      threadsQuery.refetch();
    } catch (e) {
      showToast(e.message || "Could not send message.");
    }
  }

  return (
    <div className="ta-fade">
      <TopBar title="Instructor Direct Messages" sub="Find learners and communicate directly across all active courses" orgSelector={orgSelector} />

      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-purple" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Direct Mentorship Messaging
              </h1>
              <p className="ta-hero-desc">
                Provide 1:1 guidance, answer assignment queries in real-time, and collaborate with fellow academy instructors.
              </p>
            </div>
          </div>
        </div>

        <div className="ta-card" style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "320px 1fr", minHeight: 600 }}>

          {/* Left Sidebar: Find Learners & Conversation List */}
          {(!isNarrow || !activeContact) && (
          <div style={{ borderRight: isNarrow ? "none" : "1px solid var(--border)", background: "var(--surface-3)", display: "flex", flexDirection: "column" }}>

            {/* Search Bar for Finding Learners */}
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              <div className="ta-search" style={{ width: "100%", background: "var(--surface-3)" }}>
                <Search size={15} color="var(--text-3)" />
                <input
                  type="text"
                  placeholder="Find learner by name..."
                  value={searchLearner}
                  onChange={(e) => setSearchLearner(e.target.value)}
                  style={{ border: "none", background: "transparent", width: "100%", fontSize: 12.5, color: "var(--text)", outline: "none" }}
                />
                {searchLearner && (
                  <X size={13} color="var(--text-3)" style={{ cursor: "pointer" }} onClick={() => setSearchLearner("")} />
                )}
              </div>
            </div>

            {/* Learner List */}
            <div style={{ flex: 1, overflowY: "auto" }} className="anim-stagger">
              {(threadsQuery.loading || menteesQuery.loading || instructorsQuery.loading) && (
                <div className="ta-empty" style={{ fontSize: 12.5, padding: 24 }}>Loading conversations...</div>
              )}
              {!threadsQuery.loading && !menteesQuery.loading && contacts.length === 0 && (
                <div className="ta-empty" style={{ fontSize: 12.5, padding: 24 }}>
                  No learners found on the platform yet.
                </div>
              )}
              {!threadsQuery.loading && !menteesQuery.loading && contacts.length > 0 && filteredContacts.length === 0 && (
                <div className="ta-empty" style={{ fontSize: 12.5, padding: 24 }}>
                  No learners found matching "{searchLearner}"
                </div>
              )}
              {filteredContacts.map(contact => {
                const isActive = activeContact?.id === contact.id;
                return (
                  <div
                    key={contact.id}
                    onClick={() => setActiveContactId(contact.id)}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--border)",
                      background: isActive ? "var(--surface)" : "transparent",
                      borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div className="ta-row ta-between">
                      <div className="ta-row ta-gap10" style={{ flex: 1, minWidth: 0 }}>
                        <Avatar initials={contact.initials} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="ta-row ta-between">
                            <span style={{ fontWeight: isActive ? 700 : 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {contact.name}
                            </span>
                            {contact.time && <span style={{ fontSize: 10.5, color: "var(--text-3)", marginLeft: 6 }}>{contact.time}</span>}
                          </div>
                          <div className="ta-row ta-between" style={{ marginTop: 2 }}>
                            <span style={{ fontSize: 11.5, color: contact.last ? "var(--text-2)" : "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: contact.last ? "normal" : "italic" }}>
                              {contact.last || "No messages yet. Say hello!"}
                            </span>
                            {contact.unread > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 800, background: "var(--primary)", color: "#fff", borderRadius: 99, padding: "1px 6px", marginLeft: 6 }}>
                                {contact.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Right Main Chat Thread Workspace */}
          {(!isNarrow || !!activeContact) && (activeContact ? (
            <div style={{ display: "flex", flexDirection: "column", background: "var(--surface)" }}>

              {/* Header */}
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--surface)", flexWrap: "wrap" }}>
                <div className="ta-row ta-gap12" style={{ minWidth: 0, flex: "1 1 160px" }}>
                  {isNarrow && (
                    <button className="ta-btn ta-btn-outline ta-btn-sm" style={{ padding: 8, flexShrink: 0 }} onClick={() => setActiveContactId(null)} aria-label="Back to conversations">
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <Avatar initials={activeContact.initials} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{activeContact.name}</span>
                  </div>
                </div>

                {setScreen && (
                  <button className="ta-btn ta-btn-outline ta-btn-sm" style={{ flexShrink: 0 }} onClick={() => setScreen("mentees")}>
                    <BookOpen size={14} /> View Progress
                  </button>
                )}
              </div>

              {/* Chat History */}
              <div style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, background: "var(--surface-3)" }}>
                <div style={{ textAlign: "center", margin: "8px 0" }}>
                  <span style={{ fontSize: 11, color: "var(--text-3)", background: "var(--surface)", padding: "3px 10px", borderRadius: 99, border: "1px solid var(--border)" }}>
                    Instructor Direct Message Channel
                  </span>
                </div>

                {conversationQuery.loading && (
                  <div className="ta-empty" style={{ fontSize: 12.5 }}>Loading messages...</div>
                )}

                {!conversationQuery.loading && activeMessages.length === 0 && (
                  <div className="ta-empty" style={{ fontSize: 12.5 }}>No messages in this conversation yet. Send the first one below.</div>
                )}

                {activeMessages.map((msg) => {
                  const isMentor = msg.sender_id === userId;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isMentor ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "70%",
                          padding: "10px 14px",
                          borderRadius: isMentor ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                          background: isMentor ? "var(--primary)" : "var(--surface)",
                          color: isMentor ? "#fff" : "var(--text)",
                          border: isMentor ? "none" : "1px solid var(--border)",
                          boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
                        }}
                      >
                        <div style={{ fontSize: 13.5, lineHeight: 1.4, wordBreak: "break-word" }}>{msg.content}</div>
                        <div
                          style={{
                            fontSize: 10,
                            marginTop: 4,
                            textAlign: "right",
                            color: isMentor ? "rgba(255,255,255,0.75)" : "var(--text-3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 4
                          }}
                        >
                          <span>{new Date(msg.created_at).toLocaleString()}</span>
                          {isMentor && msg.is_read && <CheckCheck size={12} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composition Input */}
              <div style={{ padding: 14, background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
                <div className="ta-row ta-gap8">
                  <input
                    className="ta-input"
                    placeholder={`Write a message to ${activeContact.name}...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                    style={{ flex: 1, padding: "10px 14px", fontSize: 13.5 }}
                  />
                  <button
                    className="ta-btn ta-btn-primary"
                    onClick={handleSendMessage}
                    style={{ padding: "10px 18px" }}
                  >
                    <Send size={15} /> Send
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="ta-empty" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(threadsQuery.loading || menteesQuery.loading || instructorsQuery.loading) ? "Loading..." : "Search for a learner on the left to start a conversation."}
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
