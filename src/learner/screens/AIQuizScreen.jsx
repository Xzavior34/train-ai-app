import React, { useState } from "react";
import { TopBar, StatTile, Avatar, optionLabel, optionValue, initialsOf, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Trophy, Flame, Zap, Award, Target, HelpCircle, CheckCircle2, ChevronRight,
  GraduationCap, Sparkles, Send, Bot, MessageSquare, BookOpen, Lightbulb,
  Code2, Briefcase, RefreshCw, Copy, Check, Star, ArrowRight, ShieldCheck,
  History, MessageSquarePlus, Clock, ChevronDown, ChevronUp
} from "lucide-react";
import { AIInsightsCard } from "../components/AIInsightsCard.jsx";

const COACH_PROMPT_PRESETS = [
  { label: "Explain Design Tokens simply", icon: Lightbulb, prompt: "Can you explain how design tokens and variables work in Figma and code with a clear analogy?" },
  { label: "Generate Spatial UI Quiz", icon: Zap, prompt: "Generate a quick 3-question conceptual quiz on Spatial Computing and VisionOS design principles." },
  { label: "Review UX Deliverable", icon: CheckCircle2, prompt: "What are the most critical components of an enterprise UX audit report before client presentation?" },
  { label: "Full-Stack AI Study Plan", icon: Target, prompt: "Create a focused 5-day study schedule for mastering LangChain, vector databases, and RAG architectures." },
  { label: "Senior Designer Interview Prep", icon: Briefcase, prompt: "Ask me a realistic behavioral interview question for a Senior Product Designer role, then critique my answer." }
];

