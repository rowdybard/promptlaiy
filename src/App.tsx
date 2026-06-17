import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Code2,
  CreditCard,
  Flame,
  Gauge,
  Lightbulb,
  ListChecks,
  Lock,
  Mail,
  MousePointer2,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

type Lesson = {
  id: number;
  title: string;
  lane: string;
  concept: string;
  badPrompt: string;
  scenario: string;
  example: string;
  unlockLabel: string;
};

type SignalKey = "goal" | "context" | "format";

type ScoreResult = {
  score: number;
  passed: boolean;
  signals: Record<SignalKey, boolean>;
  feedback: string;
};

type StoredState = {
  completed: number[];
  xp: number;
  streak: number;
  localWaitlistCount: number;
  betaClicks: number;
  lessonStarts: Record<number, number>;
  lessonCompletions: Record<number, number>;
  retries: Record<number, number>;
  events: Array<{ name: string; at: string; lesson?: number }>;
};

const lessons: Lesson[] = [
  {
    id: 1,
    title: "Make Vague Prompts Specific",
    lane: "Prompt Basics",
    concept: "Agent-ready tasks include a goal, the situation, and the shape of the answer.",
    badPrompt: "Help me with my business.",
    scenario: "You are a founder trying to decide what to build first.",
    example:
      "Help me choose the first MVP for my coaching business. Context: I have 20 warm leads, no website, and 2 hours tonight. Return a ranked list with reasons and the first task I should give Codex.",
    unlockLabel: "Next: Product idea prompts",
  },
  {
    id: 2,
    title: "Turn Ideas Into Build Tasks",
    lane: "Ship With Agents",
    concept: "Agents work better when the task says what to build, who it helps, and what done means.",
    badPrompt: "Build my app idea.",
    scenario: "You want Codex or Cursor to create a small clickable prototype.",
    example:
      "Build a browser-only prototype for non-coders learning AI agents. Context: use five short lessons and no backend. Return files changed, acceptance criteria, and how to run it locally.",
    unlockLabel: "Next: Bug report prompts",
  },
  {
    id: 3,
    title: "Write Bug Reports Agents Can Fix",
    lane: "Debugging",
    concept: "A fix prompt needs the bug, expected behavior, current behavior, and proof you want back.",
    badPrompt: "The page is broken.",
    scenario: "A button in your prototype does not unlock the next lesson.",
    example:
      "Fix the lesson unlock bug. Context: clicking submit with a passing score should unlock the next lesson, but the button stays disabled after refresh. Return the likely cause, patch, and a manual test checklist.",
    unlockLabel: "Next: Landing page prompts",
  },
  {
    id: 4,
    title: "Ask For Useful Landing Pages",
    lane: "Growth",
    concept: "A landing prompt should include audience, offer, proof, and conversion goal.",
    badPrompt: "Make a landing page.",
    scenario: "You need to validate demand before building the full app.",
    example:
      "Create a landing page for Promptlaiy. Context: target non-coder founders who want to ship with Codex and Cursor. Format: first screen, practice preview, pricing test, and waitlist CTA.",
    unlockLabel: "Next: Review prompts",
  },
  {
    id: 5,
    title: "Review Agent Work Safely",
    lane: "Control",
    concept: "Review prompts keep you in control by asking for risks, tests, and a clear summary.",
    badPrompt: "Is this good?",
    scenario: "Codex changed files and you need to inspect the work.",
    example:
      "Review the changes like a senior product engineer. Context: this is a frontend-only MVP with localStorage analytics. Return blockers, risky assumptions, missing tests, and a concise ship/no-ship recommendation.",
    unlockLabel: "Paid beta unlocked",
  },
];

const starterState: StoredState = {
  completed: [],
  xp: 0,
  streak: 1,
  localWaitlistCount: 0,
  betaClicks: 0,
  lessonStarts: {},
  lessonCompletions: {},
  retries: {},
  events: [],
};

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem("promptlaiy-state");
    if (!raw) return starterState;
    return { ...starterState, ...JSON.parse(raw) };
  } catch {
    return starterState;
  }
}

function saveState(state: StoredState) {
  localStorage.setItem("promptlaiy-state", JSON.stringify(state));
}

