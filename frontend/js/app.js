const API_BASE = "http://localhost:3001";

/* ==========================
   AUTH STATE
========================== */
let isSignup = false;

const openBtn = document.getElementById("openAuthModal");
const logoutBtn = document.getElementById("logoutBtn");
const modal = document.getElementById("authModal");
const closeBtn = document.getElementById("closeAuthModal");
const switchText = document.getElementById("switchAuthMode");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authTitle = document.getElementById("authTitle");
const authMessage = document.getElementById("authMessage");

openBtn?.addEventListener("click", () => modal.classList.remove("hidden"));

closeBtn?.addEventListener("click", () => {
  modal.classList.add("hidden");
  authMessage.textContent = "";
});

switchText?.addEventListener("click", () => {
  isSignup = !isSignup;
  authTitle.textContent = isSignup ? "Signup" : "Login";
  authSubmitBtn.textContent = isSignup ? "Signup" : "Login";
  switchText.textContent = isSignup
    ? "Already have an account? Login"
    : "Don't have an account? Signup";
  authMessage.textContent = "";
});

authSubmitBtn?.addEventListener("click", async () => {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value.trim();

  if (!email || !password) {
    authMessage.style.color = "red";
    authMessage.textContent = "All fields required";
    return;
  }

  const endpoint = isSignup ? "signup" : "login";
  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = "Please wait...";
  authMessage.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      authMessage.style.color = "red";
      authMessage.textContent = data.error || "Something went wrong";
      return;
    }

    if (isSignup) {
      authMessage.style.color = "green";
      authMessage.textContent = "Signup successful. Please verify your email.";
      return;
    }

    // Store all user info
    localStorage.setItem("veridex_token", data.token);
    localStorage.setItem("veridex_role", data.role);
    localStorage.setItem("veridex_verified", data.isVerified);
    localStorage.setItem("veridex_email", data.email);
    localStorage.setItem("veridex_displayName", data.displayName || "@" + data.email.split("@")[0]);
    if (data.username) localStorage.setItem("veridex_username", data.username);

    modal.classList.add("hidden");
    updateAuthUI();

  } catch (err) {
    authMessage.style.color = "red";
    authMessage.textContent = "Server error";
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isSignup ? "Signup" : "Login";
  }
});

logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  updateAuthUI();
  window.location.href = "index.html";
});

function updateAuthUI() {
  const token = localStorage.getItem("veridex_token");
  const role = localStorage.getItem("veridex_role");

  const modLink = document.querySelector('a[href="moderator.html"]');
  const profileLink = document.getElementById("profileNavLink");

  if (token) {
    openBtn?.classList.add("hidden");
    logoutBtn?.classList.remove("hidden");
    if (profileLink) profileLink.classList.remove("hidden");
  } else {
    openBtn?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
    if (profileLink) profileLink.classList.add("hidden");
  }

  if (modLink) {
    modLink.style.display = role === "moderator" ? "inline-block" : "none";
  }
}

/* ==========================
   LOAD CLAIMS ON HOMEPAGE
========================== */
document.addEventListener("DOMContentLoaded", async () => {
  const claimsGrid = document.getElementById("claimsGrid");
  if (!claimsGrid) return;

  try {
    const res = await fetch(`${API_BASE}/api/claims`);
    const claims = await res.json();

    claimsGrid.innerHTML = "";

    if (!claims.length) {
      claimsGrid.innerHTML = "<p style='color:#64748b;text-align:center;padding:20px;'>No claims available yet.</p>";
      return;
    }

    claims.forEach(claim => {
      let score = claim.reliabilityScore;
      let statusLabel = "Pending Analysis";
      let statusClass = "status-pending";

      if (score !== null && score !== undefined) {
        if (score >= 70) { statusLabel = "Reliable"; statusClass = "status-high"; }
        else if (score >= 40) { statusLabel = "Moderate Reliability"; statusClass = "status-medium"; }
        else { statusLabel = "Low Reliability"; statusClass = "status-low"; }
      }

      const card = document.createElement("div");
      card.className = `claim-card ${statusClass}`;
      card.innerHTML = `
        <h3>${claim.claimText}</h3>
        <div class="score-section">
          <span class="score-value">${score !== null && score !== undefined ? score : "Pending"}</span>
          <span class="score-label">${statusLabel}</span>
        </div>
      `;
      card.onclick = () => { window.location.href = `claim.html?claimId=${claim._id}`; };
      claimsGrid.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading claims:", err);
  }
});

updateAuthUI();
