(function () {
  var leads = [
    {
      id: "maya",
      initials: "MC",
      name: "Maya Chen",
      service: "Garage door repair",
      time: "8 min ago",
      channel: "Website inquiry",
      meta: "North Hills · (412) 555-0148",
      request:
        "Our two-car garage door stopped halfway and is making a grinding sound. The car is stuck inside. Can someone come today?",
      draft:
        "Hi Maya — sorry you’re dealing with that, especially with the car stuck inside. We can take a look today. Please keep the door in place and don’t try to force it. I have an arrival window from 2–4 PM; would that work for you?",
      unread: true,
    },
    {
      id: "david",
      initials: "DR",
      name: "David Ruiz",
      service: "Spring replacement",
      time: "21 min ago",
      channel: "Text message",
      meta: "Oakmont · (412) 555-0192",
      request:
        "I heard a loud snap last night and now the door is very heavy. I think the spring broke. What would a replacement cost?",
      draft:
        "Hi David — that does sound like a broken spring. Please avoid operating the door until it’s inspected. Spring replacements usually start at $289, and we confirm the exact price before work begins. I can offer a 4–6 PM visit today or 9–11 AM tomorrow. Which is better?",
      unread: true,
    },
    {
      id: "sarah",
      initials: "SB",
      name: "Sarah Bell",
      service: "New door estimate",
      time: "47 min ago",
      channel: "Website inquiry",
      meta: "Sewickley · (724) 555-0131",
      request:
        "We’re replacing an old wood door and want something insulated in black. The opening is 16 feet. Can you quote a few options?",
      draft:
        "Hi Sarah — absolutely. We carry several insulated black doors for a 16-foot opening. The best next step is a free measurement visit so the quote is accurate. I have Thursday at 10 AM or Friday at 1 PM available. Would either time suit you?",
      unread: true,
    },
  ];

  leads.forEach(function (lead) {
    lead.originalDraft = lead.draft;
  });

  var selectedId = leads[0].id;
  var list = document.querySelector("#lead-list");
  var count = document.querySelector("#lead-count");
  var channel = document.querySelector("#lead-channel");
  var title = document.querySelector("#reply-title");
  var meta = document.querySelector("#lead-meta");
  var request = document.querySelector("#lead-request");
  var status = document.querySelector("#lead-status");
  var draft = document.querySelector("#draft-reply");
  var reset = document.querySelector("#reset-draft");
  var approve = document.querySelector("#approve-reply");
  var message = document.querySelector("#approval-message");

  function selectedLead() {
    return leads.find(function (lead) { return lead.id === selectedId; });
  }

  function renderList() {
    list.innerHTML = "";
    leads.forEach(function (lead) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "lead-card" + (lead.id === selectedId ? " selected" : "") + (lead.unread ? " unread" : "");
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-pressed", String(lead.id === selectedId));
      button.innerHTML =
        '<span class="avatar">' + lead.initials + '</span>' +
        '<span class="lead-card-copy"><strong>' + lead.name + '</strong><small>' + lead.service + '</small></span>' +
        '<span class="lead-time">' + lead.time + '</span>';
      button.addEventListener("click", function () {
        selectedId = lead.id;
        lead.unread = false;
        render();
      });
      list.appendChild(button);
    });
    var waiting = leads.filter(function (lead) { return lead.unread; }).length;
    count.textContent = waiting ? waiting + " waiting" : "Inbox clear";
  }

  function renderDetail() {
    var lead = selectedLead();
    channel.textContent = lead.channel;
    title.textContent = lead.name;
    meta.textContent = lead.meta;
    request.textContent = lead.request;
    draft.value = lead.draft;
    status.textContent = lead.approved ? "Approved" : "Needs reply";
    status.classList.toggle("approved", Boolean(lead.approved));
    approve.textContent = lead.approved ? "Approved" : "Approve reply";
    approve.disabled = Boolean(lead.approved);
    message.hidden = true;
  }

  function render() {
    renderList();
    renderDetail();
  }

  reset.addEventListener("click", function () {
    var lead = selectedLead();
    lead.draft = lead.originalDraft;
    draft.value = lead.originalDraft;
    draft.focus();
  });

  draft.addEventListener("input", function () {
    var lead = selectedLead();
    lead.draft = draft.value;
  });

  approve.addEventListener("click", function () {
    var lead = selectedLead();
    lead.approved = true;
    lead.unread = false;
    lead.draft = draft.value.trim() || lead.draft;
    renderList();
    status.textContent = "Approved";
    status.classList.add("approved");
    approve.textContent = "Approved";
    approve.disabled = true;
    message.textContent = "Reply approved. In a production product, this would be ready to send.";
    message.hidden = false;
  });

  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !approve.disabled) {
      event.preventDefault();
      approve.click();
    }
  });

  leads[0].unread = false;
  render();
})();