function scorePrompt(input: string): ScoreResult {
  const text = input.trim().toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const goal =
    /\b(goal|build|create|write|draft|fix|choose|decide|review|analyze|improve|turn|make|ship)\b/.test(text) &&
    wordCount >= 8;
  const context =
    /\b(context|audience|for|because|current|using|with|target|my|users|customers|repo|prototype|business)\b/.test(
      text,
    ) && wordCount >= 12;
  const format =
    /\b(format|return|give me|as a|table|list|checklist|plan|steps|markdown|bullets|ranked|summary)\b/.test(text);

  const signals = { goal, context, format };
  const hitCount = Object.values(signals).filter(Boolean).length;
  const score = Math.min(100, hitCount * 30 + Math.min(10, Math.floor(wordCount / 5)));
  const missing = (Object.entries(signals) as Array<[SignalKey, boolean]>)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const feedback =
    missing.length === 0
      ? "Strong. This gives the agent the job, the situation, and the shape of the answer."
      : `Add ${missing.join(" + ")} so the agent knows what success looks like.`;

  return {
    score,
    passed: score >= 70,
    signals,
    feedback,
  };
}

function App() {
  const [state, setState] = useState<StoredState>(() => loadState());
  const [activeLesson, setActiveLesson] = useState(lessons[0]);
  const [prompt, setPrompt] = useState("");
  const [lastResult, setLastResult] = useState<ScoreResult | null>(null);
  const [email, setEmail] = useState("");
  const [waitlistMessage, setWaitlistMessage] = useState("");
  const [selectedBetaInterest, setSelectedBetaInterest] = useState("");
  const [serverWaitlistCount, setServerWaitlistCount] = useState<number | null>(null);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);

  const unlockedLessons = Math.max(1, state.completed.length + 1);
  const completedPercent = Math.round((state.completed.length / lessons.length) * 100);
  const selectedIndex = lessons.findIndex((lesson) => lesson.id === activeLesson.id);
  const isLocked = activeLesson.id > unlockedLessons;
  const hasCompletedAll = state.completed.length === lessons.length;
  const visibleWaitlistCount = serverWaitlistCount ?? state.localWaitlistCount;

  const validationStats = useMemo(
    () => [
      { label: "Waitlist", current: visibleWaitlistCount, target: 100 },
      {
        label: "Lesson 1 done",
        current: state.lessonCompletions[1] ?? 0,
        target: 10,
      },
      { label: "Paid beta clicks", current: state.betaClicks, target: 3 },
    ],
    [state, visibleWaitlistCount],
  );

  useEffect(() => {
    let isActive = true;
    fetch("/api/waitlist")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isActive && typeof data?.count === "number") {
          setServerWaitlistCount(data.count);
        }
      })
      .catch(() => {
        if (isActive) setServerWaitlistCount(null);
      });
    return () => {
      isActive = false;
    };
  }, []);

  function updateState(nextState: StoredState) {
    setState(nextState);
    saveState(nextState);
  }

  function recordServerEvent(eventName: string, lessonId?: number, betaInterest = selectedBetaInterest) {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, lessonId, betaInterest }),
    }).catch(() => undefined);
  }

  function track(name: string, lesson?: number) {
    const nextState = {
      ...state,
      events: [{ name, at: new Date().toISOString(), lesson }, ...state.events].slice(0, 30),
      lessonStarts:
        name === "lesson_started" && lesson
          ? { ...state.lessonStarts, [lesson]: (state.lessonStarts[lesson] ?? 0) + 1 }
          : state.lessonStarts,
    };
    updateState(nextState);
    recordServerEvent(name, lesson);
  }

  function selectLesson(lesson: Lesson) {
    setActiveLesson(lesson);
    setPrompt("");
    setLastResult(null);
    if (lesson.id <= unlockedLessons) track("lesson_started", lesson.id);
  }

  function submitPrompt() {
    const result = scorePrompt(prompt);
    setLastResult(result);

    const completedAlready = state.completed.includes(activeLesson.id);
    const nextState: StoredState = {
      ...state,
      retries: {
        ...state.retries,
        [activeLesson.id]: (state.retries[activeLesson.id] ?? 0) + 1,
      },
      events: [
        {
          name: result.passed ? "lesson_completed" : "lesson_retried",
          at: new Date().toISOString(),
          lesson: activeLesson.id,
        },
        ...state.events,
      ].slice(0, 30),
    };

    if (result.passed && !completedAlready) {
      nextState.completed = [...state.completed, activeLesson.id].sort((a, b) => a - b);
      nextState.xp = state.xp + 25 + result.score;
      nextState.lessonCompletions = {
        ...state.lessonCompletions,
        [activeLesson.id]: (state.lessonCompletions[activeLesson.id] ?? 0) + 1,
      };
    }

    updateState(nextState);
    recordServerEvent(result.passed ? "lesson_completed" : "lesson_retried", activeLesson.id);
  }

  function useExample() {
    setPrompt(activeLesson.example);
    setLastResult(null);
    track("example_used", activeLesson.id);
  }

  function goNext() {
    const next = lessons[selectedIndex + 1];
    if (next) selectLesson(next);
  }

  async function joinWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setWaitlistMessage("Enter a real email to save your spot.");
      return;
    }
    setIsJoiningWaitlist(true);
    setWaitlistMessage("Saving your spot...");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: normalized,
          source: selectedBetaInterest ? "paid_beta" : "waitlist",
          betaInterest: selectedBetaInterest,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Could not join waitlist.");
      }

      const nextState = {
        ...state,
        events: [{ name: "waitlist_joined", at: new Date().toISOString() }, ...state.events].slice(0, 30),
      };
      updateState(nextState);
      setServerWaitlistCount(result.count);
      setEmail("");
      setWaitlistMessage(
        result.status === "updated" ? "Updated your beta preference." : "Saved. You are on the beta list.",
      );
    } catch {
      const nextState = {
        ...state,
        localWaitlistCount: state.localWaitlistCount + 1,
        events: [{ name: "waitlist_saved_locally", at: new Date().toISOString() }, ...state.events].slice(0, 30),
      };
      updateState(nextState);
      setEmail("");
      setWaitlistMessage("Saved locally for this browser. The live site will store this in Cloudflare.");
    } finally {
      setIsJoiningWaitlist(false);
    }
  }

  function clickBeta(betaInterest: string) {
    setSelectedBetaInterest(betaInterest);
    updateState({
      ...state,
      betaClicks: state.betaClicks + 1,
      events: [{ name: "paid_beta_clicked", at: new Date().toISOString() }, ...state.events].slice(0, 30),
    });
    recordServerEvent("paid_beta_clicked", undefined, betaInterest);
    setWaitlistMessage("Nice. Add your email and I will tag your beta interest.");
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" aria-label="Promptlaiy home">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <span>Promptlaiy</span>
        </button>
        <nav className="nav-actions" aria-label="Validation actions">
          <a href="#lessons">Lessons</a>
          <a href="#pricing">Beta</a>
          <a href="#waitlist">Waitlist</a>
        </nav>
      </header>

      <section className="workspace" id="lessons">
        <aside className="course-rail" aria-label="Lesson path">
          <div className="rail-header">
            <span className="eyebrow">Daily agent practice</span>
            <strong>Ship with agents</strong>
          </div>
          <div className="progress-card">
            <div>
              <span>{completedPercent}% complete</span>
              <strong>{state.xp} XP</strong>
            </div>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${completedPercent}%` }} />
            </div>
          </div>
          <div className="lesson-list">
            {lessons.map((lesson) => {
              const locked = lesson.id > unlockedLessons;
              const completed = state.completed.includes(lesson.id);
              const active = activeLesson.id === lesson.id;
              return (
                <button
                  className={`lesson-chip ${active ? "active" : ""}`}
                  key={lesson.id}
                  onClick={() => selectLesson(lesson)}
                  disabled={locked}
                  title={locked ? "Complete the previous lesson to unlock" : lesson.title}
                >
                  <span className="lesson-icon">
                    {completed ? <Check size={16} /> : locked ? <Lock size={15} /> : <Play size={15} />}
                  </span>
                  <span>
                    <small>{lesson.lane}</small>
                    {lesson.title}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="practice-panel" aria-label="Active prompt lesson">
          <div className="lesson-topline">
            <button
              className="icon-button"
              onClick={() => selectedIndex > 0 && selectLesson(lessons[selectedIndex - 1])}
              disabled={selectedIndex === 0}
              aria-label="Previous lesson"
              title="Previous lesson"
            >
              <ChevronLeft size={18} />
            </button>
            <span>Lesson {activeLesson.id} of 5</span>
            <span className="streak-pill">
              <Flame size={15} />
              {state.streak} day
            </span>
          </div>

          <div className="lesson-copy">
            <p>{activeLesson.lane}</p>
            <h1>{activeLesson.title}</h1>
            <span>{activeLesson.concept}</span>
          </div>

          <div className="bad-prompt">
            <span>Bad prompt</span>
            <p>{activeLesson.badPrompt}</p>
          </div>

          <div className="scenario-strip">
            <Lightbulb size={18} />
            <span>{activeLesson.scenario}</span>
          </div>

          <label className="prompt-editor" htmlFor="prompt-input">
            <span>Your agent-ready version</span>
            <textarea
              id="prompt-input"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setLastResult(null);
              }}
              disabled={isLocked}
              placeholder="Add a clear goal, real context, and the output format you want."
            />
          </label>

          <div className="editor-actions">
            <button className="secondary-button" onClick={useExample} disabled={isLocked}>
              <ClipboardCheck size={17} />
              Example
            </button>
            <button className="primary-button" onClick={submitPrompt} disabled={isLocked || prompt.trim().length < 8}>
              Check prompt
              <ArrowRight size={17} />
            </button>
          </div>

          {lastResult && (
            <div className={`feedback-card ${lastResult.passed ? "passed" : ""}`}>
              <div className="score-ring" aria-label={`Score ${lastResult.score}`}>
                {lastResult.score}
              </div>
              <div>
                <strong>{lastResult.passed ? "Lesson passed" : "Keep tightening it"}</strong>
                <p>{lastResult.feedback}</p>
                <div className="signal-row">
                  {(["goal", "context", "format"] as SignalKey[]).map((signal) => (
                    <span className={lastResult.signals[signal] ? "hit" : ""} key={signal}>
                      {lastResult.signals[signal] ? <Check size={14} /> : <MousePointer2 size={14} />}
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {lastResult?.passed && (
            <button className="next-lesson-button" onClick={goNext} disabled={selectedIndex === lessons.length - 1}>
              {activeLesson.unlockLabel}
              <ArrowRight size={17} />
            </button>
          )}
        </section>

        <aside className="validation-rail" aria-label="Validation dashboard">
          <div className="promise-card">
            <Rocket size={24} />
            <h2>Practice directing AI agents until you can ship useful work.</h2>
            <p>Built for non-coders, founders, operators, and product people learning Codex and Cursor workflows.</p>
          </div>

          <div className="stats-grid">
            <div>
              <Gauge size={18} />
              <span>Score gate</span>
              <strong>70+</strong>
            </div>
            <div>
              <Trophy size={18} />
              <span>Free path</span>
              <strong>5 lessons</strong>
            </div>
          </div>

          <div className="targets-card">
            <div className="section-heading">
              <ListChecks size={18} />
              <strong>Validation targets</strong>
            </div>
            {validationStats.map((stat) => {
              const progress = Math.min(100, Math.round((stat.current / stat.target) * 100));
              return (
                <div className="target-row" key={stat.label}>
                  <span>
                    {stat.label}
                    <strong>
                      {stat.current}/{stat.target}
                    </strong>
                  </span>
                  <div className="mini-meter">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="event-card">
            <div className="section-heading">
              <ShieldCheck size={18} />
              <strong>Local signals</strong>
            </div>
            {state.events.length === 0 ? (
              <p>No signals yet. Start a lesson to create the first one.</p>
            ) : (
              state.events.slice(0, 5).map((event, index) => (
                <span key={`${event.name}-${event.at}-${index}`}>
                  {event.name.replaceAll("_", " ")}
                  {event.lesson ? ` L${event.lesson}` : ""}
                </span>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className="money-band" id="pricing">
        <div>
          <span className="eyebrow">Money test</span>
          <h2>Free lessons first. Paid intent after value.</h2>
          <p>
            The MVP keeps lesson one through five free, then measures whether people want Pro practice or a live
            founder bootcamp.
          </p>
        </div>
        <div className="pricing-grid">
          <article>
            <BadgeCheck size={22} />
            <h3>Pro Practice</h3>
            <strong>$9/mo</strong>
            <p>Daily reps, advanced scenarios, saved progress, and deeper prompt feedback.</p>
            <button onClick={() => clickBeta("pro_monthly")}>Join Pro beta</button>
          </article>
          <article className="featured-price">
            <Code2 size={22} />
            <h3>Founder Bootcamp</h3>
            <strong>$149</strong>
            <p>A 90-minute live session to ship your first AI-agent workflow with Codex or Cursor.</p>
            <button onClick={() => clickBeta("founder_bootcamp")}>Reserve beta seat</button>
          </article>
          <article>
            <CreditCard size={22} />
            <h3>Annual</h3>
            <strong>$59/yr</strong>
            <p>Lower-friction paid plan for people who want lightweight weekly practice.</p>
            <button onClick={() => clickBeta("annual")}>Test annual intent</button>
          </article>
        </div>
      </section>

      <section className="waitlist-band" id="waitlist">
        <div>
          <span className="eyebrow">Beta list</span>
          <h2>{hasCompletedAll ? "You unlocked the beta ask." : "Validate demand before building more."}</h2>
          <p>Capture early users now, then expand only if the lesson loop proves people come back.</p>
        </div>
        <form className="waitlist-form" onSubmit={joinWaitlist}>
          <label htmlFor="waitlist-email">Email</label>
          <input aria-hidden="true" className="honeypot" name="company" tabIndex={-1} autoComplete="off" />
          <div>
            <Mail size={18} />
            <input
              id="waitlist-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="founder@example.com"
            />
            <button type="submit" disabled={isJoiningWaitlist}>
              {isJoiningWaitlist ? "Saving..." : "Join waitlist"}
            </button>
          </div>
          {waitlistMessage && <p>{waitlistMessage}</p>}
        </form>
      </section>
    </main>
  );
}

export default App;
