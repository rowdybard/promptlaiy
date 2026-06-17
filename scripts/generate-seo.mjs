import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const siteUrl = "https://promptlaiy.pages.dev";
const distDir = path.resolve("dist");
const lastChecked = "June 17, 2026";

const sources = {
  codexPricing: "https://developers.openai.com/codex/pricing",
  codexRateCard: "https://help.openai.com/en/articles/20001106-codex-rate-card",
  cursorPricing: "https://cursor.com/pricing",
  cursorModels: "https://cursor.com/docs/models-and-pricing",
  anthropicPricing: "https://www.anthropic.com/pricing",
  copilotPricing: "https://github.com/features/copilot/plans",
  copilotBilling: "https://docs.github.com/copilot/reference/copilot-billing/models-and-pricing",
};

const relatedDefault = [
  { href: "/learn/", label: "Better prompting guide" },
  { href: "/agent-ide/", label: "What is an agent IDE?" },
  { href: "/ai-coding-agent-pricing/", label: "AI coding agent pricing reality" },
];

const pages = [
  {
    path: "/learn/",
    title: "Better Prompting For AI Coding Agents | Promptlaiy",
    description:
      "Learn better prompting for Codex, Cursor, and coding agents with examples, failure modes, and plain-English practice drills.",
    h1: "Better Prompting For AI Coding Agents",
    eyebrow: "Start here",
    intro:
      "Better prompting is not about fancy wording. It is about giving a coding agent enough goal, context, constraints, and output shape to do less guessing.",
    sections: [
      {
        heading: "The basic pattern",
        body: [
          "A useful coding-agent prompt has four parts: the outcome, the background, the limits, and the answer format. Founders usually skip the middle two, then blame the tool when it invents a product spec nobody asked for.",
          "Bad: Help me build my app. Better: Build a browser-only waitlist page for a coaching offer. Context: I have no backend yet and need to test demand today. Return the files changed, how to run it, and three manual checks.",
        ],
      },
      {
        heading: "What better prompting prevents",
        body: [
          "It prevents giant rewrites when you needed one small change. It prevents agents from choosing a stack because you forgot to name your constraints. It prevents vague answers that sound confident but leave you with no next step.",
          "The first Promptlaiy lesson focuses on one move: turn vague prompts into prompts with goal, context, and output format. That move is boring in the best possible way. It saves time.",
        ],
      },
      {
        heading: "Use this before every coding-agent run",
        list: [
          "Goal: what should be true when the task is done?",
          "Context: what should the tool know before touching anything?",
          "Constraints: what should it avoid changing?",
          "Output: do you want code, a checklist, a plan, a review, or a diff summary?",
        ],
      },
    ],
    faq: [
      {
        q: "Is better prompting just prompt engineering?",
        a: "For coding agents, better prompting is more practical. It is less about tricks and more about giving the agent the missing project context it cannot safely infer.",
      },
      {
        q: "Do non-coders need to learn this?",
        a: "Yes. If you use Codex or Cursor to build without writing every line yourself, your prompt becomes the spec. A fuzzy spec creates fuzzy code.",
      },
    ],
  },
  {
    path: "/agent-ide/",
    title: "What Is An Agent IDE? | Promptlaiy",
    description:
      "A plain-English explanation of agent IDEs: what they are, how they differ from chatbots, and why prompting matters.",
    h1: "What Is An Agent IDE?",
    eyebrow: "Agent IDE basics",
    intro:
      "An agent IDE is a coding workspace where the AI can read project files, edit code, run commands, and use tools from inside the development environment.",
    sections: [
      {
        heading: "The short version",
        body: [
          "A normal chatbot answers you. An agent IDE can act inside a codebase. It can inspect files, propose edits, change multiple files, run tests, and report what happened.",
          "Cursor, Windsurf, GitHub Copilot agent mode, JetBrains AI features, and Codex-style editor integrations all sit somewhere on this spectrum. The important part is not the label. The important part is what the tool is allowed to see and do.",
        ],
      },
      {
        heading: "Why founders should care",
        body: [
          "If you are not a full-time developer, an agent IDE can make software work feel less like staring at a blank editor. You describe the job, review the result, and keep narrowing the task until the thing works.",
          "That only works when your prompt is specific. Agent IDEs multiply both good instructions and bad instructions.",
        ],
      },
      {
        heading: "What an agent IDE usually includes",
        list: [
          "Project context from files, folders, docs, and open editor tabs.",
          "A chat or task panel where you describe work in natural language.",
          "Tools that let the agent edit files, run terminal commands, inspect errors, or open previews.",
          "Rules or instructions that tell the agent how the project should be handled.",
        ],
      },
    ],
    faq: [
      {
        q: "Is Cursor an agent IDE?",
        a: "Yes. Cursor is commonly described as an AI-first editor or agentic IDE because its agent can work across files and use codebase context.",
      },
      {
        q: "Is Codex an agent IDE?",
        a: "Codex is better described as a software engineering agent that can run in clients like a terminal or editor extension. It can still behave like an agentic coding workspace when connected to your repo and tools.",
      },
    ],
  },
  {
    path: "/agent-ide/how-it-works/",
    title: "How Agent IDEs Actually Work | Promptlaiy",
    description:
      "How agent IDEs use prompts, codebase context, tool calls, terminal output, and review loops to change software projects.",
    h1: "How Agent IDEs Actually Work",
    eyebrow: "Under the hood",
    intro:
      "Agent IDEs feel less mysterious when you break the loop down. The tool reads context, plans a change, edits files, runs checks, and asks the model what to do next.",
    sections: [
      {
        heading: "The loop",
        list: [
          "You write a prompt with the task and constraints.",
          "The IDE sends your prompt plus selected codebase context to a model.",
          "The model decides which files or commands matter.",
          "The agent edits, runs tools, reads errors, and revises.",
          "You review the diff and decide whether to keep going.",
        ],
      },
      {
        heading: "Where prompts go wrong",
        body: [
          "The model does not know your business, your launch deadline, your tolerance for risk, or which parts of the app are sacred unless you tell it. If you say \"make it better,\" you invited a redesign. If you say \"change only the waitlist copy and leave layout alone,\" you have a fighting chance.",
          "Better prompting is cost control, quality control, and scope control in one sentence.",
        ],
      },
      {
        heading: "The review step is not optional",
        body: [
          "Agent IDEs can create impressive diffs quickly, but quick is not the same as correct. Ask for a summary, tests run, files changed, risks, and what was not checked. That is how you stay in charge.",
        ],
      },
    ],
    faq: [
      {
        q: "Does the agent understand my whole repo?",
        a: "Sometimes, partially. Tools use context windows, retrieval, open files, rules, and search. You should still tell it which files or flows matter.",
      },
      {
        q: "Why do agents make unrelated changes?",
        a: "Usually because the prompt did not define boundaries. Name what to change, what to preserve, and what output you expect.",
      },
    ],
  },
  {
    path: "/agent-ide-vs-ai-code-assistant/",
    title: "Agent IDE vs AI Code Assistant vs Chatbot | Promptlaiy",
    description:
      "The practical difference between an agent IDE, an AI code assistant, and a chatbot for non-coders using AI coding tools.",
    h1: "Agent IDE vs AI Code Assistant vs Chatbot",
    eyebrow: "Choose the right tool",
    intro:
      "These tools blur together in marketing pages. For actual work, the difference is simple: how much context can it see, and what actions can it take?",
    sections: [
      {
        heading: "Chatbot",
        body: [
          "A chatbot is best for explaining, brainstorming, planning, and reviewing pasted snippets. It usually cannot see your repo unless you upload or paste context.",
        ],
      },
      {
        heading: "AI code assistant",
        body: [
          "A code assistant helps inside the editor. It can complete lines, answer questions, suggest changes, and sometimes edit selected files. It is useful, but often waits for you to drive.",
        ],
      },
      {
        heading: "Agent IDE",
        body: [
          "An agent IDE can take a broader task and work across files. It can plan, edit, run commands, read errors, and revise. That makes prompting more important, not less.",
        ],
      },
    ],
    faq: [
      {
        q: "Which one should a founder start with?",
        a: "Start with the tool you already have access to. Learn to write clear prompts before chasing every new IDE.",
      },
      {
        q: "Is an agent IDE always better?",
        a: "No. For small questions, a chatbot or autocomplete can be faster and cheaper. Use agents when the task needs context and multiple steps.",
      },
    ],
  },
  {
    path: "/prompting-coding-agents/",
    title: "How To Prompt Coding Agents Without Wasting A Day | Promptlaiy",
    description:
      "A practical guide to prompting Codex, Cursor, and coding agents without vague tasks, runaway edits, or wasted model usage.",
    h1: "How To Prompt Coding Agents Without Wasting A Day",
    eyebrow: "Prompting playbook",
    intro:
      "A coding agent can burn an afternoon politely. The fix is not longer prompts. The fix is clearer prompts with boundaries.",
    sections: [
      {
        heading: "The prompt template",
        body: [
          "Use this: Do [specific task]. Context: [what matters]. Constraints: [what not to touch]. Return: [format]. Verify by: [test or check].",
          "That template works because it closes the gaps agents usually fill with guesses.",
        ],
      },
      {
        heading: "Examples",
        list: [
          "Bad: Fix my site. Better: Fix the mobile waitlist form overflow. Context: the deployed page is Cloudflare Pages and the form posts to /api/waitlist. Do not change copy. Return files changed and a mobile check.",
          "Bad: Add SEO. Better: Add crawlable static pages for these routes, preserve the React app homepage, and generate sitemap.xml and robots.txt after build.",
          "Bad: Make this cheaper. Better: Review this agent workflow for token waste and suggest smaller tasks that preserve the same outcome.",
        ],
      },
      {
        heading: "Failure modes",
        body: [
          "If the agent changes too much, your prompt did not set boundaries. If it asks obvious questions, your context was missing. If it gives you a wall of explanation, your output format was weak.",
        ],
      },
    ],
    faq: [
      {
        q: "Should prompts be short or long?",
        a: "They should be complete. A short complete prompt beats a long vague one.",
      },
      {
        q: "What should I ask for after the agent finishes?",
        a: "Ask for files changed, what was tested, known risks, and the next smallest step.",
      },
    ],
  },
  {
    path: "/codex-vs-cursor-for-founders/",
    title: "Codex vs Cursor For Founders Who Do Not Code | Promptlaiy",
    description:
      "A founder-friendly comparison of Codex and Cursor focused on prompting, review, cost control, and getting small software tasks done.",
    h1: "Codex vs Cursor For Founders Who Do Not Code",
    eyebrow: "Tool choice",
    intro:
      "Codex and Cursor can both help you build, fix, and review software. The real question is where you want the agent to live: around your repo, inside your editor, or both.",
    sections: [
      {
        heading: "Use Codex when",
        list: [
          "You want a software engineering agent to inspect a repo, edit files, run commands, and summarize changes.",
          "You like task-style workflows where each job has a clear goal and acceptance criteria.",
          "You want the same prompting habits to work in a terminal, editor extension, or cloud task flow.",
        ],
      },
      {
        heading: "Use Cursor when",
        list: [
          "You want an editor-first experience with code, chat, agent mode, rules, and previews close together.",
          "You expect to sit inside the project and guide changes interactively.",
          "You want a familiar VS Code-like workspace with AI features built in.",
        ],
      },
      {
        heading: "The founder trap",
        body: [
          "Do not choose based on demos where the tool builds a whole app from one sentence. Choose based on whether you can prompt, review, and correct the tool on the messy version of your real idea.",
        ],
      },
    ],
    faq: [
      {
        q: "Should I learn both Codex and Cursor?",
        a: "Eventually, maybe. First learn the prompting pattern: goal, context, constraints, output, verification. That transfers across tools.",
      },
      {
        q: "Which is cheaper?",
        a: "It depends on current plan rules, model usage, and how many long agent runs you start. Check current pricing before buying a plan.",
      },
    ],
  },
  {
    path: "/ai-coding-agent-pricing/",
    title: "The Harsh Reality Of AI Coding Agent Pricing | Promptlaiy",
    description:
      "AI coding subscriptions are entry fees, not blank checks. Learn how Codex, Cursor, Claude Code, and Copilot pricing can surprise founders.",
    h1: "The Harsh Reality Of AI Coding Agent Pricing",
    eyebrow: "Pricing reality check",
    intro:
      "The spicy truth: the sticker price is not the ceiling. With coding agents, the real meter is model usage, credits, tokens, context, tool calls, and how often you let the agent wander.",
    pricing: true,
    sections: [
      {
        heading: `Last checked ${lastChecked}`,
        body: [
          `Pricing changes quickly. Check the official pages before buying: <a href="${sources.codexPricing}">OpenAI Codex pricing</a>, <a href="${sources.codexRateCard}">OpenAI Codex rate card</a>, <a href="${sources.cursorPricing}">Cursor pricing</a>, <a href="${sources.cursorModels}">Cursor models and pricing</a>, <a href="${sources.anthropicPricing}">Anthropic pricing</a>, and <a href="${sources.copilotPricing}">GitHub Copilot pricing</a>.`,
        ],
      },
      {
        heading: "Subscriptions are entry fees",
        body: [
          "A monthly subscription can get you access. It does not mean every model, every long-running task, every cloud agent, and every code review is unlimited forever. The industry is moving toward usage-aware billing because frontier model runs are expensive to serve.",
          "That does not make the tools bad. It means sloppy prompting gets taxed.",
        ],
      },
      {
        heading: "Where the money leaks",
        list: [
          "Huge context: the agent rereads too much code because the prompt never named the relevant files.",
          "Vague goals: the agent explores three possible products when you needed one landing page tweak.",
          "Unbounded tasks: \"make it better\" becomes redesign, refactor, test, and debate club.",
          "Expensive models: frontier models are great, but using them for tiny edits is buying a chainsaw for a sandwich.",
        ],
      },
      {
        heading: "The cheaper habit",
        body: [
          "Write smaller prompts. Name the target files. State what not to change. Ask for a plan before edits when the task is large. Ask for tests and risks after edits. Better prompting does not just improve quality; it reduces unnecessary runs.",
        ],
      },
    ],
    faq: [
      {
        q: "Are AI coding agents too expensive?",
        a: "They can be cheap for focused work and painful for vague, repeated, long-running tasks. The same subscription can feel generous or tiny depending on prompt quality and model choice.",
      },
      {
        q: "How do I control coding-agent cost?",
        a: "Use smaller tasks, cheaper models when appropriate, explicit file scope, clear stop conditions, and review checkpoints before letting the agent keep running.",
      },
    ],
  },
  {
    path: "/vibe-coding-costs/",
    title: "Vibe Coding Gets Expensive When You Stop Watching The Meter | Promptlaiy",
    description:
      "A blunt guide to why vibe coding can burn agent usage fast and how better prompting keeps experiments smaller and cheaper.",
    h1: "Vibe Coding Gets Expensive When You Stop Watching The Meter",
    eyebrow: "Spicy cost guide",
    intro:
      "Vibe coding is fun until the agent spends premium model usage exploring every hallway in your repo. The meter does not care that you were in flow.",
    pricing: true,
    sections: [
      {
        heading: `Last checked ${lastChecked}`,
        body: [
          `The pricing backdrop changes fast. Start with the official pages for <a href="${sources.codexPricing}">Codex</a>, <a href="${sources.cursorPricing}">Cursor</a>, <a href="${sources.anthropicPricing}">Claude</a>, and <a href="${sources.copilotBilling}">Copilot model billing</a>.`,
        ],
      },
      {
        heading: "The problem with vibes",
        body: [
          "Vibes are not a spec. A coding agent needs a target. Without one, it uses tokens to discover what you meant, then more tokens to patch what it guessed, then more tokens to explain why the patch is weird.",
        ],
      },
      {
        heading: "Use vibe coding like a sketchpad",
        list: [
          "Prototype ideas in small chunks.",
          "Stop after each working slice and review.",
          "Write down the prompt that worked.",
          "Turn the next idea into a narrow task before running the agent again.",
        ],
      },
      {
        heading: "The Promptlaiy rule",
        body: [
          "If you cannot say the goal, context, and output format, you are not ready to spend an agent run. Do one prompt drill first.",
        ],
      },
    ],
    faq: [
      {
        q: "Is vibe coding bad?",
        a: "No. It is useful for exploration. It becomes expensive when exploration pretends to be a finished plan.",
      },
      {
        q: "Can better prompting make vibe coding cheaper?",
        a: "Yes. Clear prompts shrink the search space, reduce retries, and make review easier.",
      },
    ],
  },
  {
    path: "/ai-coding-agent-glossary/",
    title: "Agent IDE, Context Window, Tool Calls, Tokens, And Other Terms | Promptlaiy",
    description:
      "A plain-English glossary for founders learning AI coding agents, agent IDEs, tokens, tool calls, context windows, and model usage.",
    h1: "Agent IDE, Context Window, Tool Calls, Tokens, And Other Terms",
    eyebrow: "Glossary",
    intro:
      "AI coding tools come with a pile of terms. Here are the ones that matter when you are trying to prompt, build, and avoid surprise costs.",
    sections: [
      {
        heading: "Agent IDE",
        body: ["A coding workspace where an AI agent can read files, edit code, run tools, and help complete tasks across a project."],
      },
      {
        heading: "Context window",
        body: ["The amount of text, code, logs, and instructions a model can consider at once. Bigger helps, but relevant context matters more than raw size."],
      },
      {
        heading: "Tool call",
        body: ["When an agent uses a capability outside pure text generation, such as editing a file, searching a repo, running a command, or opening a browser."],
      },
      {
        heading: "Token",
        body: ["A chunk of text used for model billing and limits. Prompts, code context, logs, and answers all consume tokens in different ways depending on the product."],
      },
      {
        heading: "Rules or instructions",
        body: ["Project-specific guidance that tells the agent how to behave: coding style, files to avoid, testing commands, and review expectations."],
      },
    ],
    faq: [
      {
        q: "Which term should I learn first?",
        a: "Context. Most prompt failures happen because the agent had too little, too much, or the wrong kind of context.",
      },
      {
        q: "Why do tokens matter to non-coders?",
        a: "Because tokens often drive usage limits or cost. A sloppy prompt can make the agent read and write far more than needed.",
      },
    ],
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function absoluteUrl(route) {
  return `${siteUrl}${route}`;
}

function renderJsonLd(page) {
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.description,
    author: { "@type": "Organization", name: "Promptlaiy" },
    publisher: { "@type": "Organization", name: "Promptlaiy" },
    mainEntityOfPage: absoluteUrl(page.path),
    datePublished: "2026-06-17",
    dateModified: "2026-06-17",
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Promptlaiy", item: siteUrl },
      { "@type": "ListItem", position: 2, name: page.h1, item: absoluteUrl(page.path) },
    ],
  };
  return [article, faq, breadcrumbs]
    .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
    .join("\n");
}

