document.querySelectorAll("form[data-lead]").forEach(function (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]');
    const confirm = form.querySelector(".lead-confirm");
    const btn = form.querySelector('button[type="submit"]');
    if (!email || !email.value) return;
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.value,
          source: window.location.pathname,
          company: form.querySelector('[name="company"]')?.value || "",
        }),
      });
      const result = await res.json().catch(() => ({ ok: false }));
      if (result.ok) {
        form.reset();
        if (confirm) {
          confirm.textContent = result.alreadySubscribed
            ? "You're already on the list."
            : "Check your inbox for the checklist.";
          confirm.hidden = false;
        }
      } else {
        if (confirm) {
          confirm.textContent = result.error || "Something went wrong. Please try again.";
          confirm.hidden = false;
        }
      }
    } catch {
      if (confirm) {
        confirm.textContent = "Could not reach the server. Please try again.";
        confirm.hidden = false;
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Get the checklist";
    }
  });
});
