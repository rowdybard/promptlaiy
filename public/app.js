const STORAGE_KEY = "promptlaiy-project-brief";
const form = document.querySelector("#application-form");
const steps = Array.from(document.querySelectorAll(".form-step"));
const stepItems = Array.from(document.querySelectorAll("#step-list li"));
const progressLabel = document.querySelector("#progress-label");
const progressMeter = document.querySelector("#progress-meter");
const backButton = document.querySelector("#back-button");
const nextButton = document.querySelector("#next-button");
const submitButton = document.querySelector("#submit-button");
const errorBox = document.querySelector("#form-error");
const successState = document.querySelector("#success-state");
const newBriefButton = document.querySelector("#new-brief-button");
const progressBar = document.querySelector(".meter");
let currentStep = 0;
let idempotencyKey = crypto.randomUUID();
const pageLoadTime = Date.now();

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveDraft() {
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    data.hostingInterest = document.querySelector("#hostingInterest").checked;
    data.idempotencyKey = idempotencyKey;
    delete data.company;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // The form still works when browser storage is blocked.
  }
}

function restoreDraft() {
  const draft = loadDraft();
  if (/^[a-zA-Z0-9-]{16,64}$/.test(draft.idempotencyKey || "")) {
    idempotencyKey = draft.idempotencyKey;
  }
  Object.entries(draft).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = String(value);
  });
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

async function relayOwnerNotification(data, result) {
  if (!result.requestId || !result.notificationToken) return;

  const packageLabels = {
    prototype: "$499 - Prototype + evaluation",
    domain: "$749 - Prototype + domain launch",
    unsure: "Not sure yet",
  };
  const handoff = new URL("/api/notify", window.location.origin);
  handoff.searchParams.set("requestId", result.requestId);
  handoff.searchParams.set("token", result.notificationToken);

  let success = false;
  let message = "The notification relay could not be reached.";
  try {
    const response = await fetch(handoff, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _subject: `New Promptlaiy project brief from ${data.name}`,
        _template: "table",
        _captcha: "false",
        _replyto: data.email,
        "Request ID": result.requestId,
        Name: data.name,
        Email: data.email,
        Package: packageLabels[data.package] || packageLabels.unsure,
        "Hosting interest": data.hostingInterest ? "Yes" : "No",
        Idea: data.idea,
        Audience: data.audience,
        Problem: data.problem,
        "Current alternative": data.alternative,
        "Why now": data.urgency,
        "Smallest useful version": data.smallestVersion,
      }),
    });
    const relayResult = await response.json().catch(() => ({}));
    success = response.ok && relayResult.success !== false && relayResult.success !== "false";
    message = String(relayResult.message || (success ? "Notification submitted." : "Notification relay failed."));
  } catch (error) {
    message = error instanceof Error ? error.message : message;
  }

  await fetch(handoff, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success, message }),
  }).catch(() => {});
}

function activeFields() {
  return Array.from(steps[currentStep].querySelectorAll("input, select, textarea")).filter(
    (field) => field.name !== "company"
  );
}

function validateStep() {
  clearError();
  const invalid = activeFields().find((field) => !field.checkValidity());
  if (!invalid) return true;
  invalid.focus();
  showError(invalid.validationMessage || "Please complete this step before continuing.");
  return false;
}

function renderStep() {
  steps.forEach((step, index) => {
    step.hidden = index !== currentStep;
  });
  stepItems.forEach((item, index) => {
    item.classList.toggle("active", index === currentStep);
    item.classList.toggle("done", index < currentStep);
  });
  progressLabel.textContent = `${currentStep + 1} of ${steps.length}`;
  progressMeter.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  progressBar.setAttribute("aria-valuenow", String(currentStep + 1));
  backButton.hidden = currentStep === 0;
  nextButton.hidden = currentStep === steps.length - 1;
  submitButton.hidden = currentStep !== steps.length - 1;
  clearError();
}

nextButton.addEventListener("click", () => {
  if (!validateStep()) return;
  saveDraft();
  currentStep += 1;
  renderStep();
  activeFields()[0]?.focus();
});

backButton.addEventListener("click", () => {
  saveDraft();
  currentStep = Math.max(0, currentStep - 1);
  renderStep();
  activeFields()[0]?.focus();
});

form.addEventListener("input", saveDraft);
form.addEventListener("change", saveDraft);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateStep()) return;

  clearError();
  submitButton.disabled = true;
  submitButton.textContent = "Sending brief...";

  const data = Object.fromEntries(new FormData(form).entries());
  data.hostingInterest = document.querySelector("#hostingInterest").checked;
  data.idempotencyKey = idempotencyKey;
  data.submitTime = Math.round((Date.now() - pageLoadTime) / 1000);

  try {
    const response = await fetch("/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({ ok: false }));
    if (!response.ok || !result.ok) throw new Error(result.error || "Could not send your brief.");

    localStorage.removeItem(STORAGE_KEY);
    form.hidden = true;
    form.previousElementSibling.hidden = true;
    successState.hidden = false;
    successState.focus();
    relayOwnerNotification(data, result).catch(() => {});
  } catch (error) {
    showError(error.message || "Could not send your brief. Please try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send project brief";
  }
});

newBriefButton.addEventListener("click", () => {
  form.reset();
  localStorage.removeItem(STORAGE_KEY);
  idempotencyKey = crypto.randomUUID();
  currentStep = 0;
  successState.hidden = true;
  form.hidden = false;
  form.previousElementSibling.hidden = false;
  renderStep();
  steps[0].querySelector("textarea").focus();
});

restoreDraft();
renderStep();
