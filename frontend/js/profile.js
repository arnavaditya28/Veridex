/* =====================================
   PROFILE PAGE JAVASCRIPT
   Handles profile loading, editing, and badge system
===================================== */

const API = "http://localhost:3001/api";
const token = localStorage.getItem("veridex_token");

// Check if viewing own profile or someone else's
const urlParams = new URLSearchParams(window.location.search);
const viewUsername = urlParams.get("u");

// Badge definitions with requirements
const BADGE_DEFINITIONS = {
  factChecker: {
    icon: "🧠",
    name: "Fact Checker",
    description: "10+ verified fact-checks with 80%+ accuracy",
    check: (user) => user.factCheckCount >= 10 && user.factCheckAccuracy >= 80
  },
  topContributor: {
    icon: "🔥",
    name: "Top Contributor",
    description: "Top 10% of monthly contributors",
    check: (user) => user.isTopContributor || (user.postCount + user.commentCount) >= 50
  },
  trustedUser: {
    icon: "🛡",
    name: "Trusted User",
    description: "90+ days active with Trust Score > 75",
    check: (user) => user.accountAgeDays >= 90 && user.trustScore >= 75
  },
  risingStar: {
    icon: "⭐",
    name: "Rising Star",
    description: "Quality contributions in first 30 days",
    check: (user) => user.accountAgeDays <= 30 && user.trustScore >= 60
  },
  expertVerified: {
    icon: "💎",
    name: "Expert Verified",
    description: "Consistently validated by moderators",
    check: (user) => user.isExpertVerified || user.trustScore >= 90
  },
  earlyAdopter: {
    icon: "🚀",
    name: "Early Adopter",
    description: "Joined in the first month",
    check: (user) => user.accountAgeDays >= 365
  },
  discussionStarter: {
    icon: "💬",
    name: "Discussion Starter",
    description: "Started 5+ discussions",
    check: (user) => user.discussionCount >= 5
  },
  peacemaker: {
    icon: "🕊️",
    name: "Peacemaker",
    description: "Helps resolve conflicts constructively",
    check: (user) => user.upvotes >= 100 && user.reportsReceived <= 2
  }
};

// Reliability tag calculation
function getReliabilityTag(trustScore) {
  if (trustScore >= 85) return { text: "Highly Reliable", class: "highly-reliable" };
  if (trustScore >= 65) return { text: "Reliable", class: "reliable" };
  if (trustScore >= 40) return { text: "Needs Review", class: "needs-review" };
  return { text: "Low Reliability", class: "low-reliability" };
}

// Update trust score circle visual
function updateTrustScoreCircle(score) {
  const circle = document.getElementById("trustScoreCircle");
  const percentage = (score / 100) * 360;
  circle.style.background = `conic-gradient(#2563eb ${percentage}deg, #e2e8f0 ${percentage}deg)`;
}

// Render badges grid
function renderBadges(user) {
  const badgesGrid = document.getElementById("badgesGrid");
  badgesGrid.innerHTML = "";

  Object.entries(BADGE_DEFINITIONS).forEach(([key, badge]) => {
    const earned = badge.check(user);
    const badgeEl = document.createElement("div");
    badgeEl.className = `badge-item ${earned ? "earned" : "locked"}`;
    badgeEl.innerHTML = `
      <span class="badge-icon">${badge.icon}</span>
      <span>${badge.name}</span>
    `;
    badgeEl.title = badge.description;
    badgesGrid.appendChild(badgeEl);
  });
}