function renderSection(section) {
  const body = section.body?.map((paragraph) => `<p>${paragraph}</p>`).join("\n") || "";
  const list = section.list
    ? `<ul>${section.list.map((item) => `<li>${item}</li>`).join("\n")}</ul>`
    : "";
  return `<section class="article-section">
    <h2>${escapeHtml(section.heading)}</h2>
    ${body}
    ${list}
  </section>`;
}

function renderWaitlist(page) {
  return `<section class="cta" id="waitlist">
    <div>
      <p class="eyebrow">Try the prompt drills</p>
      <h2>Get the next Promptlaiy lessons.</h2>
      <p>Join the beta list for new prompt drills, agent workflow examples, and early pricing access.</p>
    </div>
    <form method="post" action="/api/waitlist">
      <input type="hidden" name="source" value="seo:${page.path}" />
      <input type="hidden" name="betaInterest" value="seo_content_hub" />
      <input type="hidden" name="returnTo" value="${page.path}" />
      <input class="honeypot" aria-hidden="true" name="company" tabindex="-1" autocomplete="off" />
      <label for="email-${page.path.replaceAll("/", "-")}">Email</label>
      <div class="form-row">
        <input id="email-${page.path.replaceAll("/", "-")}" type="email" name="email" placeholder="founder@example.com" required />
        <button type="submit">Join waitlist</button>
      </div>
      <p class="form-note">No spam. Just beta updates and new lessons.</p>
    </form>
  </section>`;
}

