/* =====================================
   CLAIM DETAIL PAGE
   Shows a single claim's reliability score, sources,
   AI evidence verdicts, and reliability history.
===================================== */

const API = (typeof API_BASE !== "undefined" ? API_BASE : "http://localhost:3001");

const params = new URLSearchParams(window.location.search);
const claimId = params.get("claimId");

const TYPE_LABELS = {
  official: "🏛️ Official",
  media:    "📰 Media",
  document: "📄 Document",
  user:     "💬 Public / Social"
};

const STANCE_META = {
  supports:    { icon: "✅", color: "#16a34a", label: "Supports" },
  contradicts: { icon: "❌", color: "#dc2626", label: "Contradicts" },
  unrelated:   { icon: "⚠️", color: "#d97706", label: "Unrelated" },
  unanalyzed:  { icon: "➖", color: "#94a3b8", label: "Not analyzed" }
};

function esc(s) { return String(s == null ? "" : s).replace(/[<>]/g, ""); }
function scoreColor(s) { return s < 40 ? "#dc2626" : s < 70 ? "#f59e0b" : "#16a34a"; }

function statusBadge(status) {
  const map = {
    pending:  { bg: "#fef9c3", fg: "#854d0e", label: "Pending" },
    accepted: { bg: "#dcfce7", fg: "#166534", label: "Accepted" },
    verified: { bg: "#dbeafe", fg: "#1e40af", label: "Verified" },
    flagged:  { bg: "#fee2e2", fg: "#991b1b", label: "Flagged" },
    rejected: { bg: "#f1f5f9", fg: "#475569", label: "Rejected" }
  };
  const m = map[status] || map.pending;
  return `<span style="background:${m.bg};color:${m.fg};padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;text-transform:capitalize;">${m.label}</span>`;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

async function loadClaim() {
  const root = document.getElementById("claimDetail");
  if (!claimId) {
    root.innerHTML = `<p style="text-align:center;color:#64748b;padding:60px 20px;">No claim specified.</p>`;
    return;
  }
  try {
    const [claimRes, sourcesRes, historyRes] = await Promise.all([
      fetch(`${API}/api/claims/${claimId}`),
      fetch(`${API}/api/sources?claimId=${claimId}`),
      fetch(`${API}/api/evaluate/${claimId}/history`)
    ]);

    if (!claimRes.ok) {
      root.innerHTML = `<p style="text-align:center;color:#64748b;padding:60px 20px;">Claim not found.</p>`;
      return;
    }

    const claim = await claimRes.json();
    const sources = sourcesRes.ok ? await sourcesRes.json() : [];
    const history = historyRes.ok ? await historyRes.json() : [];
    render(claim, sources, history);
  } catch (err) {
    console.error("Claim load error:", err);
    root.innerHTML = `<p style="text-align:center;color:#dc2626;padding:60px 20px;">Error loading claim.</p>`;
  }
}

function renderHistory(history) {
  if (!Array.isArray(history) || history.length < 2) {
    return `<p style="font-size:12px;color:#94a3b8;padding:0 16px 16px;">Not enough evaluations yet to show a trend.</p>`;
  }
  const bars = history.map(h => {
    const sc = Math.max(0, Math.min(100, h.reliabilityScore ?? 0));
    const c = scoreColor(sc);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
      <span style="font-size:11px;font-weight:700;color:${c};margin-bottom:2px;">${sc}</span>
      <div style="width:100%;max-width:36px;height:${Math.max(6, sc)}%;background:${c};border-radius:4px 4px 0 0;"></div>
    </div>`;
  }).join("");
  const labels = history.map(h =>
    `<div style="flex:1;text-align:center;font-size:9px;color:#94a3b8;line-height:1.2;">${esc(h.note || "")}<br>${formatTime(h.createdAt)}</div>`
  ).join("");
  return `
    <div style="display:flex;align-items:flex-end;gap:6px;height:110px;padding:16px 16px 4px;">${bars}</div>
    <div style="display:flex;gap:6px;padding:0 16px 14px;">${labels}</div>`;
}

function renderSource(s, i) {
  const label = TYPE_LABELS[s.sourceType] || s.sourceType;
  const ref = s.sourceURL
    ? `<a href="${esc(s.sourceURL)}" target="_blank" rel="noopener" style="color:#2563eb;font-size:13px;word-break:break-all;">${esc(s.sourceURL)}</a>`
    : (s.fileName ? `<span style="font-size:13px;color:#475569;">📎 ${esc(s.fileName)}</span>` : "");

  let verdict = "";
  if (s.aiStance && s.aiStance !== "" && s.aiStance !== "unanalyzed") {
    const m = STANCE_META[s.aiStance] || STANCE_META.unanalyzed;
    verdict = `<div style="margin-top:8px;">
      <span style="font-size:12px;font-weight:700;color:${m.color};">${m.icon} ${m.label}</span>
      ${s.aiReason ? `<div style="font-size:11px;color:#475569;margin-top:2px;line-height:1.4;">${esc(s.aiReason)}</div>` : ""}
    </div>`;
  }

  let modNote = "";
  if (s.reviewStatus && s.reviewStatus !== "pending") {
    const colors = { relevant: "#16a34a", irrelevant: "#dc2626", outdated: "#d97706" };
    modNote = `<span style="font-size:11px;color:${colors[s.reviewStatus] || "#64748b"};margin-left:8px;">· moderator: ${esc(s.reviewStatus)}</span>`;
  }

  return `<div style="padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:13px;font-weight:700;color:#334155;">Source ${i + 1} — ${label}</span>
      ${modNote}
    </div>
    ${ref}
    ${verdict}
  </div>`;
}

function render(claim, sources, history) {
  const root = document.getElementById("claimDetail");
  const hasScore = claim.reliabilityScore !== null && claim.reliabilityScore !== undefined;
  const sc = hasScore ? claim.reliabilityScore : 0;
  const col = scoreColor(sc);
  const confidence = claim.confidenceLevel || "Pending";
  const loggedIn = !!localStorage.getItem("veridex_token");

  const sourcesHtml = sources.length
    ? sources.map(renderSource).join("")
    : `<p style="color:#64748b;padding:8px 0;">No sources attached to this claim.</p>`;

  root.innerHTML = `
    <a href="index.html" style="display:inline-block;margin-bottom:16px;color:#2563eb;font-size:14px;text-decoration:none;">← Back to all claims</a>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
        ${statusBadge(claim.status)}
        <span style="font-size:12px;color:#94a3b8;">Submitted ${formatDate(claim.createdAt)}</span>
      </div>
      <h1 style="font-size:22px;line-height:1.4;color:#1e293b;margin:0;">${esc(claim.claimText)}</h1>
    </div>

    <div style="background:#f8fafc;padding:28px;border-radius:16px;margin-bottom:20px;border:1px solid #e2e8f0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
        <div>
          <p style="font-size:12px;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Reliability Score</p>
          <p style="font-size:46px;font-weight:800;color:${col};margin:0;line-height:1;">${hasScore ? sc : "—"}</p>
          <p style="font-size:12px;color:#94a3b8;margin:4px 0 0;">/100</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:12px;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Confidence</p>
          <p style="font-size:18px;font-weight:700;color:${col};margin:0;text-transform:capitalize;">${esc(confidence)}</p>
          ${loggedIn ? `<button id="reEvalBtn" onclick="reEvaluate()" style="margin-top:12px;background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:20px;font-weight:700;cursor:pointer;font-size:13px;">↻ Re-evaluate</button>` : ""}
        </div>
      </div>
      <div style="background:#e2e8f0;border-radius:999px;height:8px;margin:16px 0 0;overflow:hidden;">
        <div style="height:100%;width:${sc}%;background:${col};border-radius:999px;transition:width .5s;"></div>
      </div>
    </div>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;overflow:hidden;">
      <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:14px;color:#1e293b;">📈 Reliability History</div>
      ${renderHistory(history)}
    </div>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;padding:16px;">
      <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:14px;">🔎 Sources & AI Evidence Check (${sources.length})</div>
      ${sourcesHtml}
    </div>

    <div style="text-align:center;margin-bottom:40px;">
      <a href="discussion.html?claimId=${esc(claimId)}" style="display:inline-block;background:#f1f5f9;color:#1e293b;border:1px solid #e2e8f0;padding:12px 26px;border-radius:30px;font-weight:700;text-decoration:none;font-size:14px;">💬 Open Discussion</a>
    </div>
  `;
}

async function reEvaluate() {
  const token = localStorage.getItem("veridex_token");
  if (!token) return;
  const btn = document.getElementById("reEvalBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Analyzing…"; }
  try {
    await fetch(`${API}/api/evaluate/${claimId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    await loadClaim();
  } catch (err) {
    console.error("Re-evaluate error:", err);
    if (btn) { btn.disabled = false; btn.textContent = "↻ Re-evaluate"; }
  }
}

loadClaim();
