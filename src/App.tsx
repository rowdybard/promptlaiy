import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  Lock,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";

type Verdict = "BUILD" | "SHRINK" | "PIVOT" | "KILL";

type Question = {
  id: keyof IdeaAnswers;
  label: string;
  helper: string;
  placeholder: string;
};

type IdeaAnswers = {
  audience: string;
  problem: string;
  alternative: string;
  urgency: string;
  smallestVersion: string;
};

type IdeaSession = {
  idea: string;
  answers: IdeaAnswers;
  step: number;
  verdict: VerdictResult | null;
};

type VerdictResult = {
  verdict: Verdict;
  summary: string;
  nextMove: string;
  scores: Record<ScoreKey, number>;
  brief: IdeaBrief;
};

type IdeaBrief = {
  idea: string;
  audience: string;
  problem: string;
  alternative: string;
  urgency: string;
  smallestVersion: string;
};

type ScoreKey =
  | "pain"
  | "clarity"
  | "audience"
  | "urgency"
  | "buildability"
  | "distribution"
  | "differentiation"
  | "monetization";

const questions: Question[] = [
  {
    id: "audience",
    label: "Who is this for?",
    helper: "Name the exact person, team, or business that would feel the pain.",
    placeholder: "Example: solo mortgage brokers who manually chase missing borrower documents...",
  },
  {
    id: "problem",
    label: "What painful problem does it solve?",
    helper: "Skip vague value. What hurts, wastes money, or eats time?",
    placeholder: "Example: they lose deals because collecting documents takes days of back-and-forth...",
  },
  {
    id: "alternative",
    label: "What do they do now instead?",
    helper: "Every idea competes with a spreadsheet, assistant, agency, habit, or doing nothing.",
    placeholder: "Example: email templates, spreadsheets, and a part-time assistant...",
  },
  {
    id: "urgency",
    label: "Why would they care today?",
    helper: "Look for a deadline, penalty, wasted spend, emotional trigger, or recent change.",
    placeholder: "Example: rates are volatile, leads are expensive, and slow follow-up kills the file...",
  },
  {
    id: "smallestVersion",
    label: "What is the smallest useful version?",
    helper: "Shrink the idea until one person could get value from version one.",
    placeholder: "Example: a checklist link that collects missing docs and nudges borrowers twice...",
  },
];

const blankAnswers: IdeaAnswers = {
  audience: "",
  problem: "",
  alternative: "",
  urgency: "",
  smallestVersion: "",
};

const starterSession: IdeaSession = {
  idea: "",
  answers: blankAnswers,
  step: -1,
  verdict: null,
};

const scoreLabels: Record<ScoreKey, string> = {
  pain: "Pain",
  clarity: "Clarity",
  audience: "Audience",
  urgency: "Urgency",
  buildability: "Buildability",
  distribution: "Distribution",
  differentiation: "Differentiation",
  monetization: "Monetization",
};