export function AIQuizScreen({
  orgId,
  aiTab = "coach", setAiTab,
  quizTopic, setQuizTopic,
  quizGenTopic, setQuizGenTopic, quizGenDifficulty, setQuizGenDifficulty,
  quizGenQuestionCount, setQuizGenQuestionCount, quizGenerating, setQuizGenerating, quizGenError, setQuizGenError,
  aiQuiz, setAiQuiz, activeQuizSource, setActiveQuizSource,
  quizStage, setQuizStage, quizIndex, setQuizIndex,
  quizAnswers, setQuizAnswers, quizSelected, setQuizSelected, quizShowHint, setQuizShowHint,
  quizResult, setQuizResult, quizSubmitting, setQuizSubmitting, quizzesQuery, selectedQuizQuestionsQuery,
  quizAttemptsQuery, quizHistory, weakAreas, session, showToast, submitQuizAnswers,
  generateAIQuiz, awardAIQuizCompletionPoints, credits, consumeCredit, onBuyCredits,
  coachMessages = [], coachMessagesLoading, coachInput, setCoachInput, coachSending, onSendCoachMessage,
  // Real AI Coach threads. The sidebar used to be a useState array of four
  // invented conversations, and selecting one only fired a toast - it never
  // loaded any messages. These come from the learner's own
  // `ai_conversations` rows (with message counts and first-message snippets
  // from `ai_messages`, see fetchMyAIConversations); selecting one switches
  // the conversation the message list and the composer are bound to.
  aiConversations = [], aiConversationsLoading = false,
  activeConversationId = null, onSelectConversation, onStartNewConversation,
}) {
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const currentQuiz = (quizzesQuery.data || []).find(q => q.id === quizTopic) || quizzesQuery.data?.[0];
  const questions = activeQuizSource === "ai" ? (aiQuiz?.questions || []) : (selectedQuizQuestionsQuery?.data || []);
  const currentQuestion = questions[quizIndex] || questions[0];

  function handleCopyText(id, text) {
    navigator.clipboard?.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
    showToast?.("Copied to clipboard!");
  }

  // Writes a real ai_conversations row (createAIConversation) and switches
  // to it, instead of prepending a fabricated thread to local state that
  // vanished on reload.
  async function handleStartNewChat() {
    if (setCoachInput) setCoachInput("");
    const created = await onStartNewConversation?.();
    if (created === false) showToast?.("Couldn't start a new chat session.");
  }

  function handleSelectThread(t) {
    onSelectConversation?.(t.id);
    setShowHistory(false);
  }

  // ai_conversations only stores created_at, so the label is that timestamp
  // (or the thread's last message) rather than an invented "Today, 02:40 PM".
  function formatThreadDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function handleQuickPromptClick(promptText) {
    if (setCoachInput) {
      setCoachInput(promptText);
    }
  }

  async function handleGenerateQuiz() {
    if (!quizGenTopic || !quizGenTopic.trim()) {
      setQuizGenError("Enter a topic to generate a quiz on.");
      return;
    }
    if (typeof credits === "number" && credits <= 0) {
      setQuizGenError("You're out of AI credits for today. Buy more or wait for tomorrow's reset.");
      return;
    }
    setQuizGenError(null);
    setQuizGenerating(true);
    try {
      const res = await generateAIQuiz({
        topic: quizGenTopic.trim(),
        difficulty: quizGenDifficulty,
        questionCount: quizGenQuestionCount,
      });
      if (res?.error || !res?.assessment) {
        setQuizGenError(res?.error || "Couldn't generate a quiz on that topic, try rephrasing or a different topic.");
        return;
      }
      const assessment = res.assessment;
      const mappedQuestions = (assessment.questions || []).map((q, idx) => ({
        id: q.id || `ai_q_${idx + 1}`,
        question_text: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "",
        difficulty: q.difficulty,
        points: 10,
      }));
      if (!mappedQuestions.length) {
        setQuizGenError("Couldn't generate a quiz on that topic, try rephrasing or a different topic.");
        return;
      }
      if (consumeCredit) consumeCredit(1);
      setAiQuiz({ ...assessment, questions: mappedQuestions });
      setActiveQuizSource("ai");
      setQuizStage("active");
      setQuizIndex(0);
      setQuizAnswers({});
      setQuizResult(null);
    } catch (e) {
      setQuizGenError(e?.message || "Couldn't generate a quiz on that topic, try rephrasing or a different topic.");
    } finally {
      setQuizGenerating(false);
    }
  }

  async function handleFinishQuiz() {
    if (activeQuizSource === "ai") {
      if (!aiQuiz || questions.length === 0) return;
      setQuizSubmitting(true);
      try {
        let correctCount = 0;
        const details = questions.map((q) => {
          const selected = quizAnswers[q.id];
          const correctOption = q.options[q.correctAnswer];
          const isCorrect = selected != null && selected === correctOption;
          if (isCorrect) correctCount++;
          return { question: q.question_text, selected: selected ?? null, correctOption, isCorrect, explanation: q.explanation };
        });
        const total = questions.length;
        const score = total ? Math.round((correctCount / total) * 100) : 0;
        const totalPoints = correctCount * 10;
        setQuizResult({ score, correct_count: correctCount, total, total_points: totalPoints, details, isAIQuiz: true, topic: aiQuiz.title });
        setQuizStage("result");
        if (session?.user?.id && totalPoints > 0) {
          awardAIQuizCompletionPoints(session.user.id, totalPoints);
        }
        showToast(`Quiz completed! Score: ${score}%`);
      } finally {
        setQuizSubmitting(false);
      }
      return;
    }

    if (!quizTopic) return;
    setQuizSubmitting(true);
    try {
      const res = await submitQuizAnswers(quizTopic, quizAnswers, session?.user?.id);
      setQuizResult(res);
      setQuizStage("result");
      quizAttemptsQuery.refetch();
      showToast(`Quiz completed! Score: ${Math.round(res?.score || 0)}%`);
    } catch (e) {
      showToast(`Could not submit quiz: ${e.message || e}`);
    } finally {
      setQuizSubmitting(false);
    }
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO COACH BANNER: Clean & Optimized AI Learning Co-Pilot
          ========================================================================= */}
      <div style={{
        borderRadius: 18,
        background: "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.88) 100%)",
        color: "#FFFFFF",
        padding: "clamp(16px, 2.5vw, 24px)",
        boxShadow: "0 10px 28px -4px rgba(15, 23, 42, 0.35)",
        border: "1px solid rgba(99, 102, 241, 0.35)",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box"
      }}>
        {/* Background Stock Photo with Overlay */}
        <img
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1400&auto=format&fit=crop&q=85"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.28, zIndex: 0
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.82) 55%, rgba(15,23,42,0.65) 100%)",
          zIndex: 0
        }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 0, flex: "1 1 220px" }}>
            <h1 style={{ fontSize: "clamp(19px, 2.2vw, 24px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              AI Learning Coach
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 580, lineHeight: 1.45 }}>
              Ask questions, debug code, and take interactive practice quizzes.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            {typeof credits === "number" && (
              <div style={{
                background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)", padding: "6px 10px", borderRadius: 10,
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <Sparkles size={13} color="#818CF8" />
                <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff" }}>{credits} credits</span>
              </div>
            )}

            <button
              className="tai-btn"
              onClick={onBuyCredits}
              style={{
                background: "linear-gradient(135deg, #F59E0B, #EA580C)",
                color: "#FFFFFF", border: "none", fontWeight: 800, fontSize: 12,
                padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
                display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0
              }}
            >
              <span>+ Get Credits</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB NAVIGATION STRIP
          ========================================================================= */}
      <div className="tai-scrollx" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, width: "100%", boxSizing: "border-box" }}>
        {[
          { k: "coach", label: "AI Coach & Tutor", icon: MessageSquare },
          { k: "quiz", label: "Adaptive Quizzes", icon: Zap },
          { k: "history", label: "Session History", icon: BookOpen },
          { k: "insights", label: "Performance Insights", icon: Sparkles },
        ].map(t => {
          const Icon = t.icon;
          const isActive = aiTab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setAiTab(t.k)}
              style={{
                padding: "8px 16px",
                borderRadius: 12,
                border: isActive ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                background: isActive ? "var(--primary-tint)" : "var(--surface)",
                color: isActive ? "var(--primary)" : "var(--text-2)",
                fontWeight: isActive ? 800 : 600,
                fontSize: 12.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                whiteSpace: "nowrap",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = "var(--primary-light)"; e.currentTarget.style.color = "var(--text)"; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; } }}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: AI COACH INTERACTIVE TUTOR CHAT
          ========================================================================= */}
      {aiTab === "coach" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", minWidth: 0, boxSizing: "border-box" }}>

          {/* Chat History Toolbar & New Thread CTA */}
          <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={() => setShowHistory(prev => !prev)}
              style={{
                background: showHistory ? "var(--primary-tint)" : "var(--surface)",
                border: showHistory ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                color: showHistory ? "var(--primary)" : "var(--text)",
                padding: "7px 14px",
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <History size={14} color={showHistory ? "var(--primary)" : "var(--text-3)"} />
              <span>Chat History ({aiConversations.length})</span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <button
              onClick={handleStartNewChat}
              style={{
                background: "var(--primary)",
                border: "none",
                color: "#FFFFFF",
                padding: "7px 14px",
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
                transition: "all 0.15s ease"
              }}
            >
              <MessageSquarePlus size={14} />
              <span>New Conversation</span>
            </button>
          </div>

          {/* Expandable Chat History Drawer */}
          {showHistory && (
            <div className="tai-card tai-fade-in" style={{ padding: 16, borderRadius: 14, background: "var(--surface-3)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
                Recent AI Learning Sessions
              </div>

              {aiConversationsLoading && (
                <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Loading your conversations…</div>
              )}
              {!aiConversationsLoading && aiConversations.length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                  No AI Coach conversations yet. Ask a question below to start one.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {aiConversations.map(thread => {
                  const isSelected = activeConversationId === thread.id;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => handleSelectThread(thread)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: isSelected ? "var(--surface)" : "var(--surface-2)",
                        border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                        cursor: "pointer",
                        boxShadow: isSelected ? "0 4px 12px rgba(79, 70, 229, 0.12)" : "none",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div className="tai-row tai-between" style={{ marginBottom: 4, gap: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: isSelected ? "var(--primary)" : "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {thread.title || "Untitled conversation"}
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
                          {formatThreadDate(thread.lastMessageAt || thread.created_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {/* First real user message in the thread; an empty
                            thread shows nothing rather than filler copy. */}
                        {thread.snippet || ""}
                      </div>
                      <div className="tai-row tai-between" style={{ marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
                        <span>{thread.messagesCount ?? 0} message{(thread.messagesCount ?? 0) === 1 ? "" : "s"}</span>
                        {isSelected && <Tag tone="primary">Active Thread</Tag>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Prompt Starters Strip */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
              Suggested Inquiries &amp; Guided Exercises
            </div>
            <div className="tai-scrollx" style={{ paddingBottom: 4, width: "100%", boxSizing: "border-box" }}>
              {COACH_PROMPT_PRESETS.map((cp, idx) => {
                const Icon = cp.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleQuickPromptClick(cp.prompt)}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "7px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                  >
                    <Icon size={13} color="var(--primary)" />
                    <span>{cp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Chat Thread Window */}
          <div
            className="tai-card"
            style={{
              minHeight: 340,
              maxHeight: 520,
              overflowY: "auto",
              padding: "18px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            {coachMessagesLoading && coachMessages.length === 0 && (
              <div className="tai-empty">Connecting with Train AI neural model...</div>
            )}

            {!coachMessagesLoading && coachMessages.length === 0 && (
              <div style={{ textAlign: "center", margin: "auto", maxWidth: 460, padding: 30 }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Sparkles size={28} color="var(--primary)" />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>
                  How can I assist your learning today?
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5, margin: 0 }}>
                  Ask me to break down any complex concept, review your assignments, generate flashcards, or prepare a study schedule.
                </p>
              </div>
            )}

            {coachMessages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    flexDirection: isUser ? "row-reverse" : "row"
                  }}
                >
                  {isUser ? (
                    <Avatar initials={initialsOf(session?.user?.user_metadata?.full_name || session?.user?.email)} size={34} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #4F46E5, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)" }}>
                      <Bot size={18} />
                    </div>
                  )}

                  <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 4 }}>
                      {isUser ? "You" : "Train AI Coach"}
                    </div>

                    <div
                      style={{
                        background: isUser ? "#4F46E5" : "var(--surface-3)",
                        color: isUser ? "#FFFFFF" : "var(--text)",
                        padding: "14px 18px",
                        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        border: isUser ? "none" : "1px solid var(--border)",
                        boxShadow: isUser ? "0 4px 14px rgba(79, 70, 229, 0.25)" : "none",
                        whiteSpace: "pre-wrap"
                      }}
                    >
                      {m.content}
                    </div>

                    {!isUser && (
                      <div className="tai-row tai-gap6" style={{ marginTop: 6 }}>
                        <button
                          onClick={() => handleCopyText(m.id, m.content)}
                          style={{
                            background: "transparent", border: "none", color: "var(--text-3)",
                            fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                            transition: "color .15s ease"
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}
                        >
                          {copiedMessageId === m.id ? <Check key="check" size={12} color="var(--success)" className="anim-pop" /> : <Copy key="copy" size={12} />}
                          <span>{copiedMessageId === m.id ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {coachSending && (
              <div className="tai-row tai-gap10" style={{ alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #4F46E5, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  <Bot size={18} />
                </div>
                <div style={{ background: "var(--surface-3)", padding: "10px 16px", borderRadius: 14, fontSize: 12.5, color: "var(--text-2)", fontStyle: "italic", border: "1px solid var(--border)" }}>
                  Analyzing question and synthesizing learning response...
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="tai-row tai-gap10" style={{ background: "var(--surface)", padding: 8, borderRadius: 16, border: "1.5px solid var(--border)", boxShadow: "0 4px 16px rgba(15,23,42,0.03)" }}>
            <input
              type="text"
              placeholder="Ask your AI coach anything (e.g. explain variables, review my code, quiz my knowledge)..."
              value={coachInput}
              onChange={e => setCoachInput && setCoachInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !coachSending && coachInput?.trim()) onSendCoachMessage && onSendCoachMessage(); }}
              disabled={coachSending}
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontSize: 13.5, color: "var(--text)", padding: "8px 12px", fontFamily: "inherit"
              }}
            />

            <button
              className="tai-btn tai-btn-primary"
              disabled={coachSending || !coachInput?.trim()}
              onClick={() => onSendCoachMessage && onSendCoachMessage()}
              style={{ padding: "10px 18px", borderRadius: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>Send</span>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ADAPTIVE QUIZZES & ASSESSMENTS
          ========================================================================= */}
      {aiTab === "quiz" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {quizStage === "setup" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
              
              {/* Generator Configuration Card */}
              <div className="tai-card" style={{ padding: 24, borderRadius: 18 }}>
                <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                      AI Adaptive Assessment Generator
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
                      Generate custom quizzes tuned to your target skillset
                    </p>
                  </div>
                  <Sparkles size={18} color="var(--primary)" />
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
                  Topic or Skill
                </div>
                <input
                  className="tai-input"
                  placeholder="e.g. Figma Variables, LangChain RAG, VisionOS Depth..."
                  value={quizGenTopic}
                  onChange={e => setQuizGenTopic(e.target.value)}
                  disabled={quizGenerating}
                  style={{ height: 42, fontSize: 13.5, marginBottom: 14 }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>
                      Difficulty Level
                    </div>
                    <select
                      className="tai-input"
                      value={quizGenDifficulty}
                      onChange={e => setQuizGenDifficulty(e.target.value)}
                      disabled={quizGenerating}
                      style={{ height: 42, fontSize: 13 }}
                    >
                      <option value="easy">Beginner / Novice</option>
                      <option value="medium">Intermediate</option>
                      <option value="hard">Advanced / Master</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>
                      Question Count
                    </div>
                    <select
                      className="tai-input"
                      value={quizGenQuestionCount}
                      onChange={e => setQuizGenQuestionCount(Number(e.target.value))}
                      disabled={quizGenerating}
                      style={{ height: 42, fontSize: 13 }}
                    >
                      <option value={3}>3 Questions (Quick)</option>
                      <option value={5}>5 Questions (Standard)</option>
                      <option value={8}>8 Questions (Deep)</option>
                      <option value={10}>10 Questions (Mastery)</option>
                    </select>
                  </div>
                </div>

                {quizGenError && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--danger-bg)", color: "var(--danger)", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
                    {quizGenError}
                  </div>
                )}

                <button
                  className="tai-btn tai-btn-primary"
                  style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 800 }}
                  disabled={quizGenerating || !quizGenTopic?.trim()}
                  onClick={handleGenerateQuiz}
                >
                  {quizGenerating ? "Generating Adaptive Quiz..." : "⚡ Generate & Start Quiz"}
                </button>
              </div>

              {/* Today's Daily Stats Card */}
              <div className="tai-col tai-gap14">
                <div className="tai-card" style={{ padding: 20, borderRadius: 18 }}>
                  <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Assessment Daily Goal</span>
                    <Tag tone="primary">1 of 3 Done</Tag>
                  </div>
                  <ProgressBar value={33} height={8} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="tai-card" style={{ padding: 18, borderRadius: 16 }}>
                    <Trophy size={20} color="#F59E0B" />
                    <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8, color: "var(--text)" }}>340 XP</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Total Quiz Points</div>
                  </div>

                  <div className="tai-card" style={{ padding: 18, borderRadius: 16 }}>
                    <Flame size={20} color="#EF4444" />
                    <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8, color: "var(--text)" }}>8 Days</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Practice Streak</div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ACTIVE QUIZ VIEW */}
          {quizStage === "active" && currentQuestion && (
            <div className="tai-card" style={{ padding: 28, borderRadius: 20, maxWidth: 680, margin: "0 auto", width: "100%" }}>
              <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase" }}>
                  Question {quizIndex + 1} of {questions.length}
                </span>
                <span className="tai-tag">{currentQuestion.points || 10} pts</span>
              </div>

              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", lineHeight: 1.4, marginBottom: 20 }}>
                {currentQuestion.question_text}
              </div>

              <div className="tai-col tai-gap10">
                {(currentQuestion.options || []).map((opt, i) => {
                  const val = optionValue(opt);
                  const selected = quizAnswers[currentQuestion.id] === val;
                  return (
                    <div
                      key={i}
                      className="tai-card-hover"
                      style={{
                        padding: "14px 18px",
                        borderRadius: 12,
                        border: selected ? "2px solid #4F46E5" : "1.5px solid var(--border)",
                        background: selected ? "var(--primary-tint)" : "var(--surface)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                      onClick={() => setQuizAnswers(prev => ({ ...prev, [currentQuestion.id]: val }))}
                    >
                      <span style={{ fontSize: 14, fontWeight: selected ? 800 : 500, color: selected ? "var(--primary)" : "var(--text)" }}>
                        {optionLabel(opt)}
                      </span>
                      {selected ? <CheckCircle2 size={18} color="#4F46E5" /> : <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--border)" }} />}
                    </div>
                  );
                })}
              </div>

              <div className="tai-row tai-between" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                {quizIndex > 0 ? (
                  <button className="tai-btn tai-btn-outline" onClick={() => setQuizIndex(i => i - 1)}>Previous</button>
                ) : <div />}

                {quizIndex < questions.length - 1 ? (
                  <button className="tai-btn tai-btn-primary" onClick={() => setQuizIndex(i => i + 1)}>
                    Next Question <ChevronRight size={16} />
                  </button>
                ) : (
                  <button className="tai-btn tai-btn-primary" disabled={quizSubmitting} onClick={handleFinishQuiz}>
                    Submit All Answers
                  </button>
                )}
              </div>
            </div>
          )}

          {quizStage === "active" && !currentQuestion && (
            <div className="tai-empty">No questions available for this quiz.</div>
          )}

          {/* QUIZ RESULT VIEW */}
          {quizStage === "result" && quizResult && (
            <div className="tai-card" style={{ maxWidth: 680, margin: "0 auto", width: "100%", padding: 32, textAlign: "center", borderRadius: 20 }}>
              <Trophy size={54} color="#F59E0B" style={{ margin: "0 auto 12px" }} />
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", margin: "0 0 6px" }}>
                {Math.round(quizResult.score || 0)}% Score
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 20px" }}>
                Correct: {quizResult.correct_count}{quizResult.total != null ? ` / ${quizResult.total}` : ""} • Awarded +{quizResult.total_points || 0} XP
              </p>

              {quizResult.isAIQuiz && Array.isArray(quizResult.details) && (
                <div className="tai-col tai-gap10" style={{ textAlign: "left", marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", textTransform: "uppercase" }}>
                    Answer Breakdown
                  </div>
                  {quizResult.details.map((d, i) => (
                    <div key={i} style={{ background: "var(--surface-3)", padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 0 }}>{i + 1}. {d.question}</span>
                        <span style={{ flexShrink: 0, display: "flex", paddingTop: 1 }}>
                          {d.isCorrect ? <CheckCircle2 size={16} color="var(--success)" /> : <HelpCircle size={16} color="var(--danger)" />}
                        </span>
                      </div>
                      {!d.isCorrect && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Correct: {d.correctOption}</div>}
                      {d.explanation && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>{d.explanation}</div>}
                    </div>
                  ))}
                </div>
              )}

              <button
                className="tai-btn tai-btn-primary"
                style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 800 }}
                onClick={() => { setQuizStage("setup"); setAiQuiz(null); setActiveQuizSource("bank"); setQuizResult(null); }}
              >
                Take Another Assessment
              </button>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          TAB 3: SESSION HISTORY
          ========================================================================= */}
      {aiTab === "history" && (
        <div className="tai-col tai-gap12">
          {coachMessagesLoading && <div className="tai-empty">Loading history...</div>}
          {!coachMessagesLoading && coachMessages.length === 0 && (
            <div className="tai-empty">No conversation history yet. Start a session in the Coach tab!</div>
          )}
          {coachMessages.map((m, i) => (
            <div key={i} className="tai-card" style={{ padding: 16, borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 4 }}>
                {m.role === "user" ? "You" : "AI Coach"} • {m.created_at ? new Date(m.created_at).toLocaleString() : "Recent"}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5 }}>{m.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          TAB 4: PERFORMANCE INSIGHTS & WEAK AREA RADAR
          ========================================================================= */}
      {aiTab === "insights" && (
        <div className="tai-col tai-gap16">
          <AIInsightsCard session={session} credits={credits} consumeCredit={consumeCredit} onBuyCredits={onBuyCredits} orgId={orgId} />

          <div className="tai-card" style={{ padding: 22, borderRadius: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 12px" }}>
              Skill Strengths &amp; Growth Opportunities
            </h3>

            {weakAreas.length === 0 ? (
              <div className="tai-empty">Great performance! All quiz averages are currently above 75%.</div>
            ) : (
              <div className="tai-col tai-gap10">
                {weakAreas.map((w, i) => (
                  <div key={i} className="tai-row tai-between" style={{ padding: "12px 14px", background: "var(--surface-3)", borderRadius: 12, border: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.topic}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{w.note}</div>
                    </div>
                    <Tag tone="warning">{w.mastery}% Mastery</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

