const API = "http://localhost:3001/api/moderator";
const token = localStorage.getItem("veridex_token");
const role = localStorage.getItem("veridex_role");

if (!token || role !== "moderator") {
  window.location.href = "index.html";
}

async function loadDashboard() {
  try {
    const res = await fetch(`${API}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { console.error("Dashboard error:", res.status); return; }
    const data = await res.json();

    document.getElementById("totalUsers").textContent = data.totalUsers ?? 0;
    document.getElementById("totalClaims").textContent = data.totalClaims ?? 0;
    document.getElementById("suspendedUsers").textContent = data.suspendedUsers ?? 0;
    document.getElementById("acceptedClaims").textContent = data.acceptedClaims ?? 0;
    document.getElementById("flaggedClaims").textContent = data.flaggedClaims ?? 0;
    document.getElementById("rejectedClaims").textContent = data.rejectedClaims ?? 0;
    document.getElementById("pendingClaims").textContent = data.pendingClaims ?? 0;

    const suspPctEl = document.getElementById("suspendedPercent");
    if (suspPctEl) suspPctEl.textContent = (data.suspendedPercentage ?? 0) + "%";
  } catch (err) {
    console.error("Dashboard fetch failed:", err);
  }
}

async function loadClaims() {
  try {
    const res = await fetch(`${API}/claims`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      document.getElementById("claimsTable").innerHTML = "<p style='color:red'>Failed to load claims.</p>";
      return;
    }
    const claims = await res.json();

    if (!Array.isArray(claims) || claims.length === 0) {
      document.getElementById("claimsTable").innerHTML = "<p style='color:#64748b'>No claims found.</p>";
      return;
    }

    let html = `
      <div class="table-wrapper">
      <table>
        <tr><th>Claim</th><th>User</th><th>Status</th><th>Actions</th></tr>
    `;

    claims.forEach(c => {
      html += `
        <tr class="status-${c.status}">
          <td>${c.claimText}</td>
          <td>${c.createdBy?.email || "Unknown"}</td>
          <td>${c.status}</td>
          <td>
            <button class="action-btn accept" onclick="acceptClaim('${c._id}')">Accept</button>
            <button class="action-btn warn" onclick="flagClaim('${c._id}')">Flag</button>
            <button class="action-btn danger" onclick="rejectClaim('${c._id}')">Reject</button>
          </td>
        </tr>
      `;
    });

    html += "</table></div>";
    document.getElementById("claimsTable").innerHTML = html;
  } catch (err) {
    console.error("Claims fetch failed:", err);
    document.getElementById("claimsTable").innerHTML = "<p style='color:red'>Error loading claims.</p>";
  }
}

async function loadUsers() {
  try {
    const res = await fetch(`${API}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      document.getElementById("usersTable").innerHTML = "<p style='color:red'>Failed to load users.</p>";
      return;
    }
    const users = await res.json();

    if (!Array.isArray(users) || users.length === 0) {
      document.getElementById("usersTable").innerHTML = "<p style='color:#64748b'>No users found.</p>";
      return;
    }

    let html = `
      <div class="table-wrapper">
      <table>
        <tr><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
    `;

    users.forEach(u => {
      const isSuspended = u.accountStatus === "suspended";
      html += `
        <tr>
          <td>${u.email}</td>
          <td>${u.role}</td>
          <td>${isSuspended ? "🔴 Suspended" : "🟢 Active"}</td>
          <td>
            ${isSuspended
              ? `<button class="action-btn accept" onclick="unsuspendUser('${u._id}')">Unsuspend</button>`
              : `<button class="action-btn danger" onclick="suspendUser('${u._id}')">Suspend</button>`
            }
          </td>
        </tr>
      `;
    });

    html += "</table></div>";
    document.getElementById("usersTable").innerHTML = html;
  } catch (err) {
    console.error("Users fetch failed:", err);
    document.getElementById("usersTable").innerHTML = "<p style='color:red'>Error loading users.</p>";
  }
}

async function suspendUser(id) {
  await fetch(`${API}/user/${id}/suspend`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
  loadUsers(); loadDashboard();
}

async function unsuspendUser(id) {
  await fetch(`${API}/user/${id}/unsuspend`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
  loadUsers(); loadDashboard();
}

async function acceptClaim(id) {
  const res = await fetch(`${API}/claim/${id}/accept`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const e = await res.json(); alert(e.error); return; }
  loadClaims(); loadDashboard();
}

async function flagClaim(id) {
  const res = await fetch(`${API}/claim/${id}/flag`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const e = await res.json(); alert(e.error); return; }
  loadClaims(); loadDashboard();
}

async function rejectClaim(id) {
  const res = await fetch(`${API}/claim/${id}/reject`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const e = await res.json(); alert(e.error); return; }
  loadClaims(); loadDashboard();
}

async function deleteClaim(id) {
  if (!confirm("Delete this claim permanently?")) return;
  await fetch(`${API}/claim/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  loadClaims(); loadDashboard();
}

loadDashboard();
loadClaims();
loadUsers();