function loadSession(): IdeaSession {
  try {
    const raw = localStorage.getItem("promptlaiy-idea-session");
    if (!raw) return starterSession;
    const parsed = JSON.parse(raw);
    return {
      ...starterSession,
      ...parsed,
      answers: { ...blankAnswers, ...(parsed.answers || {}) },
      verdict: parsed.verdict || null,
    };
  } catch {
    return starterSession;
  }
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function keywordScore(text: string, keywords: string[], base: number) {
  const normalized = text.toLowerCase();
  const hits = keywords.filter((keyword) => normalized.includes(keyword)).length;
  return Math.min(100, base + hits * 12 + Math.min(34, wordCount(text) * 3));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function createMockVerdict(idea: string, answers: IdeaAnswers): VerdictResult {
  const brief: IdeaBrief = {
    idea: idea.trim(),
    audience: answers.audience.trim(),
    problem: answers.problem.trim(),
    alternative: answers.alternative.trim(),
    urgency: answers.urgency.trim(),
    smallestVersion: answers.smallestVersion.trim(),
  };

  const scores: Record<ScoreKey, number> = {
    pain: keywordScore(brief.problem, ["pain", "lose", "waste", "slow", "manual", "expensive", "risk", "miss"], 18),
    clarity: clamp(average([wordCount(brief.idea) * 4, wordCount(brief.smallestVersion) * 5, wordCount(brief.problem) * 3])),
    audience: keywordScore(brief.audience, ["who", "team", "founder", "operator", "agency", "broker", "owner"], 12),
    urgency: keywordScore(brief.urgency, ["today", "now", "deadline", "cost", "losing", "recent", "urgent", "expensive"], 10),
    buildability: clamp(100 - Math.abs(wordCount(brief.smallestVersion) - 22) * 3),
    distribution: clamp(keywordScore(`${brief.audience} ${brief.alternative}`, ["email", "community", "directory", "existing", "clients", "leads"], 24)),
    differentiation: clamp(keywordScore(`${brief.problem} ${brief.alternative}`, ["instead", "manual", "spreadsheet", "slow", "better", "different"], 18)),
    monetization: 0,
  };
  scores.monetization = clamp(average([scores.pain, scores.urgency, scores.audience]) + 4);

  const overall = average(Object.values(scores));
  const weakScores = Object.entries(scores).filter(([, value]) => value < 45).map(([key]) => scoreLabels[key as ScoreKey]);

  let verdict: Verdict = "SHRINK";
  if (scores.pain < 40 || scores.audience < 38) {
    verdict = "KILL";
  } else if (scores.urgency < 45 || scores.differentiation < 42 || scores.monetization < 45) {
    verdict = "PIVOT";
  } else if (scores.buildability < 55 || scores.clarity < 55 || weakScores.length >= 2) {
    verdict = "SHRINK";
  } else if (overall >= 66) {
    verdict = "BUILD";
  }

  const summaryByVerdict: Record<Verdict, string> = {
    BUILD: "There is enough pain, audience clarity, and version-one shape to justify a fast build test.",
    SHRINK: "The idea has a useful signal, but the first version is still too wide. Cut it down before building.",
    PIVOT: "There may be something here, but the current angle is not sharp enough to earn attention today.",
    KILL: "The pain or audience is too soft right now. Save the learning, but do not spend build time yet.",
  };

  const nextByVerdict: Record<Verdict, string> = {
    BUILD: "Build the smallest useful version and put it in front of five real people.",
    SHRINK: "Pick one audience, one painful workflow, and one output the user can finish in under ten minutes.",
    PIVOT: "Change the audience, problem, or urgency trigger before you write code.",
    KILL: "Interview three target users before reviving this. Look for repeated pain in their exact words.",
  };

  return {
    verdict,
    summary: summaryByVerdict[verdict],
    nextMove: nextByVerdict[verdict],
    scores,
    brief,
  };
}

function App() {
  const [session, setSession] = useState<IdeaSession>(() => loadSession());
  const [isGenerating, setIsGenerating] = useState(false);
  const activeQuestion = session.step >= 0 ? questions[session.step] : null;
  const answeredCount = questions.filter((question) => session.answers[question.id].trim().length > 0).length;
  const progress = session.verdict ? 100 : session.step < 0 ? 0 : Math.round(((session.step + 1) / questions.length) * 100);
  const canStart = session.idea.trim().length >= 20;
  const canContinue = activeQuestion ? session.answers[activeQuestion.id].trim().length >= 8 : false;

  const currentAnswer = activeQuestion ? session.answers[activeQuestion.id] : "";
  const stageLabel = session.verdict
    ? "Verdict ready"
    : session.step < 0
      ? "Brain dump"
      : `Question ${session.step + 1} of ${questions.length}`;

  const verdictTone = useMemo(() => {
    const verdict = session.verdict?.verdict;
    if (verdict === "BUILD") return "build";
    if (verdict === "KILL") return "kill";
    if (verdict === "PIVOT") return "pivot";
    return "shrink";
  }, [session.verdict]);

  useEffect(() => {
    localStorage.setItem("promptlaiy-idea-session", JSON.stringify(session));
  }, [session]);

  function updateSession(next: Partial<IdeaSession>) {
    setSession((current) => ({ ...current, ...next }));
  }

  function updateAnswer(value: string) {
    if (!activeQuestion) return;
    setSession((current) => ({
      ...current,
      answers: { ...current.answers, [activeQuestion.id]: value },
      verdict: null,
    }));
  }

  function reset() {
    setSession(starterSession);
    localStorage.removeItem("promptlaiy-idea-session");
  }

  async function generateVerdict() {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea: session.idea, answers: session.answers }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error("API verdict unavailable");
      updateSession({ verdict: result.verdict });
    } catch {
      updateSession({ verdict: createMockVerdict(session.idea, session.answers) });
    } finally {
      setIsGenerating(false);
    }
  }

  function submitBrainDump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canStart) updateSession({ step: 0, verdict: null });
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue) return;
    if (session.step === questions.length - 1) {
      void generateVerdict();
      return;
    }
    updateSession({ step: session.step + 1, verdict: null });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Promptlaiy home">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <span>Promptlaiy</span>
        </a>
        <div className="topbar-actions">
          <span>{stageLabel}</span>
          <button type="button" onClick={reset}>
            <RefreshCcw size={16} />
            New idea
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Idea verdict in 5 minutes</p>
          <h1>Dump your idea. Answer 5 questions. Get a verdict.</h1>
          <p>
            Promptlaiy turns messy founder brain dumps into a structured idea brief and a clear Build, Shrink, Pivot,
            or Kill call.
          </p>
        </div>
        <div className="hero-panel" aria-label="Verdict options">
          {(["BUILD", "SHRINK", "PIVOT", "KILL"] as Verdict[]).map((verdict) => (
            <span key={verdict}>{verdict}</span>
          ))}
        </div>
      </section>

      <section className="flow-shell" aria-label="Idea intake flow">
        <aside className="progress-rail">
          <div className="progress-card">
            <span className="eyebrow">Run status</span>
            <strong>{answeredCount}/5 answered</strong>
            <div className="meter" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>

          <ol className="step-list">
            <li className={session.step < 0 && !session.verdict ? "active" : ""}>
              <span>{session.idea.trim() ? <Check size={15} /> : "1"}</span>
              Brain dump
            </li>
            {questions.map((question, index) => (
              <li
                key={question.id}
                className={session.step === index && !session.verdict ? "active" : session.answers[question.id] ? "done" : ""}
              >
                <span>{session.answers[question.id] ? <Check size={15} /> : index + 2}</span>
                {question.label}
              </li>
            ))}
            <li className={session.verdict ? "active done" : ""}>
              <span>{session.verdict ? <Check size={15} /> : questions.length + 2}</span>
              Verdict
            </li>
          </ol>
        </aside>

        <section className="work-panel">
          {session.step < 0 && !session.verdict && (
            <form className="idea-form" onSubmit={submitBrainDump}>
              <span className="eyebrow">Step 1</span>
              <h2>Dump the messy version.</h2>
              <p className="panel-copy">
                No pitch-deck voice. Paste the half-formed thing, the market hunch, the customer rant, or the idea you
                keep circling back to.
              </p>
              <textarea
                value={session.idea}
                onChange={(event) => updateSession({ idea: event.target.value, verdict: null })}
                placeholder="Example: I want to build something for local service businesses that keeps them from losing leads because they respond too slowly..."
              />
              <div className="form-actions">
                <span>{Math.max(0, 20 - session.idea.trim().length)} characters until start</span>
                <button className="primary-button" type="submit" disabled={!canStart}>
                  Start questions
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          )}

          {activeQuestion && !session.verdict && (
            <form className="idea-form" onSubmit={submitAnswer}>
              <span className="eyebrow">Question {session.step + 1}</span>
              <h2>{activeQuestion.label}</h2>
              <p className="panel-copy">{activeQuestion.helper}</p>
              <textarea value={currentAnswer} onChange={(event) => updateAnswer(event.target.value)} placeholder={activeQuestion.placeholder} />
              <div className="form-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => updateSession({ step: Math.max(-1, session.step - 1) })}
                >
                  <ArrowLeft size={17} />
                  Back
                </button>
                <button className="primary-button" type="submit" disabled={!canContinue || isGenerating}>
                  {session.step === questions.length - 1 ? (isGenerating ? "Scoring..." : "Get verdict") : "Next"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          )}

          {session.verdict && (
            <section className="verdict-view">
              <div className={`verdict-hero ${verdictTone}`}>
                <span className="eyebrow">Verdict</span>
                <h2>{session.verdict.verdict}</h2>
                <p>{session.verdict.summary}</p>
              </div>

              <div className="brief-grid">
                <article>
                  <ClipboardList size={20} />
                  <h3>Idea Brief</h3>
                  <dl>
                    <dt>Idea</dt>
                    <dd>{session.verdict.brief.idea}</dd>
                    <dt>For</dt>
                    <dd>{session.verdict.brief.audience}</dd>
                    <dt>Problem</dt>
                    <dd>{session.verdict.brief.problem}</dd>
                    <dt>Current alternative</dt>
                    <dd>{session.verdict.brief.alternative}</dd>
                    <dt>Why now</dt>
                    <dd>{session.verdict.brief.urgency}</dd>
                    <dt>Smallest useful version</dt>
                    <dd>{session.verdict.brief.smallestVersion}</dd>
                  </dl>
                </article>

                <article>
                  <Target size={20} />
                  <h3>Scorecard</h3>
                  <div className="score-list">
                    {(Object.keys(scoreLabels) as ScoreKey[]).map((key) => (
                      <div className="score-row" key={key}>
                        <span>{scoreLabels[key]}</span>
                        <div>
                          <i style={{ width: `${session.verdict?.scores[key] || 0}%` }} />
                        </div>
                        <strong>{session.verdict?.scores[key]}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <section className="next-move">
                <BadgeCheck size={22} />
                <div>
                  <span className="eyebrow">Next move</span>
                  <p>{session.verdict.nextMove}</p>
                </div>
              </section>

              <section className="locked-upgrade" aria-label="Locked continuation tools">
                <div>
                  <Lock size={20} />
                  <h3>Continue this idea</h3>
                  <p>Locked for V1. This is where Promptlaiy will turn the verdict into execution assets.</p>
                </div>
                <ul>
                  <li>Full product spec</li>
                  <li>Build prompt</li>
                  <li>Landing page copy</li>
                  <li>Task list</li>
                </ul>
                <button type="button" disabled>
                  Continue this idea
                  <Lock size={16} />
                </button>
              </section>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
