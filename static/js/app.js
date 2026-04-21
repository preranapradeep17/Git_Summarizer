/* ─── State ───────────────────────────────────────────────────── */
let currentUrl = "";
let pollInterval = null;

/* ─── Helpers ─────────────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function fillExample(url) {
  $("repoUrl").value = url;
  $("repoUrl").focus();
  return false;
}

function parseMarkdown(text) {
  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").trim();

  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // ===== Horizontal line (==== or more)
    if (/^={2,}$/.test(line.trim())) {
      if (inList) { html += "</ul>"; inList = false; }
      html += "<hr>";
      continue;
    }

    // Headings: ####, ###, ##, #
    const h4 = line.match(/^#{4}\s+(.+)/);
    const h3 = line.match(/^#{3}\s+(.+)/);
    const h2 = line.match(/^#{2}\s+(.+)/);
    const h1 = line.match(/^#{1}\s+(.+)/);

    if (h4 || h3) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${inline(h4 ? h4[1] : h3[1])}</h3>`;
      continue;
    }
    if (h2) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2>${inline(h2[1])}</h2>`;
      continue;
    }
    if (h1) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h1>${inline(h1[1])}</h1>`;
      continue;
    }

    // Bullet: *, -, •
    const bullet = line.match(/^[\*\-•]\s+(.+)/);
    if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }

    // Numbered list
    const numbered = line.match(/^\d+\.\s+(.+)/);
    if (numbered) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(numbered[1])}</li>`;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<div class="md-spacer"></div>`;
      continue;
    }

    // Regular paragraph
    if (inList) { html += "</ul>"; inList = false; }
    html += `<p>${inline(line)}</p>`;
  }

  if (inList) html += "</ul>";
  return html;
}

function inline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function normalizeGithubUrl(input) {
  input = input.trim();
  if (input.startsWith("https://github.com/")) return input;
  if (input.startsWith("github.com/")) return "https://" + input;
  // Assume owner/repo format
  if (input.match(/^[\w\-]+\/[\w\-\.]+$/)) return "https://github.com/" + input;
  return input;
}

/* ─── Analysis ────────────────────────────────────────────────── */
async function startAnalysis() {
  let raw = $("repoUrl").value.trim();
  if (!raw) { $("repoUrl").focus(); return; }

  currentUrl = normalizeGithubUrl(raw);

  // UI state
  $("analyzeBtn").disabled = true;
  $("analyzeBtn").querySelector(".btn-text").textContent = "Starting...";
  $("progressSection").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
  $("hero").scrollIntoView({ behavior: "smooth" });

  // Extract repo name for display
  const parts = currentUrl.split("/");
  $("progressRepoName").textContent = parts.slice(-2).join("/");

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    });
    const data = await res.json();

    if (data.error) {
      showError(data.error);
      return;
    }

    if (data.status === "done") {
      // Cached result
      await fetchAndRenderStatus();
    } else {
      startPolling();
    }
  } catch (e) {
    showError("Failed to connect to server: " + e.message);
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(fetchAndRenderStatus, 2000);
}

async function fetchAndRenderStatus() {
  try {
    const res = await fetch("/api/status?url=" + encodeURIComponent(currentUrl));
    const data = await res.json();

    updateProgressUI(data.progress || 0, data.status);

    if (data.status === "done") {
      clearInterval(pollInterval);
      renderDashboard(data.data);
    } else if (data.status === "error") {
      clearInterval(pollInterval);
      showError(data.error || "Analysis failed.");
    }
  } catch (e) {
    console.error("Poll error:", e);
  }
}

function updateProgressUI(pct, msg) {
  $("progressBar").style.width = pct + "%";
  $("progressPct").textContent = pct + "%";

  const steps = [
    { id: "step1", threshold: 15 },
    { id: "step2", threshold: 45 },
    { id: "step3", threshold: 55 },
    { id: "step4", threshold: 75 },
    { id: "step5", threshold: 80 },
    { id: "step6", threshold: 95 },
  ];
  steps.forEach(({ id, threshold }) => {
    const el = $(id);
    if (pct >= threshold + 20) {
      el.className = "step done";
    } else if (pct >= threshold) {
      el.className = "step active";
    } else {
      el.className = "step";
    }
  });
}

