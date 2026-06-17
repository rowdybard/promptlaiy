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
  nextLabel: string;
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
    title: "Make A Vague Ask Usable",
    lane: "The basic move",
    concept: "A good request says what you want, what the tool should know, and what you want back.",
    badPrompt: "Help me with my business.",
    scenario: "You run a small coaching business and have one evening to choose the first thing to test.",
    example:
      "Choose the first test for my coaching business. Context: I have 20 warm leads, no website, and two hours tonight. Return a ranked list with reasons and the exact task to give Codex first.",
    nextLabel: "Go to idea tasks",
  },
  {
    id: 2,
    title: "Turn An Idea Into A Task",
    lane: "Build requests",
    concept: "A coding tool needs the thing to make, who it is for, the limits, and what counts as done.",
    badPrompt: "Build my app idea.",
    scenario: "You want Codex or Cursor to create a small clickable prototype.",
    example:
      "Build a browser-only prototype for people practicing Codex and Cursor requests. Context: use five short lessons, no accounts, and no backend. Return files changed, acceptance checks, and how to run it locally.",
    nextLabel: "Go to bug reports",
  },
  {
    id: 3,
    title: "Write A Bug Report A Tool Can Fix",
    lane: "Debugging",
    concept: "A fix request needs the bug, what should happen, what happens now, and how to prove it is fixed.",
    badPrompt: "The page is broken.",
    scenario: "A button in your prototype should open the next lesson, but it stays disabled.",
    example:
      "Fix the lesson navigation bug. Context: clicking submit with a passing score should open the next lesson, but the button stays disabled after refresh. Return the likely cause, the patch, and a manual test checklist.",
    nextLabel: "Go to landing pages",
  },
  {
    id: 4,
    title: "Ask For A Landing Page That Can Sell",
    lane: "Growth",
    concept: "A landing page request needs the buyer, the offer, the proof, and the action you want.",
    badPrompt: "Make a landing page.",
    scenario: "You need to see whether strangers want this before building a bigger app.",
    example:
      "Create a landing page for Promptlaiy. Context: target founders who want better results from Codex and Cursor without learning to code. Format: first screen, lesson preview, pricing test, and waitlist form.",
    nextLabel: "Go to review requests",
  },
  {
    id: 5,
    title: "Review The Work Before You Trust It",
    lane: "Control",
    concept: "A review request asks for risks, missing tests, and a plain recommendation before you accept changes.",
    badPrompt: "Is this good?",
    scenario: "Codex changed files and you need to inspect the work.",
    example:
      "Review the changes like a senior product engineer. Context: this is a frontend-only test product with localStorage progress and a Cloudflare waitlist. Return blockers, risky assumptions, missing tests, and a clear publish/do-not-publish recommendation.",
    nextLabel: "See the paid options",
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
    /\b(goal|build|create|write|draft|fix|choose|decide|review|analyze|improve|turn|make|publish)\b/.test(text) &&
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
      ? "Good. This names the job, the background, and the answer you want."
      : `Add ${missing.join(" + ")} so the tool has less to guess.`;

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

  const availableLessons = Math.max(1, state.completed.length + 1);
  const completedPercent = Math.round((state.completed.length / lessons.length) * 100);
  const selectedIndex = lessons.findIndex((lesson) => lesson.id === activeLesson.id);
  const isLocked = activeLesson.id > availableLessons;
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
      { label: "Price clicks", current: state.betaClicks, target: 3 },
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
    if (lesson.id <= availableLessons) track("lesson_started", lesson.id);
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
        result.status === "updated" ? "Updated your choice." : "You're on the list.",
      );
    } catch {
      const nextState = {
        ...state,
        localWaitlistCount: state.localWaitlistCount + 1,
        events: [{ name: "waitlist_saved_locally", at: new Date().toISOString() }, ...state.events].slice(0, 30),
      };
      updateState(nextState);
      setEmail("");
      setWaitlistMessage("Saved in this browser. The live site stores signups in Cloudflare.");
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
    setWaitlistMessage("Good choice. Add your email and I will save it with that option.");
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
            <span className="eyebrow">5-minute request drills</span>
            <strong>Make clearer asks</strong>
          </div>
          <div className="progress-card">
            <div>
              <span>{completedPercent}% complete</span>
              <strong>{state.xp} points</strong>
            </div>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${completedPercent}%` }} />
            </div>
          </div>
          <div className="lesson-list">
            {lessons.map((lesson) => {
              const locked = lesson.id > availableLessons;
              const completed = state.completed.includes(lesson.id);
              const active = activeLesson.id === lesson.id;
              return (
                <button
                  className={`lesson-chip ${active ? "active" : ""}`}
                  key={lesson.id}
                  onClick={() => selectLesson(lesson)}
                  disabled={locked}
                  title={locked ? "Finish the previous lesson first" : lesson.title}
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
            <span>Weak ask</span>
            <p>{activeLesson.badPrompt}</p>
          </div>

          <div className="scenario-strip">
            <Lightbulb size={18} />
            <span>{activeLesson.scenario}</span>
          </div>

          <label className="prompt-editor" htmlFor="prompt-input">
            <span>Rewrite it for Codex or Cursor</span>
            <textarea
              id="prompt-input"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setLastResult(null);
              }}
              disabled={isLocked}
              placeholder="Say the outcome, the context, and the format you want."
            />
          </label>

          <div className="editor-actions">
            <button className="secondary-button" onClick={useExample} disabled={isLocked}>
              <ClipboardCheck size={17} />
              Example
            </button>
            <button className="primary-button" onClick={submitPrompt} disabled={isLocked || prompt.trim().length < 8}>
              Check my ask
              <ArrowRight size={17} />
            </button>
          </div>

          {lastResult && (
            <div className={`feedback-card ${lastResult.passed ? "passed" : ""}`}>
              <div className="score-ring" aria-label={`Score ${lastResult.score}`}>
                {lastResult.score}
              </div>
              <div>
                <strong>{lastResult.passed ? "That is usable" : "Still too fuzzy"}</strong>
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
              {activeLesson.nextLabel}
              <ArrowRight size={17} />
            </button>
          )}
        </section>

        <aside className="validation-rail" aria-label="Validation dashboard">
          <div className="promise-card">
            <Rocket size={24} />
            <h2>Learn to give Codex and Cursor work they can actually finish.</h2>
            <p>Short drills for founders and operators who want better software help without learning a full coding stack.</p>
          </div>

          <div className="stats-grid">
            <div>
              <Gauge size={18} />
              <span>Pass mark</span>
              <strong>70+</strong>
            </div>
            <div>
              <Trophy size={18} />
              <span>Free lessons</span>
              <strong>5 lessons</strong>
            </div>
          </div>

          <div className="targets-card">
            <div className="section-heading">
              <ListChecks size={18} />
              <strong>Launch targets</strong>
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
              <strong>Recent activity</strong>
            </div>
            {state.events.length === 0 ? (
              <p>No activity yet. Start a lesson to create the first entry.</p>
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
          <span className="eyebrow">Price check</span>
          <h2>Let people try it before asking for money.</h2>
          <p>
            The first five lessons stay free. After that, the page checks whether people want more drills or a live
            build session.
          </p>
        </div>
        <div className="pricing-grid">
          <article>
            <BadgeCheck size={22} />
            <h3>More drills</h3>
            <strong>$9/mo</strong>
            <p>More scenarios, saved progress, and sharper feedback on each rewrite.</p>
            <button onClick={() => clickBeta("pro_monthly")}>Join the list</button>
          </article>
          <article className="featured-price">
            <Code2 size={22} />
            <h3>Live build session</h3>
            <strong>$149</strong>
            <p>A 90-minute session where you turn one real idea into a working Codex or Cursor task.</p>
            <button onClick={() => clickBeta("founder_bootcamp")}>Save me a seat</button>
          </article>
          <article>
            <CreditCard size={22} />
            <h3>Annual</h3>
            <strong>$59/yr</strong>
            <p>A cheaper yearly option for people who want a steady habit without another big subscription.</p>
            <button onClick={() => clickBeta("annual")}>I would pay yearly</button>
          </article>
        </div>
      </section>

      <section className="waitlist-band" id="waitlist">
        <div>
          <span className="eyebrow">Beta list</span>
          <h2>{hasCompletedAll ? "Want the next set of lessons?" : "Join before I build the rest."}</h2>
          <p>Leave your email if this is close to something you would actually use.</p>
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