// Format date
function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// Calculate account age in days
function calculateAccountAgeDays(joinedAt) {
  if (!joinedAt) return 0;
  const joined = new Date(joinedAt);
  const now = new Date();
  const diffTime = Math.abs(now - joined);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate engagement rate
function calculateEngagementRate(user) {
  const totalActions = (user.postCount || 0) + (user.commentCount || 0) + (user.upvotes || 0);
  const accountAgeDays = calculateAccountAgeDays(user.joinedAt);
  if (accountAgeDays === 0) return 0;
  return Math.min(100, Math.round((totalActions / accountAgeDays) * 100));
}

// Main profile loading function
async function loadProfile() {
  try {
    let data;

    if (viewUsername) {
      // Public profile view
      const res = await fetch(`${API}/profile/${viewUsername}`);
      if (!res.ok) {
        document.getElementById("profileDisplayName").textContent = "User not found";
        document.getElementById("editSection").style.display = "none";
        return;
      }
      data = await res.json();
      document.getElementById("editSection").style.display = "none";
    } else {
      // Own profile view
      if (!token) {
        document.getElementById("profileDisplayName").textContent = "Please login to view your profile";
        document.getElementById("editSection").style.display = "none";
        // Show login prompt
        const profileBio = document.getElementById("profileBio");
        if (profileBio) {
          profileBio.innerHTML = '<a href="index.html" style="color: #2563eb;">Click here to login</a>';
        }
        return;
      }
      const res = await fetch(`${API}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      data = await res.json();
      document.getElementById("editSection").style.display = "block";

      // Pre-fill edit form
      document.getElementById("inputDisplayName").value = data.displayName || "";
      document.getElementById("inputUsername").value = data.username || "";
      document.getElementById("inputBio").value = data.bio || "";
    }

    // Populate profile data
    populateProfileData(data);

  } catch (err) {
    console.error("Profile load error:", err);
    document.getElementById("profileDisplayName").textContent = "Error loading profile";
  }
}

// Populate all profile data
function populateProfileData(data) {
  // Basic info
  const displayName = data.displayName || data.username || "?";
  document.getElementById("profileAvatar").textContent = displayName.replace("@", "")[0].toUpperCase();
  document.getElementById("profileDisplayName").textContent = displayName;
  document.getElementById("profileUsernameTag").textContent = data.username ? `@${data.username}` : "";

  // Verification badge
  if (data.isVerified) {
    document.getElementById("verificationBadge").style.display = "inline-block";
  }

  // Bio
  document.getElementById("profileBio").textContent = data.bio || (viewUsername ? "" : "No bio yet — add one below!");

  // Joined date
  const joinedDate = new Date(data.joinedAt);
  document.getElementById("profileJoined").textContent = `Joined ${joinedDate.toLocaleDateString("en-US", { year: "numeric", month: "long" })}`;

  // Trust Score
  const trustScore = data.trustScore || 0;
  document.getElementById("trustScoreValue").textContent = trustScore;
  updateTrustScoreCircle(trustScore);

  // Fact-check accuracy
  document.getElementById("factCheckAccuracy").textContent = `${data.factCheckAccuracy || 0}%`;

  // Reports
  document.getElementById("reportsReceived").textContent = data.reportsReceived || 0;
  document.getElementById("reportsResolved").textContent = data.reportsResolved || 0;

  // Reliability tag
  const reliabilityTag = getReliabilityTag(trustScore);
  const tagEl = document.getElementById("reliabilityTag");
  tagEl.textContent = reliabilityTag.text;
  tagEl.className = `reliability-tag ${reliabilityTag.class}`;

  // Activity stats
  document.getElementById("statPosts").textContent = data.postCount || 0;
  document.getElementById("statComments").textContent = data.commentCount || 0;
  document.getElementById("statDiscussions").textContent = data.discussionCount || 0;
  document.getElementById("statUpvotes").textContent = data.upvotes || 0;
  document.getElementById("statDownvotes").textContent = data.downvotes || 0;

  const engagementRate = calculateEngagementRate(data);
  document.getElementById("statEngagement").textContent = `${engagementRate}%`;

  // Reputation
  document.getElementById("karmaPoints").textContent = data.karma || data.reputationPoints || 0;

  // Account info
  document.getElementById("accountEmail").textContent = data.email || "—";
  document.getElementById("accountRole").textContent = (data.role || "user").charAt(0).toUpperCase() + (data.role || "user").slice(1);
  document.getElementById("accountJoinDate").textContent = formatDate(data.joinedAt);
  document.getElementById("accountLastActive").textContent = formatDate(data.lastActive) || "—";

  const status = data.accountStatus || "Active";
  const statusEl = document.getElementById("accountStatus");
  statusEl.textContent = status;
  if (status === "Restricted" || status === "Suspended") {
    statusEl.style.color = "#dc2626";
  } else {
    statusEl.style.color = "#16a34a";
  }

  // Render badges
  // Add calculated fields for badge checking
  const enrichedData = {
    ...data,
    accountAgeDays: calculateAccountAgeDays(data.joinedAt),
    factCheckCount: data.factCheckCount || 0,
    factCheckAccuracy: data.factCheckAccuracy || 0,
    isTopContributor: data.isTopContributor || false,
    isExpertVerified: data.isExpertVerified || false
  };
  renderBadges(enrichedData);
}

// Save profile changes
async function saveProfile() {
  const displayName = document.getElementById("inputDisplayName").value.trim();
  const username = document.getElementById("inputUsername").value.trim();
  const bio = document.getElementById("inputBio").value.trim();
  const msg = document.getElementById("profileMsg");

  if (!username && !displayName) {
    msg.style.color = "#dc2626";
    msg.textContent = "Please provide at least a display name or username.";
    return;
  }

  try {
    const res = await fetch(`${API}/profile/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ displayName, username, bio })
    });

    const data = await res.json();

    if (!res.ok) {
      msg.style.color = "#dc2626";
      msg.textContent = data.error || "Failed to update profile";
      return;
    }

    msg.style.color = "#16a34a";
    msg.textContent = "Profile updated successfully!";

    // Update localStorage
    if (data.displayName) localStorage.setItem("veridex_displayName", data.displayName);
    if (data.username) localStorage.setItem("veridex_username", data.username);

    // Update display
    document.getElementById("profileDisplayName").textContent = data.displayName || displayName;
    document.getElementById("profileAvatar").textContent = (data.displayName || displayName).replace("@", "")[0].toUpperCase();
    document.getElementById("profileUsernameTag").textContent = data.username ? `@${data.username}` : "";
    document.getElementById("profileBio").textContent = data.bio || bio || "No bio yet.";

    setTimeout(() => { msg.textContent = ""; }, 3000);

  } catch (err) {
    console.error("Save profile error:", err);
    msg.style.color = "#dc2626";
    msg.textContent = "An error occurred. Please try again.";
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", loadProfile);