/* ─── Dashboard Rendering ─────────────────────────────────────── */
function renderDashboard(data) {
  $("progressSection").classList.add("hidden");
  $("dashboard").classList.remove("hidden");

  const meta = data.repo_meta || {};
  const tech = data.tech_stack || {};
  const dep = data.dep_analysis || [];
  const issues = data.issues || [];

  // NEW: Update issue count
  $("issueCount").textContent = data.total_issues || 0;
  renderIssues(issues);

  // Meta strip
  $("metaName").textContent = meta.name || "—";
  $("metaLang").textContent = meta.language || "—";
  $("metaStars").textContent = meta.stars !== undefined ? meta.stars.toLocaleString() : "—";
  $("metaFiles").textContent = tech.total_files || "—";
  $("metaChunks").textContent = data.chunk_count || "—"; 

  // Overview
  $("overviewText").innerHTML = parseMarkdown(data.overview || "No overview generated."); 

  // Tech stack
  const langs = tech.languages || {};
  const maxCount = Math.max(...Object.values(langs), 1);
  $("langBadges").innerHTML = Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `
      <div class="lang-badge">${lang}<span class="count">${count}</span></div>
    `).join(""); 

  const frameworks = tech.frameworks || [];
  if (frameworks.length) {
    $("frameworkList").innerHTML = frameworks.map(f =>
      `<span class="framework-tag">${f}</span>`
    ).join("");
  }

  // Dependencies — bullet list
  const topDeps = dep.top_dependencies || [];
  if (topDeps.length) {
    $("depBars").innerHTML = `<div class="dep-list">` +
      topDeps.slice(0, 15).map(d => `
        <div class="dep-item">
          <div class="dep-bullet"></div>
          <span class="dep-name">${d.name}</span>
          <span class="dep-count">${d.count}</span>
        </div>
      `).join("") +
    `</div>`;
  }

  // Scroll to dashboard
  $("dashboard").scrollIntoView({ behavior: "smooth" });

  // Reset button
  $("analyzeBtn").disabled = false;
  $("analyzeBtn").querySelector(".btn-text").textContent = "Analyze";
}

function renderIssues(issues) {
  const container = $("issuesList");
  if (!container) return;

  if (!issues || issues.length === 0) {
    container.innerHTML = '<div class="no-issues">No open issues</div>';
    return;
  }

  container.innerHTML = issues.map((issue, i) => `
    <div class="issue-card">
      <div class="issue-header">
        <h4 class="issue-title">${issue.title}</h4>
        <a href="${issue.url}" target="_blank" class="issue-link">🔗</a>
      </div>
      <p class="issue-body">${issue.body ? issue.body.substring(0, 120) + "..." : "No description"}</p>
    </div>
  `).join("");
}

/* ─── Q&A Chat ────────────────────────────────────────────────── */
function addChatMsg(text, role, sources) {
  const win = $("chatWindow");
  const div = document.createElement("div");
  div.className = "chat-msg " + role;
  const icon = role === "user" ? "◉" : "◈";
  let sourcesHtml = "";
  if (sources && sources.length) {
    sourcesHtml = `<div class="sources-bar">Sources: ${sources.slice(0,4).map(s =>
      `<span class="source-chip">${s.file.split("/").pop()}</span>`
    ).join("")}</div>`;
  }
  div.innerHTML = `
    <div class="msg-icon">${icon}</div>
    <div>
      <div class="msg-text">${parseMarkdown(text)}</div>
      ${sourcesHtml}
    </div>
  `;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const win = $("chatWindow");
  const div = document.createElement("div");
  div.className = "chat-msg assistant";
  div.id = "typingIndicator";
  div.innerHTML = `
    <div class="msg-icon">◈</div>
    <div class="msg-text">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

async function sendQuery(prefill) {
  const input = $("queryInput");
  const query = prefill || input.value.trim();
  if (!query) return;
  if (!currentUrl) { alert("Please analyze a repository first."); return; }

  input.value = "";
  addChatMsg(query, "user");
  addTypingIndicator();

  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl, query }),
    });
    const data = await res.json();
    const indicator = $("typingIndicator");
    if (indicator) indicator.remove();

    if (data.error) {
      addChatMsg("⚠ " + data.error, "assistant");
    } else {
      addChatMsg(data.answer || "No answer generated.", "assistant", data.sources);
    }
  } catch (e) {
    const indicator = $("typingIndicator");
    if (indicator) indicator.remove();
    addChatMsg("Error: " + e.message, "assistant");
  }
}

/* ─── Error ───────────────────────────────────────────────────── */
function showError(msg) {
  $("progressSection").classList.add("hidden");
  $("analyzeBtn").disabled = false;
  $("analyzeBtn").querySelector(".btn-text").textContent = "Analyze";

  const existing = document.querySelector(".error-msg");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.className = "error-msg";
  el.textContent = "⚠ " + msg;
  $("hero").after(el);
  setTimeout(() => el.remove(), 8000);
}

/* ─── Enter key on URL input ──────────────────────────────────── */
$("repoUrl").addEventListener("keydown", e => {
  if (e.key === "Enter") startAnalysis();
});
