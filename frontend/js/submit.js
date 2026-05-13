document.addEventListener("DOMContentLoaded", () => {

  /* ================================================================
     DOM REFERENCES
  ================================================================ */
  const submitContainer = document.getElementById("submitContainer");
  const loginBlock      = document.getElementById("loginBlock");
  const sourcesContainer = document.getElementById("sourcesContainer");
  const addSourceBtn    = document.getElementById("addSourceBtn");
  const claimError      = document.getElementById("claimError");
  const sourceError     = document.getElementById("sourceError");
  const submitBtn       = document.getElementById("submitBtn");
  const btnText         = document.getElementById("btnText");
  const btnLoader       = document.getElementById("btnLoader");

  const token = localStorage.getItem("veridex_token");

  if (!token) {
    loginBlock.style.display = "block";
    submitContainer.style.display = "none";
  } else {
    loginBlock.style.display = "none";
    submitContainer.style.display = "block";
  }

  /* ================================================================
     RULE 1 — CLAIM VALIDATION CONSTANTS
  ================================================================ */
  const CLAIM_ALLOWED  = /^[A-Za-z0-9 .,%-]+$/;
  const ONLY_NUMBERS   = /^\d+$/;
  const MAX_CLAIM_LEN  = 300;
  const MIN_CLAIM_LEN  = 10;

  /* ================================================================
     RULE 3 — OFFICIAL DOMAIN LISTS
  ================================================================ */
  const OFFICIAL_ALLOWED = [
    ".gov.in", ".nic.in", ".gov", ".int",
    "who.int", "un.org", "unicef.org", "worldbank.org",
    "imf.org", "wto.org", "ilo.org", "unesco.org",
    "rbi.org.in", "sebi.gov.in", "pib.gov.in",
    "mygov.in", "india.gov.in", "mohfw.gov.in",
    "meity.gov.in", "mhrd.gov.in"
  ];

  const BLOCKED_DOMAINS = [
    "youtube.com", "youtu.be", "twitter.com", "x.com",
    "instagram.com", "facebook.com", "tiktok.com",
    "reddit.com", "linkedin.com", "pinterest.com",
    "medium.com", "blogspot.com", "wordpress.com",
    "tumblr.com", "quora.com", "wikipedia.org"
  ];

  /* ================================================================
     HELPERS
  ================================================================ */
  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    el.style.color = "#dc2626";
  }

  function showWarn(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    el.style.color = "#d97706";
  }

  function clearError(el) {
    if (!el) return;
    el.textContent = "";
    el.style.display = "none";
  }

  function clearErrors() {
    clearError(claimError);
    clearError(sourceError);
  }

  function getHostname(url) {
    try { return new URL(url).hostname.toLowerCase(); }
    catch { return null; }
  }

  function isOfficialDomain(hostname) {
    return OFFICIAL_ALLOWED.some(d =>
      hostname === d || hostname.endsWith("." + d) || hostname.endsWith(d)
    );
  }

  function isBlockedDomain(hostname) {
    return BLOCKED_DOMAINS.some(d =>
      hostname === d || hostname.endsWith("." + d)
    );
  }

  function extractKeywords(text) {
    const stop = new Set([
      "the","and","for","that","this","with","from","have","are","was",
      "were","been","has","not","but","they","their","will","would","could",
      "should","about","into","than","then","when","which","what","who"
    ]);
    const words = (text.match(/[A-Za-z]{4,}/g) || []).map(w => w.toLowerCase());
    return [...new Set(words.filter(w => !stop.has(w)))];
  }

  /* ================================================================
     RULE 1 — LIVE CLAIM TEXT VALIDATION (on input)
  ================================================================ */
  const claimInput = document.getElementById("claimText");
  const charCount  = document.getElementById("claimCharCount");

  claimInput?.addEventListener("input", () => {
    const text = claimInput.value.trim();
    const len  = text.length;

    if (charCount) charCount.textContent = `${claimInput.value.length} / ${MAX_CLAIM_LEN}`;

    if (!text) { showError(claimError, "Claim is required"); return; }
    if (len < MIN_CLAIM_LEN) { showError(claimError, `Claim must be at least ${MIN_CLAIM_LEN} characters`); return; }
    if (len > MAX_CLAIM_LEN) { showError(claimError, `Claim must not exceed ${MAX_CLAIM_LEN} characters`); return; }
    if (!CLAIM_ALLOWED.test(text)) {
      showError(claimError, "Only letters, numbers, spaces and . , % are allowed — no special characters or emojis");
      return;
    }
    if (ONLY_NUMBERS.test(text.replace(/\s/g, ""))) {
      showError(claimError, "Claim must not consist of numbers only");
      return;
    }
    const words = (text.match(/[A-Za-z]+/g) || []);
    if (words.length < 2) {
      showError(claimError, "Claim must contain at least two words representing a factual statement");
      return;
    }
    clearError(claimError);
  });

  /* ================================================================
     SOURCE BLOCKS
  ================================================================ */
  const MAX_SOURCES = 5;
  const TYPE_LABELS = {
    official: "🏛️ Official source",
    media:    "📰 Media source",
    document: "📄 Document source",
    user:     "💬 Social/Public source"
  };
  const TYPE_SCORES = { official: 40, document: 30, media: 25, user: 10 };

  function createSourceBlock() {
    const count = document.querySelectorAll(".source-block").length;
    if (count >= MAX_SOURCES) {
      showError(sourceError, `Maximum ${MAX_SOURCES} sources allowed`);
      return;
    }

    const block = document.createElement("div");
    block.className = "source-block";
    block.style.cssText = "margin-bottom:16px;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;";

    block.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <label class="source-num-label" style="font-weight:700;color:#475569;font-size:14px;">Source ${count + 1}</label>
        ${count > 0 ? `<button type="button" class="remove-source-btn" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:22px;line-height:1;">&times;</button>` : ""}
      </div>

      <label style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">Source Type *</label>
      <select class="sourceType" style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;margin:6px 0 12px;background:white;cursor:pointer;">
        <option value="">— Select source type —</option>
        <option value="official">🏛️ Official (Government / International Org)</option>
        <option value="media">📰 Media (News Organisation)</option>
        <option value="document">📄 Document (PDF / Report)</option>
        <option value="user">💬 Public / Social Media</option>
      </select>

      <label style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">Reference URL</label>
      <input type="url" class="sourceURL"
        placeholder="https://example.gov.in/notice"
        style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;margin:6px 0 4px;box-sizing:border-box;" />
      <div class="url-error" style="color:#dc2626;font-size:12px;min-height:16px;margin-bottom:8px;"></div>

      <label style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">Or Upload PDF (max 5 MB)</label>
      <input type="file" class="referenceFile" accept=".pdf" style="margin-top:6px;width:100%;display:block;" />
      <div class="file-error" style="color:#dc2626;font-size:12px;min-height:16px;"></div>
      <div class="pdf-relevance" style="display:none;margin-top:6px;padding:8px 12px;border-radius:8px;font-size:12px;"></div>
    `;

    // Remove button
    block.querySelector(".remove-source-btn")?.addEventListener("click", () => {
      block.remove();
      updateSourceNumbers();
      clearError(sourceError);
    });

    // Live URL validation on blur
    const urlInput = block.querySelector(".sourceURL");
    const urlErrEl = block.querySelector(".url-error");
    const typeSelect = block.querySelector(".sourceType");

    urlInput.addEventListener("blur", () => {
      const url = urlInput.value.trim();
      const type = typeSelect.value;
      if (!url) { urlErrEl.textContent = ""; return; }
      const err = validateURLFrontend(url, type);
      urlErrEl.textContent = err || "";
    });

    typeSelect.addEventListener("change", () => {
      const url = urlInput.value.trim();
      if (!url) return;
      const err = validateURLFrontend(url, typeSelect.value);
      urlErrEl.textContent = err || "";
    });

    // Live file size validation
    const fileInput = block.querySelector(".referenceFile");
    const fileErrEl = block.querySelector(".file-error");

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      fileErrEl.textContent = "";
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        fileErrEl.textContent = "Only PDF files are allowed for upload";
        fileInput.value = "";
        return;
      }
      if (file.size === 0) {
        fileErrEl.textContent = "File is empty";
        fileInput.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        fileErrEl.textContent = "File must be under 5 MB";
        fileInput.value = "";
        return;
      }
    });

    sourcesContainer.appendChild(block);
  }

  /* Validate URL on frontend (returns error string or null) */
  function validateURLFrontend(url, sourceType) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return "URL must start with http:// or https://";
    }
    const hostname = getHostname(url);
    if (!hostname) return "Invalid URL format";

    if (isBlockedDomain(hostname)) {
      return `"${hostname}" is not accepted as a reliable source`;
    }

    if (sourceType === "official" && !isOfficialDomain(hostname)) {
      return "Please provide a valid official government or organisation website link (.gov.in, .nic.in, .int, etc.)";
    }

    return null;
  }

  function updateSourceNumbers() {
    document.querySelectorAll(".source-block").forEach((b, i) => {
      const lbl = b.querySelector(".source-num-label");
      if (lbl) lbl.textContent = `Source ${i + 1}`;
    });
  }

  addSourceBtn.addEventListener("click", createSourceBlock);
  createSourceBlock(); // first block by default

  /* ================================================================
     SUBMIT HANDLER — full validation before API call
  ================================================================ */
  submitBtn.addEventListener("click", async () => {
    clearErrors();

    const currentToken = localStorage.getItem("veridex_token");
    if (!currentToken) {
      showError(claimError, "You must be logged in to submit a claim");
      return;
    }

    /* ── Rule 1: Claim text ─────────────────────────────────── */
    const claimText = (claimInput?.value || "").trim();

    if (!claimText) { showError(claimError, "Claim is required"); return; }
    if (claimText.length < MIN_CLAIM_LEN) {
      showError(claimError, `Claim must be at least ${MIN_CLAIM_LEN} characters`); return;
    }
    if (claimText.length > MAX_CLAIM_LEN) {
      showError(claimError, `Claim must not exceed ${MAX_CLAIM_LEN} characters`); return;
    }
    if (!CLAIM_ALLOWED.test(claimText)) {
      showError(claimError, "Only letters, numbers, spaces and . , % are allowed — no special characters or emojis");
      return;
    }
    if (ONLY_NUMBERS.test(claimText.replace(/\s/g, ""))) {
      showError(claimError, "Claim must not consist of numbers only"); return;
    }
    const claimWords = (claimText.match(/[A-Za-z]+/g) || []);
    if (claimWords.length < 2) {
      showError(claimError, "Claim must represent a factual statement with at least two words"); return;
    }

    /* ── Rules 2-6: Sources ─────────────────────────────────── */
    const blocks = document.querySelectorAll(".source-block");
    if (blocks.length === 0) {
      showError(sourceError, "At least one source reference is required"); return;
    }

    const sourcesData = [];
    const seenURLs = new Set();

    for (const block of blocks) {
      const type  = block.querySelector(".sourceType").value;
      const url   = block.querySelector(".sourceURL").value.trim();
      const file  = block.querySelector(".referenceFile").files[0];
      const urlEr = block.querySelector(".url-error");
      const filEr = block.querySelector(".file-error");

      // Rule 2: type required
      if (!type) {
        showError(sourceError, "Please select a source type for all sources"); return;
      }

      // Rule 7: at least URL or file
      if (!url && !file) {
        showError(sourceError, "Provide a URL or upload a PDF for each source"); return;
      }

      // Rule 4: URL validation
      if (url) {
        const urlErr = validateURLFrontend(url, type);
        if (urlErr) {
          if (urlEr) urlEr.textContent = urlErr;
          showError(sourceError, "Fix the URL errors in your sources before submitting");
          return;
        }

        // Rule 4: duplicate URLs
        const normalised = url.toLowerCase();
        if (seenURLs.has(normalised)) {
          showError(sourceError, "Duplicate URLs are not allowed across sources"); return;
        }
        seenURLs.add(normalised);
      }

      // Rule 5: file type and size (already handled live, re-check here)
      if (file) {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          if (filEr) filEr.textContent = "Only PDF files are allowed for upload";
          showError(sourceError, "Fix the file errors before submitting"); return;
        }
        if (file.size === 0) {
          if (filEr) filEr.textContent = "Uploaded file is empty";
          showError(sourceError, "Fix the file errors before submitting"); return;
        }
        if (file.size > 5 * 1024 * 1024) {
          if (filEr) filEr.textContent = "File must be under 5 MB";
          showError(sourceError, "Fix the file errors before submitting"); return;
        }
      }

      sourcesData.push({ type, url, file });
    }

    /* ── Disable button, show loader ────────────────────────── */
    submitBtn.disabled = true;
    btnText.textContent = "Submitting…";
    if (btnLoader) btnLoader.classList.remove("hidden");

    let claimId = null;
    try {
      /* ── 1. Create claim ─────────────────────────────────── */
      const claimRes = await fetch(`${API_BASE}/api/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify({ claimText })
      });
      const claimData = await claimRes.json();
      if (!claimRes.ok) {
        showError(claimError, claimData.error || "Failed to create claim");
        return;
      }
      claimId = claimData._id;

      /* ── 2. Upload each source ───────────────────────────── */
      const pdfFeedback = []; // collect relevance info from backend

      for (const source of sourcesData) {
        const formData = new FormData();
        formData.append("claimId", claimId);
        formData.append("sourceType", source.type);
        if (source.url)  formData.append("sourceURL", source.url);
        if (source.file) formData.append("referenceFile", source.file);

        const srcRes = await fetch(`${API_BASE}/api/sources`, {
          method: "POST",
          headers: { Authorization: `Bearer ${currentToken}` },
          body: formData
        });
        const srcData = await srcRes.json();

        if (!srcRes.ok) {
          // Surface backend PDF relevance error with score
          let errMsg = srcData.error || "Failed to add source";
          if (srcData.relevanceScore !== undefined) {
            errMsg += ` (Relevance: ${srcData.relevanceScore}%)`;
          }
          showError(sourceError, errMsg);
          return;
        }

        // Collect PDF relevance info for success screen
        if (srcData.pdfRelevanceScore !== undefined) {
          pdfFeedback.push({
            filename: source.file?.name || "document",
            score: srcData.pdfRelevanceScore,
            keywords: srcData.pdfMatchedKeywords || []
          });
        }
      }

      /* ── 3. Brief pause for evaluation to settle ─────────── */
      await new Promise(r => setTimeout(r, 700));

      /* ── 4. Fetch updated claim with final score ─────────── */
      const updatedRes = await fetch(`${API_BASE}/api/claims/${claimId}`);
      const claim = await updatedRes.json();

      const score      = claim.reliabilityScore;
      const confidence = claim.confidenceLevel || "Pending";

      /* ── 5. Build score breakdown rows ──────────────────────*/
      let breakdownRows = "";
      let runningTotal  = 0;
      const uniqueTypes = new Set(sourcesData.map(s => s.type));

      sourcesData.forEach(s => {
        const pts = TYPE_SCORES[s.type] || 0;
        runningTotal += pts;
        breakdownRows += `<tr>
          <td style="padding:8px 16px;">${TYPE_LABELS[s.type]}</td>
          <td style="padding:8px 16px;color:#16a34a;font-weight:600">+${pts}</td>
        </tr>`;
      });
      if (uniqueTypes.size >= 2) {
        breakdownRows += `<tr>
          <td style="padding:8px 16px;">🌐 Source diversity bonus (2+ types)</td>
          <td style="padding:8px 16px;color:#16a34a;font-weight:600">+10</td>
        </tr>`;
        runningTotal += 10;
      }
      if (uniqueTypes.size >= 3) {
        breakdownRows += `<tr>
          <td style="padding:8px 16px;">🌐 Strong diversity bonus (3+ types)</td>
          <td style="padding:8px 16px;color:#16a34a;font-weight:600">+10</td>
        </tr>`;
        runningTotal += 10;
      }
      breakdownRows += `<tr>
        <td style="padding:8px 16px;">⏱️ Freshness bonus (submitted today)</td>
        <td style="padding:8px 16px;color:#16a34a;font-weight:600">+10</td>
      </tr>`;
      runningTotal += 10;

      const displayScore = (score !== null && score !== undefined) ? score : Math.min(runningTotal, 100);
      let scoreColor = "#16a34a";
      if (displayScore < 40) scoreColor = "#dc2626";
      else if (displayScore < 70) scoreColor = "#f59e0b";

      let confidenceColor = "#16a34a";
      if (confidence === "low" || confidence === "very low") confidenceColor = "#dc2626";
      else if (confidence === "moderate") confidenceColor = "#f59e0b";

      /* ── PDF relevance section for success screen ────────── */
      const pdfSection = pdfFeedback.length
        ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 16px;margin-bottom:16px;text-align:left;max-width:420px;margin-left:auto;margin-right:auto;">
            <div style="font-size:13px;font-weight:700;color:#0369a1;margin-bottom:8px;">📄 PDF Relevance Analysis</div>
            ${pdfFeedback.map(p => `
              <div style="margin-bottom:6px;">
                <span style="font-size:12px;color:#475569;">${p.filename}</span>
                <span style="font-size:12px;font-weight:700;color:${p.score >= 40 ? "#16a34a" : "#d97706"};margin-left:8px;">${p.score}% relevant</span>
                ${p.keywords.length ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">Matched: ${p.keywords.slice(0,6).join(", ")}</div>` : ""}
              </div>
            `).join("")}
          </div>`
        : "";

      /* ── 6. Replace form with success screen ─────────────── */
      submitContainer.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:52px;margin-bottom:16px;">✅</div>
          <h2 style="color:#16a34a;margin-bottom:24px;font-size:22px;">Claim Submitted Successfully!</h2>

          <div style="background:#f8fafc;padding:28px;border-radius:16px;max-width:420px;margin:0 auto 20px;border:1px solid #e2e8f0;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
              <div style="text-align:left;">
                <p style="font-size:12px;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Reliability Score</p>
                <p style="font-size:42px;font-weight:800;color:${scoreColor};margin:0;line-height:1;">${displayScore}</p>
                <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">/100</p>
              </div>
              <div style="text-align:right;">
                <p style="font-size:12px;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Confidence</p>
                <p style="font-size:18px;font-weight:700;color:${confidenceColor};margin:0;text-transform:capitalize;">${confidence}</p>
              </div>
            </div>
            <div style="background:#e2e8f0;border-radius:999px;height:8px;margin:16px 0 0;overflow:hidden;">
              <div style="height:100%;width:${displayScore}%;background:${scoreColor};border-radius:999px;transition:width .5s;"></div>
            </div>
          </div>

          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;max-width:420px;margin:0 auto 20px;overflow:hidden;text-align:left;">
            <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
              <span style="font-weight:700;font-size:14px;color:#1e293b;">📊 Score Breakdown</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tbody>
                ${breakdownRows}
                <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
                  <td style="padding:10px 16px;font-weight:700;color:#1e293b;">Total (capped at 100)</td>
                  <td style="padding:10px 16px;font-weight:800;color:${scoreColor};font-size:16px;">${displayScore}</td>
                </tr>
              </tbody>
            </table>
            <div style="padding:10px 16px;font-size:12px;color:#94a3b8;background:#fafafa;border-top:1px solid #f1f5f9;">
              💡 Moderator review may adjust this score. Higher = more reliable.
            </div>
          </div>

          ${pdfSection}

          <p style="font-size:13px;color:#64748b;margin-bottom:20px;">Your claim is now under evaluation. Track it on your profile.</p>

          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <button onclick="window.location.href='index.html'"
              style="background:#2563eb;color:white;border:none;padding:12px 26px;border-radius:30px;font-weight:700;cursor:pointer;font-size:14px;">
              🏠 Go to Home
            </button>
            <button onclick="window.location.href='profile.html'"
              style="background:#f1f5f9;color:#1e293b;border:1px solid #e2e8f0;padding:12px 26px;border-radius:30px;font-weight:700;cursor:pointer;font-size:14px;">
              👤 My Profile
            </button>
          </div>
        </div>
      `;

    } catch (err) {
      console.error("Submit error:", err);
      showError(claimError, "Something went wrong. Please try again.");
      submitBtn.disabled = false;
      btnText.textContent = "Submit Claim";
      if (btnLoader) btnLoader.classList.add("hidden");
    }
  });

}); // end DOMContentLoaded
