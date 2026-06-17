const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const scoreLabels = {
  pain: "Pain",
  clarity: "Clarity",
  audience: "Audience",
  urgency: "Urgency",
  buildability: "Buildability",
  distribution: "Distribution",
  differentiation: "Differentiation",
  monetization: "Monetization",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function clean(value, maxLength = 1600) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function wordCount(text) {
  return clean(text).split(/\s+/).filter(Boolean).length;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function keywordScore(text, keywords, base) {
  const normalized = clean(text).toLowerCase();
  const hits = keywords.filter((keyword) => normalized.includes(keyword)).length;
  return Math.min(100, base + hits * 12 + Math.min(34, wordCount(text) * 3));
}

function createMockVerdict(idea, answers) {
  const brief = {
    idea: clean(idea),
    audience: clean(answers?.audience),
    problem: clean(answers?.problem),
    alternative: clean(answers?.alternative),
    urgency: clean(answers?.urgency),
    smallestVersion: clean(answers?.smallestVersion),
  };

  const scores = {
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
  const weakScores = Object.entries(scores).filter(([, value]) => value < 45).map(([key]) => scoreLabels[key]);

  let verdict = "SHRINK";
  if (scores.pain < 40 || scores.audience < 38) {
    verdict = "KILL";
  } else if (scores.urgency < 45 || scores.differentiation < 42 || scores.monetization < 45) {
    verdict = "PIVOT";
  } else if (scores.buildability < 55 || scores.clarity < 55 || weakScores.length >= 2) {
    verdict = "SHRINK";
  } else if (overall >= 66) {
    verdict = "BUILD";
  }

  const summaryByVerdict = {
    BUILD: "There is enough pain, audience clarity, and version-one shape to justify a fast build test.",
    SHRINK: "The idea has a useful signal, but the first version is still too wide. Cut it down before building.",
    PIVOT: "There may be something here, but the current angle is not sharp enough to earn attention today.",
    KILL: "The pain or audience is too soft right now. Save the learning, but do not spend build time yet.",
  };

  const nextByVerdict = {
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const idea = clean(payload?.idea);
  const answers = payload?.answers || {};
  if (idea.length < 20) {
    return jsonResponse({ ok: false, error: "Idea brain dump is too short." }, 400);
  }

  // Future seam: when OPENAI_API_KEY is configured, replace createMockVerdict
  // with an OpenAI call that returns the same VerdictResult shape.
  void env.OPENAI_API_KEY;

  return jsonResponse({
    ok: true,
    verdict: createMockVerdict(idea, answers),
  });
}
