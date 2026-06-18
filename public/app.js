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
let currentStep = 0;

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveDraft() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.hostingInterest = document.querySelector("#hostingInterest").checked;
  delete data.company;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreDraft() {
  const draft = loadDraft();
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

  try {
    const response = await fetch("/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Could not send your brief.");

    localStorage.removeItem(STORAGE_KEY);
    form.hidden = true;
    form.previousElementSibling.hidden = true;
    successState.hidden = false;
    successState.focus();
  } catch (error) {
    showError(error.message || "Could not send your brief. Please try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send project brief";
  }
});

newBriefButton.addEventListener("click", () => {
  form.reset();
  currentStep = 0;
  successState.hidden = true;
  form.hidden = false;
  form.previousElementSibling.hidden = false;
  renderStep();
  steps[0].querySelector("textarea").focus();
});

restoreDraft();
renderStep();
