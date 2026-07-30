import React from "react";
import { TopBar, Avatar, timeAgo, initialsOf } from "../components/LearnerUI.jsx";
import { Send } from "lucide-react";

export function MessagesScreen({
  activeMentorThread, setActiveMentorThread, messageInput, setMessageInput,
  conversationMessages, conversationLoading, session, user, back, showToast, sendMentorMessage
}) {
  return (
    <div className="tai-fade-in">
      <TopBar title="Direct Messages" sub="Chat with mentors & tutors" onBack={back} />
      <div className="tai-card" style={{ minHeight: 400, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflowY: "auto" }} className="tai-col tai-gap10">
          {conversationMessages.length === 0 && <div className="tai-empty">No messages in this conversation yet.</div>}
          {conversationMessages.map(m => {
            const isMe = m.sender_id === session?.user?.id;
            return (
              <div key={m.id} className="tai-row tai-gap8" style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                {!isMe && <Avatar initials={initialsOf(m.user_profiles?.display_name)} size={28} />}
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
        <div className="tai-row tai-gap8 tai-mt12">
          <input className="tai-input" style={{ flex: 1 }} placeholder="Write a message..." value={messageInput} onChange={e => setMessageInput(e.target.value)}
            onKeyDown={async e => {
              if (e.key === "Enter" && messageInput.trim() && activeMentorThread && session?.user?.id) {
                await sendMentorMessage({ senderId: session.user.id, receiverId: activeMentorThread.counterpartId, content: messageInput.trim() });
                setMessageInput(""); showToast("Message sent!");
              }
            }} />
          <button className="tai-iconbtn" style={{ background: "var(--primary)", color: "#fff" }} onClick={async () => {
            if (!messageInput.trim() || !activeMentorThread || !session?.user?.id) return;
            await sendMentorMessage({ senderId: session.user.id, receiverId: activeMentorThread.counterpartId, content: messageInput.trim() });
            setMessageInput(""); showToast("Message sent!");
          }}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
