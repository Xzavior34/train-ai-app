import React, { useState } from "react";
import { TopBar, StatTile, Avatar, optionLabel, optionValue, initialsOf, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Trophy, Flame, Zap, Award, Target, HelpCircle, CheckCircle2, ChevronRight,
  GraduationCap, Send, Bot, MessageSquare, BookOpen, Lightbulb,
  Code2, Briefcase, RefreshCw, Copy, Check, ArrowRight, ShieldCheck,
  History, MessageSquarePlus, Clock, ChevronDown, ChevronUp, Plus, Brain, TrendingUp
} from "lucide-react";
import { AIInsightsCard } from "../components/AIInsightsCard.jsx";

const COACH_PROMPT_PRESETS = [
  { label: "Explain Design Tokens simply", icon: Lightbulb, prompt: "Can you explain how design tokens and variables work in Figma and code with a clear analogy?" },
  { label: "Generate Spatial UI Quiz", icon: HelpCircle, prompt: "Generate a quick 3-question conceptual quiz on Spatial Computing and VisionOS design principles." },
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
}) {
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState("thread-1");
  const [chatThreads, setChatThreads] = useState([
    { id: "thread-1", title: "Design Tokens & Variable Governance", date: "Today, 02:40 PM", messagesCount: 6, snippet: "Can you explain how design tokens and variables work in Figma and code..." },
    { id: "thread-2", title: "RAG Pipeline vs Fine-Tuning Architectures", date: "Yesterday", messagesCount: 12, snippet: "What are the tradeoffs of using vector embeddings vs fine-tuning a base model..." },
    { id: "thread-3", title: "Spatial UI Gaze Padding in VisionOS", date: "Aug 18", messagesCount: 8, snippet: "Explain minimum 60pt gaze target bounding boxes in spatial computing..." },
    { id: "thread-4", title: "Prompt Caching & Multi-Modal API Cost Optimization", date: "Aug 15", messagesCount: 4, snippet: "How does prefix caching reduce latency in large context windows..." }
  ]);

  const currentQuiz = (quizzesQuery.data || []).find(q => q.id === quizTopic) || quizzesQuery.data?.[0];
  const questions = activeQuizSource === "ai" ? (aiQuiz?.questions || []) : (selectedQuizQuestionsQuery?.data || []);
  const currentQuestion = questions[quizIndex] || questions[0];

  function handleCopyText(id, text) {
    navigator.clipboard?.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
    showToast?.("Copied to clipboard!");
  }

  function handleStartNewChat() {
    const newThread = {
      id: `thread-${Date.now()}`,
      title: "New AI Learning Session",
      date: "Just now",
      messagesCount: 0,
      snippet: "New inquiry started..."
    };
    setChatThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    if (setCoachInput) setCoachInput("");
    showToast?.("Started new chat session");
  }

  function handleSelectThread(t) {
    setActiveThreadId(t.id);
    setShowHistory(false);
    showToast?.(`Loaded: ${t.title}`);
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
      {/* =========================================================================
          HERO COACH BANNER: Adaptive Liquid Glass AI Learning Co-Pilot
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card tai-hero-dark anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden",
          width: "100%",
          boxSizing: "border-box"
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
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 0, flex: "1 1 220px" }}>
            <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
              AI Learning Coach &amp; Quiz Arena
            </h1>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 580, lineHeight: 1.45 }}>
              Ask questions, debug code, and take interactive practice quizzes generated in real-time.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            {typeof credits === "number" && (
              <div className="tai-hero-subcard" style={{
                padding: "6px 12px", borderRadius: 8,
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <Zap size={13} color="#60A5FA" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{credits} credits</span>
              </div>
            )}

            <button
              className="tai-btn tai-btn-primary tai-btn-sm"
              onClick={onBuyCredits}
              style={{
                borderRadius: 8, fontWeight: 700, fontSize: 12,
                display: "inline-flex", alignItems: "center", gap: 5
              }}
            >
              <Plus size={13} /> Buy Credits
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB NAVIGATION STRIP
          ========================================================================= */}
      <div className="tai-scrollx" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, width: "100%", boxSizing: "border-box", gap: 8 }}>
        {[
          { k: "coach", label: "AI Coach & Tutor", icon: MessageSquare },
          { k: "quiz", label: "AI Quiz", icon: HelpCircle },
          { k: "insights", label: "Performance Insights", icon: TrendingUp },
        ].map(t => {
          const Icon = t.icon;
          const isActive = aiTab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setAiTab(t.k)}
              className={`tai-btn tai-btn-sm ${isActive ? "tai-btn-primary" : "tai-btn-outline"}`}
              style={{
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12.5,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}
            >
              <Icon size={14} />
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
              <span>Chat History ({chatThreads.length})</span>
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
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                transition: "all 0.15s ease"
              }}
            >
              <MessageSquarePlus size={14} />
              <span>New Conversation</span>
            </button>
          </div>

          {/* Expandable Chat History Drawer */}
          {showHistory && (
            <div className="tai-card tai-fade-in" style={{ padding: 16, borderRadius: 8, background: "var(--surface-3)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
                Recent AI Learning Sessions
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }}>
                {chatThreads.map(thread => {
                  const isSelected = activeThreadId === thread.id;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => handleSelectThread(thread)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: isSelected ? "var(--surface)" : "var(--surface-2)",
                        border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                        cursor: "pointer",
                        boxShadow: isSelected ? "0 4px 12px rgba(37, 99, 235, 0.12)" : "none",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div className="tai-row tai-between" style={{ marginBottom: 4, gap: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: isSelected ? "var(--primary)" : "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {thread.title}
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{thread.date}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {thread.snippet}
                      </div>
                      <div className="tai-row tai-between" style={{ marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
                        <span>{thread.messagesCount} messages</span>
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
              borderRadius: 10,
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
                <div style={{ width: 64, height: 64, borderRadius: 10, background: "var(--primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Brain size={28} color="var(--primary)" />
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
                    <Avatar initials={initialsOf(session?.user?.user_metadata?.full_name || session?.user?.email)} size={32} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>
                      <Bot size={16} />
                    </div>
                  )}

                  <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 4 }}>
                      {isUser ? "You" : "Train AI Coach"}
                    </div>

                    <div
                      style={{
                        background: isUser ? "#2563EB" : "var(--surface-3)",
                        color: isUser ? "#FFFFFF" : "var(--text)",
                        padding: "10px 14px",
                        borderRadius: isUser ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
                        fontSize: 13,
                        lineHeight: 1.55,
                        border: isUser ? "none" : "1px solid var(--border)",
                        whiteSpace: "pre-wrap"
                      }}
                    >
                      {m.content}
                    </div>

                    {!isUser && (
                      <div className="tai-row tai-gap6" style={{ marginTop: 4 }}>
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
                <div style={{ width: 32, height: 32, borderRadius: 6, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  <Bot size={16} />
                </div>
                <div style={{ background: "var(--surface-3)", padding: "8px 14px", borderRadius: 8, fontSize: 12, color: "var(--text-2)", fontStyle: "italic", border: "1px solid var(--border)" }}>
                  Analyzing question and synthesizing learning response...
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="tai-row tai-gap8" style={{ background: "var(--surface)", padding: 6, borderRadius: 8, border: "1px solid var(--border)" }}>
            <input
              type="text"
              placeholder="Ask your AI coach anything (e.g. explain variables, review my code, quiz my knowledge)..."
              value={coachInput}
              onChange={e => setCoachInput && setCoachInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !coachSending && coachInput?.trim()) onSendCoachMessage && onSendCoachMessage(); }}
              disabled={coachSending}
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontSize: 13, color: "var(--text)", padding: "6px 10px", fontFamily: "inherit"
              }}
            />

            <button
              className="tai-btn tai-btn-primary"
              disabled={coachSending || !coachInput?.trim()}
              onClick={() => onSendCoachMessage && onSendCoachMessage()}
              style={{ padding: "8px 14px", borderRadius: 6, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>Send</span>
              <Send size={14} />
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
              <div className="tai-card" style={{ padding: 24, borderRadius: 10 }}>
                <div className="tai-row tai-between" style={{ marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text)" }}>
                      AI Adaptive Assessment Generator
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
                      Generate custom quizzes tuned to your target skillset
                    </p>
                  </div>
                  <HelpCircle size={18} color="var(--primary)" />
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
                  style={{ width: "100%", padding: "12px 0", borderRadius: 10, fontWeight: 800 }}
                  disabled={quizGenerating || !quizGenTopic?.trim()}
                  onClick={handleGenerateQuiz}
                >
                  {quizGenerating ? "Generating AI Quiz..." : "Generate & Start AI Quiz"}
                </button>
              </div>

              {/* Today's Daily Stats Card */}
              <div className="tai-col tai-gap14">
                <div className="tai-card" style={{ padding: 20, borderRadius: 10 }}>
                  <div className="tai-row tai-between" style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Assessment Daily Goal</span>
                    <Tag tone="primary">1 of 3 Done</Tag>
                  </div>
                  <ProgressBar value={33} height={8} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
                    <Trophy size={20} color="#F59E0B" />
                    <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8, color: "var(--text)" }}>340 XP</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Total Quiz Points</div>
                  </div>

                  <div className="tai-card" style={{ padding: 18, borderRadius: 10 }}>
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
            <div className="tai-card" style={{ padding: 28, borderRadius: 10, maxWidth: 680, margin: "0 auto", width: "100%" }}>
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
                        borderRadius: 10,
                        border: selected ? "2px solid #2563EB" : "1.5px solid var(--border)",
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
                      {selected ? <CheckCircle2 size={18} color="#2563EB" /> : <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--border)" }} />}
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
            <div className="tai-card" style={{ maxWidth: 680, margin: "0 auto", width: "100%", padding: 32, textAlign: "center", borderRadius: 10 }}>
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
                    <div key={i} style={{ background: "var(--surface-3)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
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
                style={{ width: "100%", padding: "12px 0", borderRadius: 8, fontWeight: 800 }}
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
            <div key={i} className="tai-card" style={{ padding: 16, borderRadius: 8 }}>
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

          <div className="tai-card" style={{ padding: 22, borderRadius: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 12px" }}>
              Skill Strengths &amp; Growth Opportunities
            </h3>

            {weakAreas.length === 0 ? (
              <div className="tai-empty">Great performance! All quiz averages are currently above 75%.</div>
            ) : (
              <div className="tai-col tai-gap10">
                {weakAreas.map((w, i) => (
                  <div key={i} className="tai-row tai-between" style={{ padding: "12px 14px", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
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