function renderAnalyticsScript(source) {
  return `<script>
    (() => {
      const payload = {
        eventName: "page_view",
        source: "${source}",
        path: window.location.pathname,
        referrer: document.referrer
      };
      fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    })();
  </script>`;
}

function renderPage(page) {
  const canonical = absoluteUrl(page.path);
  const related = (page.related || relatedDefault).filter((item) => item.href !== page.path);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="Promptlaiy" />
  <meta name="twitter:card" content="summary_large_image" />
  ${renderJsonLd(page)}
  <style>
    :root { color: #15201b; background: #f8f6ee; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; background: linear-gradient(180deg, #f8f6ee, #eef4e8); }
    a { color: #116c48; font-weight: 850; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px clamp(18px, 4vw, 48px); border-bottom: 1px solid rgba(21,32,27,.14); background: rgba(248,246,238,.92); position: sticky; top: 0; z-index: 2; }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: #15201b; text-decoration: none; font-weight: 950; font-size: 18px; }
    .brand-mark { display: grid; width: 34px; height: 34px; place-items: center; border: 2px solid #15201b; border-radius: 8px; background: #9fe870; box-shadow: 3px 3px 0 #15201b; }
    nav { display: flex; flex-wrap: wrap; gap: 10px; }
    nav a { color: #2d3a34; text-decoration: none; font-size: 14px; padding: 8px 10px; border-radius: 8px; }
    nav a:hover { background: rgba(21,32,27,.07); }
    main { width: min(1060px, calc(100% - 28px)); margin: 0 auto; }
    .hero { padding: clamp(42px, 8vw, 92px) 0 28px; }
    .eyebrow { margin: 0 0 10px; color: #47715e; font-size: 12px; font-weight: 950; text-transform: uppercase; }
    h1 { max-width: 900px; margin: 0; font-size: clamp(42px, 8vw, 86px); line-height: .92; letter-spacing: 0; }
    .intro { max-width: 760px; margin: 22px 0 0; color: #415048; font-size: clamp(18px, 2vw, 22px); line-height: 1.45; font-weight: 700; }
    .notice { margin-top: 18px; padding: 14px 16px; border: 1px solid rgba(21,32,27,.14); border-radius: 8px; background: #fff9dc; color: #4f4530; font-weight: 750; }
    .article-shell { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 28px; align-items: start; padding: 20px 0 42px; }
    article { display: grid; gap: 18px; }
    .article-section, .faq, .cta, .related, .toc { border: 1px solid rgba(21,32,27,.14); border-radius: 8px; background: rgba(255,255,255,.76); box-shadow: 0 18px 50px rgba(61,67,56,.1); padding: clamp(18px, 3vw, 28px); }
    h2 { margin: 0 0 12px; font-size: clamp(26px, 4vw, 40px); line-height: 1; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 21px; }
    p, li { color: #435149; font-size: 17px; line-height: 1.62; font-weight: 650; }
    p { margin: 0 0 12px; }
    p:last-child { margin-bottom: 0; }
    ul { margin: 0; padding-left: 20px; }
    li + li { margin-top: 8px; }
    .toc { position: sticky; top: 82px; display: grid; gap: 10px; }
    .toc a { text-decoration: none; }
    .faq { margin-top: 8px; }
    .faq-item + .faq-item { margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(21,32,27,.12); }
    .cta { display: grid; grid-template-columns: .9fr 1.1fr; gap: 20px; margin: 10px 0; background: #15201b; color: #fff; }
    .cta h2, .cta p, .cta label { color: #fff; }
    form { display: grid; gap: 8px; align-self: center; }
    label { font-weight: 900; }
    .form-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 8px; border-radius: 8px; background: #fff; }
    input { min-width: 0; min-height: 44px; border: 0; padding: 0 10px; outline: none; font: inherit; font-weight: 750; }
    button { min-height: 44px; border: 1px solid #15201b; border-radius: 8px; padding: 0 16px; background: #9fe870; color: #15201b; font: inherit; font-weight: 950; cursor: pointer; box-shadow: 3px 3px 0 #15201b; }
    .form-note { color: rgba(255,255,255,.72); font-size: 14px; }
    .honeypot { position: absolute; left: -10000px; width: 1px; height: 1px; opacity: 0; }
    .related { margin-bottom: 42px; }
    .related-links { display: flex; flex-wrap: wrap; gap: 10px; }
    .related-links a { padding: 9px 11px; border-radius: 8px; background: #e8f7ff; text-decoration: none; }
    footer { padding: 24px 0 46px; color: #526058; font-weight: 750; }
    @media (max-width: 860px) { .topbar { align-items: flex-start; flex-direction: column; } .article-shell, .cta { grid-template-columns: 1fr; } .toc { position: static; } .form-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/"><span class="brand-mark">P</span><span>Promptlaiy</span></a>
    <nav aria-label="Primary">
      <a href="/">Practice</a>
      <a href="/learn/">Learn</a>
      <a href="/agent-ide/">Agent IDE</a>
      <a href="/ai-coding-agent-pricing/">Pricing reality</a>
      <a href="#waitlist">Waitlist</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
      <h1>${escapeHtml(page.h1)}</h1>
      <p class="intro">${escapeHtml(page.intro)}</p>
      ${page.pricing ? `<p class="notice">Last checked ${lastChecked}. Pricing changes fast; this page links to official vendor pricing instead of pretending the meter is frozen.</p>` : ""}
    </section>
    <section class="article-shell">
      <article>
        ${page.sections.map(renderSection).join("\n")}
        <section class="faq">
          <h2>FAQ</h2>
          ${page.faq
            .map((item) => `<div class="faq-item"><h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p></div>`)
            .join("\n")}
        </section>
        ${renderWaitlist(page)}
      </article>
      <aside class="toc" aria-label="Related pages">
        <p class="eyebrow">Keep learning</p>
        ${related.map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join("\n")}
      </aside>
    </section>
    <section class="related">
      <h2>Next reads</h2>
      <div class="related-links">
        ${related.map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join("\n")}
      </div>
    </section>
  </main>
  <footer>
    <main>Promptlaiy teaches better prompting for Codex, Cursor, and coding agents through short browser drills. <a href="/sitemap/">Browse every guide</a>.</main>
  </footer>
  ${renderAnalyticsScript("seo")}
</body>
</html>`;
}

function renderHtmlSitemap() {
  const itemList = pages.map((page, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: absoluteUrl(page.path),
    name: page.h1,
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Promptlaiy Guides",
    description: "All Promptlaiy guides about better prompting, agent IDEs, Codex, Cursor, and AI coding agent pricing.",
    url: absoluteUrl("/sitemap/"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: itemList,
    },
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>All Promptlaiy Guides | Better Prompting, Agent IDEs, Codex, Cursor</title>
  <meta name="description" content="Browse every Promptlaiy guide about better prompting, agent IDEs, AI coding agents, Codex, Cursor, and AI coding agent pricing." />
  <link rel="canonical" href="${absoluteUrl("/sitemap/")}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="All Promptlaiy Guides" />
  <meta property="og:description" content="Browse every Promptlaiy guide about better prompting, agent IDEs, Codex, Cursor, and AI coding agent pricing." />
  <meta property="og:url" content="${absoluteUrl("/sitemap/")}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root { color: #15201b; background: #f8f6ee; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; background: linear-gradient(180deg, #f8f6ee, #eef4e8); }
    a { color: #116c48; font-weight: 850; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px clamp(18px, 4vw, 48px); border-bottom: 1px solid rgba(21,32,27,.14); background: rgba(248,246,238,.92); }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: #15201b; text-decoration: none; font-weight: 950; font-size: 18px; }
    .brand-mark { display: grid; width: 34px; height: 34px; place-items: center; border: 2px solid #15201b; border-radius: 8px; background: #9fe870; box-shadow: 3px 3px 0 #15201b; }
    nav { display: flex; flex-wrap: wrap; gap: 10px; }
    nav a { color: #2d3a34; text-decoration: none; font-size: 14px; padding: 8px 10px; border-radius: 8px; }
    main { width: min(1060px, calc(100% - 28px)); margin: 0 auto; }
    .hero { padding: clamp(42px, 8vw, 84px) 0 24px; }
    .eyebrow { margin: 0 0 10px; color: #47715e; font-size: 12px; font-weight: 950; text-transform: uppercase; }
    h1 { max-width: 900px; margin: 0; font-size: clamp(42px, 8vw, 80px); line-height: .94; letter-spacing: 0; }
    .intro { max-width: 740px; margin: 20px 0 0; color: #415048; font-size: clamp(18px, 2vw, 22px); line-height: 1.45; font-weight: 700; }
    .guide-list { display: grid; gap: 12px; margin: 8px 0 48px; padding: 0; list-style: none; }
    .guide-list li { padding: clamp(16px, 3vw, 24px); border: 1px solid rgba(21,32,27,.14); border-radius: 8px; background: rgba(255,255,255,.78); box-shadow: 0 18px 50px rgba(61,67,56,.1); }
    .guide-list a { display: inline-block; margin-bottom: 8px; color: #15201b; font-size: clamp(22px, 3vw, 32px); line-height: 1.04; text-decoration: none; }
    .guide-list p { margin: 0; color: #435149; font-size: 17px; line-height: 1.55; font-weight: 650; }
    footer { padding: 24px 0 46px; color: #526058; font-weight: 750; }
  </style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/"><span class="brand-mark">P</span><span>Promptlaiy</span></a>
    <nav aria-label="Primary">
      <a href="/">Practice</a>
      <a href="/learn/">Learn</a>
      <a href="/agent-ide/">Agent IDE</a>
      <a href="/ai-coding-agent-pricing/">Pricing reality</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <p class="eyebrow">Guide index</p>
      <h1>All Promptlaiy Guides</h1>
      <p class="intro">A crawlable index of every Promptlaiy page about better prompting, agent IDEs, Codex, Cursor, and AI coding agent pricing.</p>
    </section>
    <ol class="guide-list">
      ${pages
        .map(
          (page) => `<li>
        <a href="${page.path}">${escapeHtml(page.h1)}</a>
        <p>${escapeHtml(page.description)}</p>
      </li>`,
        )
        .join("\n")}
    </ol>
  </main>
  <footer>
    <main><a href="/sitemap.xml">XML sitemap</a> for crawlers.</main>
  </footer>
  ${renderAnalyticsScript("seo-sitemap")}
</body>
</html>`;
}

async function writePage(page) {
  const outputDir = path.join(distDir, page.path);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "index.html"), renderPage(page), "utf8");
}

async function writeHtmlSitemap() {
  const outputDir = path.join(distDir, "sitemap");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "index.html"), renderHtmlSitemap(), "utf8");
}

function renderSitemap() {
  const urls = ["/", "/sitemap/", ...pages.map((page) => page.path)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (route) => `  <url>
    <loc>${absoluteUrl(route)}</loc>
    <lastmod>2026-06-17</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

async function main() {
  await Promise.all(pages.map(writePage));
  await writeHtmlSitemap();
  await writeFile(path.join(distDir, "sitemap.xml"), renderSitemap(), "utf8");
  await writeFile(
    path.join(distDir, "robots.txt"),
    `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`,
    "utf8",
  );
}

await main();
