import React from "react";
import { TopBar, StatTile, Avatar, optionLabel, optionValue, initialsOf } from "../components/LearnerUI.jsx";
import { Trophy, Flame, Zap, Award, Target, HelpCircle, CheckCircle2, ChevronRight, GraduationCap, Sparkles, Send, Bot } from "lucide-react";
import { AIInsightsCard } from "../components/AIInsightsCard.jsx";

export function AIQuizScreen({
  orgId,
  aiTab, setAiTab,
  quizSourceMode, setQuizSourceMode,
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
  const currentQuiz = (quizzesQuery.data || []).find(q => q.id === quizTopic) || quizzesQuery.data?.[0];
  // Questions can come from two different sources: the real pre-authored
  // `quizzes`/`quiz_questions` bank (selectedQuizQuestionsQuery, DB rows), or
  // an in-memory AI-generated quiz (aiQuiz, not a DB row at all). Both are
  // normalized into the same { id, question_text, options, points } shape
  // by the time they land here (see handleGenerateQuiz below), so the
  // "active" quiz-taking UI further down doesn't need two versions.
  const questions = activeQuizSource === "ai" ? (aiQuiz?.questions || []) : (selectedQuizQuestionsQuery?.data || []);
  const currentQuestion = questions[quizIndex] || questions[0];

  function startBankQuiz() {
    if (!quizTopic) return;
    setActiveQuizSource("bank");
    setQuizStage("active");
    setQuizIndex(0);
    setQuizAnswers({});
    setQuizResult(null);
  }

  async function handleGenerateQuiz() {
    if (!quizGenTopic || !quizGenTopic.trim()) {
      setQuizGenError("Enter a topic to generate a quiz on.");
      return;
    }
    // AI quiz generation spends 1 daily AI credit, same as AI chat in the
    // reference app (src/components/ai/AIAssistantChat.tsx) - this app has
    // no server-side credits table (see useCredits.js), so the check and
    // deduction both happen here, client-side, before the edge-function call.
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
        // No DB row exists for an AI-generated quiz, so there's nothing to
        // submit to the real check_quiz_answers RPC (submitQuizAnswers below
        // needs a real quiz_id it can check answers against). This scores
        // the attempt client-side by comparing each selected answer to the
        // `correctAnswer` index the edge function already returned.
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
    <div className="tai-fade-in">
      <TopBar title="AI Coach" sub="Chat, adaptive quizzes & insights" />
      {typeof credits === "number" && (
        <div className="tai-card tai-mt10" style={{ padding: "10px 14px" }}>
          <div className="tai-row tai-between">
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>AI credits used today</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{Math.max(0, 10 - credits)} / 10</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>
            Resets daily. Not currently a per-learner allocation your admin configures - a flat daily allowance for every learner.
          </div>
        </div>
      )}
      <div className="tai-row tai-gap8" style={{ flexWrap: "wrap" }}>
        {[
          { k: "coach", label: "Coach" },
          { k: "quiz", label: "Quiz" },
          { k: "history", label: "History" },
          { k: "insights", label: "Insights" },
        ].map(t => (
          <div key={t.k} className={`tai-pill ${aiTab === t.k ? "tai-pill-active" : "tai-pill-inactive"}`} onClick={() => setAiTab(t.k)}>
            {t.label}
          </div>
        ))}
      </div>

      {aiTab === "coach" && (
        <div className="tai-mt16 tai-col tai-gap12">
          <div className="tai-card tai-col tai-gap10" style={{ minHeight: 320, maxHeight: 440, overflowY: "auto" }}>
            {coachMessagesLoading && coachMessages.length === 0 && (
              <div className="tai-empty">Loading your AI coach conversation...</div>
            )}
            {!coachMessagesLoading && coachMessages.length === 0 && (
              <div className="tai-empty">Ask your AI coach anything. A concept you're stuck on, a study plan, or feedback on your progress.</div>
            )}
            {coachMessages.map(m => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className="tai-row tai-gap10" style={{ alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row" }}>
                  {isUser ? (
                    <Avatar initials={initialsOf(session?.user?.user_metadata?.full_name || session?.user?.email)} size={28} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bot size={15} color="var(--primary)" />
                    </div>
                  )}
                  <div
                    className="tai-body-text"
                    style={{
                      background: isUser ? "var(--primary)" : "var(--surface-2)",
                      color: isUser ? "#fff" : "var(--text)",
                      padding: "10px 13px", borderRadius: 14, fontSize: 13, maxWidth: "78%",
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}
            {coachSending && <div className="tai-empty" style={{ padding: "6px 0" }}>Coach is typing...</div>}
          </div>
          <div className="tai-row tai-gap8">
            <input
              className="tai-input"
              style={{ flex: 1 }}
              placeholder="Ask your AI coach a question..."
              value={coachInput}
              onChange={e => setCoachInput && setCoachInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !coachSending) onSendCoachMessage && onSendCoachMessage(); }}
              disabled={coachSending}
            />
            <button className="tai-btn tai-btn-primary" disabled={coachSending || !coachInput?.trim()} onClick={() => onSendCoachMessage && onSendCoachMessage()}>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {aiTab === "quiz" && (
        <div className="tai-mt16">
          {quizStage === "setup" && (
            <div>
              <div className="tai-row tai-gap8">
                <div className={`tai-pill ${quizSourceMode === "bank" ? "tai-pill-active" : "tai-pill-inactive"}`} onClick={() => setQuizSourceMode("bank")}>
                  Practice Bank
                </div>
                <div className={`tai-pill ${quizSourceMode === "generate" ? "tai-pill-active" : "tai-pill-inactive"}`} onClick={() => setQuizSourceMode("generate")}>
                  Generate New Quiz
                </div>
              </div>

              {quizSourceMode === "bank" && (
                <div className="tai-card tai-mt12">
                  <div className="tai-label">Select topic</div>
                  {(quizzesQuery.data || []).length > 0 ? (
                    <select className="tai-input tai-mt8" value={quizTopic || ""} onChange={e => setQuizTopic(e.target.value)}>
                      {(quizzesQuery.data || []).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                    </select>
                  ) : (
                    <div className="tai-empty tai-mt8">No pre-authored quizzes are published yet. Try "Generate New Quiz" instead.</div>
                  )}
                  <button className="tai-btn tai-btn-primary tai-mt16" style={{ width: "100%" }} disabled={!quizTopic} onClick={startBankQuiz}>
                    <Zap size={16} /> Start practice session
                  </button>
                </div>
              )}

              {quizSourceMode === "generate" && (
                <div className="tai-card tai-mt12">
                  <div className="tai-label">Topic</div>
                  <input
                    className="tai-input tai-mt8"
                    placeholder="e.g. React hooks, negotiation tactics, SQL joins..."
                    value={quizGenTopic}
                    onChange={e => setQuizGenTopic(e.target.value)}
                    disabled={quizGenerating}
                  />

                  <div className="tai-label tai-mt16">Difficulty</div>
                  <select className="tai-input tai-mt8" value={quizGenDifficulty} onChange={e => setQuizGenDifficulty(e.target.value)} disabled={quizGenerating}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>

                  <div className="tai-label tai-mt16">Number of questions</div>
                  <select className="tai-input tai-mt8" value={quizGenQuestionCount} onChange={e => setQuizGenQuestionCount(Number(e.target.value))} disabled={quizGenerating}>
                    {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n} questions</option>)}
                  </select>

                  {quizGenError && (
                    <div className="tai-body-text tai-mt12" style={{ color: "var(--danger)" }}>{quizGenError}</div>
                  )}

                  {typeof credits === "number" && (
                    <div className="tai-body-text tai-mt8" style={{ color: "var(--text-2)", fontSize: 12 }}>
                      {credits} AI credit{credits === 1 ? "" : "s"} left today
                    </div>
                  )}

                  {typeof credits === "number" && credits <= 0 ? (
                    <button className="tai-btn tai-btn-primary tai-mt16" style={{ width: "100%" }} onClick={onBuyCredits}>
                      Buy more AI credits
                    </button>
                  ) : (
                    <button
                      className="tai-btn tai-btn-primary tai-mt16"
                      style={{ width: "100%" }}
                      disabled={quizGenerating || !quizGenTopic.trim()}
                      onClick={handleGenerateQuiz}
                    >
                      {quizGenerating ? "Generating your quiz..." : (<><Sparkles size={16} /> Generate quiz</>)}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {quizStage === "active" && currentQuestion && (
            <div className="tai-card">
              <div className="tai-row tai-between">
                <span className="tai-label">
                  {activeQuizSource === "ai" ? (aiQuiz?.title || "AI-generated quiz") : (currentQuiz?.title || "Quiz")}: Question {quizIndex + 1} of {questions.length}
                </span>
                <span className="tai-tag">{currentQuestion.points || 10} pts</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, marginTop: 12 }}>{currentQuestion.question_text}</div>
              <div className="tai-col tai-gap10 tai-mt16">
                {(currentQuestion.options || []).map((opt, i) => {
                  const val = optionValue(opt);
                  const selected = quizAnswers[currentQuestion.id] === val;
                  return (
                    <div key={i} className="tai-card" style={{ cursor: "pointer", background: selected ? "var(--surface-2)" : "var(--surface)", borderColor: selected ? "var(--primary)" : "var(--border)" }}
                      onClick={() => setQuizAnswers(prev => ({ ...prev, [currentQuestion.id]: val }))}>
                      <div className="tai-row tai-between">
                        <span style={{ fontSize: 13.5, fontWeight: selected ? 700 : 500 }}>{optionLabel(opt)}</span>
                        {selected && <CheckCircle2 size={16} color="var(--primary)" />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="tai-row tai-between tai-mt20">
                {quizIndex > 0 ? (
                  <button className="tai-btn tai-btn-outline tai-btn-sm" onClick={() => setQuizIndex(i => i - 1)}>Previous</button>
                ) : <div />}
                {quizIndex < questions.length - 1 ? (
                  <button className="tai-btn tai-btn-primary tai-btn-sm" onClick={() => setQuizIndex(i => i + 1)}>Next <ChevronRight size={14} /></button>
                ) : (
                  <button className="tai-btn tai-btn-primary tai-btn-sm" disabled={quizSubmitting} onClick={handleFinishQuiz}>Finish quiz</button>
                )}
              </div>
            </div>
          )}

          {quizStage === "active" && !currentQuestion && (
            <div className="tai-empty">No questions available for this quiz.</div>
          )}

          {quizStage === "result" && quizResult && (
            <div className="tai-card" style={{ textAlign: "center" }}>
              <Trophy size={48} color="var(--warning)" style={{ margin: "0 auto" }} />
              <div style={{ fontWeight: 800, fontSize: 22, marginTop: 12 }}>{Math.round(quizResult.score || 0)}% Score</div>
              <div className="tai-body-text tai-mt6">
                Correct: {quizResult.correct_count}{quizResult.total != null ? ` / ${quizResult.total}` : ""} • Earned +{quizResult.total_points || 0} XP
              </div>

              {quizResult.isAIQuiz && Array.isArray(quizResult.details) && (
                <div className="tai-col tai-gap10 tai-mt20" style={{ textAlign: "left" }}>
                  <div className="tai-title-sm">Review</div>
                  {quizResult.details.map((d, i) => (
                    <div key={i} className="tai-card" style={{ background: "var(--surface-2)" }}>
                      <div className="tai-row tai-between">
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{i + 1}. {d.question}</span>
                        {d.isCorrect ? <CheckCircle2 size={16} color="var(--success)" /> : <HelpCircle size={16} color="var(--danger)" />}
                      </div>
                      {!d.isCorrect && (
                        <div className="tai-body-text tai-mt6">Correct answer: {d.correctOption}</div>
                      )}
                      {d.explanation && <div className="tai-body-text tai-mt6" style={{ color: "var(--text-2)" }}>{d.explanation}</div>}
                    </div>
                  ))}
                </div>
              )}

              <button
                className="tai-btn tai-btn-primary tai-mt16"
                style={{ width: "100%" }}
                onClick={() => { setQuizStage("setup"); setAiQuiz(null); setActiveQuizSource("bank"); setQuizResult(null); }}
              >
                Try another quiz
              </button>
            </div>
          )}
        </div>
      )}

      {aiTab === "history" && (
        <div className="tai-mt16 tai-col tai-gap10">
          {quizHistory.length === 0 && <div className="tai-empty">No quiz attempts recorded yet.</div>}
          {quizHistory.map((h, i) => (
            <div key={i} className="tai-card tai-row tai-between">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{h.topic}</div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>{h.date}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)" }}>{h.score}%</div>
            </div>
          ))}
        </div>
      )}

      {aiTab === "insights" && (
        <div className="tai-mt16 tai-col tai-gap10">
          {/* The real "AI Insights" tool (PRD 7.2's third distinct AI tool,
              backed by the actual ai-insights edge function) - was
              previously only ever rendered inside AchievementsScreen.jsx,
              not here where the PRD explicitly places it, alongside AI
              Coach and Quiz Generator as one of the AI area's three tools.
              Kept the existing quiz-mastery breakdown below it too - a
              real, useful signal, just not what "AI Insights" means in the
              PRD. */}
          <AIInsightsCard session={session} credits={credits} consumeCredit={consumeCredit} onBuyCredits={onBuyCredits} orgId={orgId} />

          <div className="tai-title-sm tai-mt12">Skill Mastery (from your quizzes)</div>
          {weakAreas.length === 0 ? (
            <div className="tai-empty">Great job! All quiz average scores are above 70%.</div>
          ) : (
            weakAreas.map((w, i) => (
              <div key={i} className="tai-card">
                <div className="tai-row tai-between">
                  <span style={{ fontWeight: 700 }}>{w.topic}</span>
                  <span className="tai-tag" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>{w.mastery}% Avg</span>
                </div>
                <div className="tai-body-text tai-mt6">{w.note}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
