/*************************
 * CONSTANTS
 *************************/
const token = localStorage.getItem("veridex_token");
const currentUserEmail = localStorage.getItem("veridex_email");
const currentUsername = localStorage.getItem("veridex_username");
const currentRole = localStorage.getItem("veridex_role");
const composer = document.getElementById("discussionComposer");
const loginBlock = document.getElementById("discussionLoginBlock");

const API = (typeof API_BASE !== "undefined" ? API_BASE : "http://localhost:3001");

let posts = [];
let currentPostType = "text";
let currentSort = "new";
let activeTagFilter = null;
let searchDebounceTimer = null;

const TAG_META = {
  "Source":      { icon: "📄", color: "#0ea5e9" },
  "Opinion":     { icon: "🧠", color: "#8b5cf6" },
  "Correction":  { icon: "❗", color: "#f97316" },
  "Speculation": { icon: "⚠️", color: "#eab308" }
};

/*************************
 * HELPERS
 *************************/
function show(id) { const el = document.getElementById(id); if (el) el.classList.remove("disc-hidden"); }
function hide(id) { const el = document.getElementById(id); if (el) el.classList.add("disc-hidden"); }

function updateDiscussionVisibility() {
  const t = localStorage.getItem("veridex_token");
  if (t) { composer.classList.remove("disc-hidden"); loginBlock.classList.add("disc-hidden"); }
  else   { composer.classList.add("disc-hidden");    loginBlock.classList.remove("disc-hidden"); }
}
updateDiscussionVisibility();

function relativeTime(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 5)    return "just now";
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getDisplayName(author) {
  if (!author) return `<span class="user-tag">@unknown</span>`;
  if (author.username) return `<a class="user-tag" href="profile.html?u=${author.username}">@${author.username}</a>`;
  if (author.email) return `<span class="user-tag">@${author.email.split("@")[0]}</span>`;
  return `<span class="user-tag">@user</span>`;
}

function isOwnPost(author) {
  if (!author) return false;
  if (author.email && author.email === currentUserEmail) return true;
  if (author.username && author.username === currentUsername) return true;
  return false;
}

function isModerator() { return currentRole === "moderator"; }

/*************************
 * IMAGE HANDLERS
 *************************/
const imgInput = document.getElementById("postImageInput");
if (imgInput) {
  imgInput.addEventListener("change", () => handleImageSelect(imgInput));
}

function handleImageSelect(input) {
  const preview = document.getElementById("imagePreviewBox");
  preview.innerHTML = "";
  if (!input.files.length) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const wrap = document.createElement("div");
    wrap.className = "img-preview-item";
    wrap.innerHTML = `<img src="${e.target.result}" /><span class="img-remove" onclick="removeImage()">✕</span>`;
    preview.appendChild(wrap);
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  const input = document.getElementById("postImageInput");
  input.value = "";
  document.getElementById("imagePreviewBox").innerHTML = "";
}

/*************************
 * LOAD POSTS
 *************************/
async function loadPosts() {
  try {
    const res = await fetch(`${API}/discussions`);
    if (!res.ok) throw new Error("Failed to fetch");
    posts = await res.json();
    render();
    updateAISummary();
  } catch (err) {
    console.error("Failed to load posts:", err);
  }
}

/*************************
 * POST TYPE SWITCH
 *************************/
function setPostType(type, btn) {
  currentPostType = type;
  document.querySelectorAll(".post-type-tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  hide("postText"); hide("postLink"); hide("imageUploadArea"); hide("pollBox"); hide("tagRow");
  if (type === "text")  { show("postText");  show("tagRow"); }
  if (type === "link")  { show("postLink");  show("tagRow"); }
  if (type === "image") { show("imageUploadArea"); }
  if (type === "poll")  { show("pollBox"); }
}

function addPollOption() {
  const container = document.getElementById("pollOptions");
  const count = container.querySelectorAll(".poll-option-row").length;
  const row = document.createElement("div");
  row.className = "poll-option-row";
  row.innerHTML = `<input class="poll-option-input" placeholder="Option ${count + 1}" /><button class="poll-remove-btn" onclick="removePollOption(this)">✕</button>`;
  container.appendChild(row);
}

function removePollOption(btn) {
  const rows = document.getElementById("pollOptions").querySelectorAll(".poll-option-row");
  if (rows.length > 2) btn.closest(".poll-option-row").remove();
}

/*************************
 * CREATE POST
 *************************/
async function createPost() {
  const t = localStorage.getItem("veridex_token");
  if (!t) return updateDiscussionVisibility();

  const tag = document.getElementById("replyTag")?.value || null;
  let post = { id: Date.now().toString(), claimId: "global", type: currentPostType, votes: { up: [], down: [] }, replies: [], tag: tag || null };

  if (currentPostType === "text") {
    const val = document.getElementById("postText").value.trim();
    if (!val) return alert("Write something");
    post.content = val;
  }
  if (currentPostType === "link") {
    const val = document.getElementById("postLink").value.trim();
    if (!val) return alert("Paste a link");
    if (!val.startsWith("http://") && !val.startsWith("https://")) return alert("URL must start with http:// or https://");
    post.link = val;
  }
  if (currentPostType === "poll") {
    const question = document.getElementById("pollQuestion").value.trim();
    const options = [...document.querySelectorAll(".poll-option-input")].map(o => o.value.trim()).filter(Boolean);
    if (!question || options.length < 2) return alert("Poll needs a question and at least 2 options");
    post.poll = { question, options: options.map(o => ({ text: o, votes: [] })) };
  }
  if (currentPostType === "image") {
    const files = document.getElementById("postImageInput").files;
    if (!files.length) return alert("Select an image");
    try { post.image = [await compressImage(files[0])]; }
    catch (e) { return alert("Failed to process image. Please try a different file."); }
  }

  const postBtn = document.getElementById("postBtn");
  postBtn.disabled = true; postBtn.textContent = "Posting...";

  try {
    const res = await fetch(`${API}/discussions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
      body: JSON.stringify(post)
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || "Failed to post"); return; }

    document.getElementById("postText").value = "";
    document.getElementById("postLink").value = "";
    document.getElementById("pollQuestion").value = "";
    document.querySelectorAll(".poll-option-input").forEach(i => i.value = "");
    document.getElementById("postImageInput").value = "";
    document.getElementById("imagePreviewBox").innerHTML = "";
    if (document.getElementById("replyTag")) document.getElementById("replyTag").value = "";
    await loadPosts();
  } catch (err) {
    console.error("Post error:", err);
    alert("Something went wrong. Please try again.");
  } finally {
    postBtn.disabled = false; postBtn.textContent = "Post";
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target.result;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const MAX = 800;
          const scale = Math.min(MAX / img.width, MAX / img.height, 1);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        } catch (err) { reject(err); }
      };
    };
    reader.readAsDataURL(file);
  });
}

/*************************
 * EDIT POST
 * — Only author, only text posts
 * — Inline edit: replaces post content with a textarea in-place
 * — Saves via PATCH to backend → updates MongoDB directly
 *************************/
function editPost(postId) {
  // Find the post content paragraph inside the card
  const card = document.getElementById(postId);
  if (!card) return;

  const contentEl = card.querySelector(".post-content");
  if (!contentEl) return;

  const currentText = contentEl.textContent;

  // Replace the content paragraph with an inline edit box
  contentEl.outerHTML = `
    <div class="edit-box" id="edit-box-${postId}">
      <textarea class="edit-textarea" id="edit-textarea-${postId}">${currentText}</textarea>
      <div class="edit-actions">
        <button class="edit-save-btn" onclick="saveEdit('${postId}')">💾 Save</button>
        <button class="edit-cancel-btn" onclick="cancelEdit('${postId}', \`${currentText.replace(/`/g, '\\`')}\`)">✕ Cancel</button>
      </div>
    </div>
  `;

  // Focus the textarea
  const ta = document.getElementById(`edit-textarea-${postId}`);
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

function cancelEdit(postId, originalText) {
  // Restore original content without any network call
  const editBox = document.getElementById(`edit-box-${postId}`);
  if (!editBox) return;
  editBox.outerHTML = `<p class="post-content">${originalText}</p>`;
}

async function saveEdit(postId) {
  const ta = document.getElementById(`edit-textarea-${postId}`);
  if (!ta) return;

  const newContent = ta.value.trim();
  if (!newContent) return alert("Content cannot be empty");

  const t = localStorage.getItem("veridex_token");
  if (!t) return;

  const saveBtn = document.querySelector(`#edit-box-${postId} .edit-save-btn`);
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving..."; }

  try {
    // PATCH request — sends only the content field to update in MongoDB
    const res = await fetch(`${API}/discussions/${postId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${t}`
      },
      body: JSON.stringify({ content: newContent })
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to update post");
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Save"; }
      return;
    }

    // Update the in-memory posts array to reflect the edit immediately
    const p = posts.find(x => x.id === postId);
    if (p) p.content = newContent;

    // Replace edit box with updated content — no full page reload needed
    const editBox = document.getElementById(`edit-box-${postId}`);
    if (editBox) {
      editBox.outerHTML = `<p class="post-content">${newContent}</p>`;
    }

    // Add a subtle "edited" marker next to the post time
    const card = document.getElementById(postId);
    if (card) {
      const timeEl = card.querySelector(".post-time");
      if (timeEl && !timeEl.textContent.includes("edited")) {
        timeEl.textContent += " · edited";
      }
    }

  } catch (err) {
    console.error("Edit error:", err);
    alert("Something went wrong while saving.");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Save"; }
  }
}

/*************************
 * DELETE POST
 * — PERMANENT deletion: removes document from MongoDB (deleteOne)
 * — No soft delete, no isDeleted flag — gone from DB and UI
 * — Owner or moderator only (enforced on both frontend + backend)
 *************************/
async function deletePost(postId) {
  const t = localStorage.getItem("veridex_token");
  if (!t) return;
  if (!confirm("Permanently delete this post? This cannot be undone.")) return;

  try {
    const res = await fetch(`${API}/discussions/${postId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${t}` }
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to delete");
      return;
    }

    // Remove from in-memory array immediately
    posts = posts.filter(p => p.id !== postId);

    // Remove the card from the DOM without a full reload
    const card = document.getElementById(postId);
    if (card) card.remove();

    // Re-render the AI summary to reflect the change
    updateAISummary();

    // If no posts left, show empty state
    const feed = document.getElementById("feed");
    if (feed && !feed.querySelector(".card")) {
      feed.innerHTML = `<div class="empty-feed">No posts yet — be the first!</div>`;
    }

  } catch (err) {
    console.error("Delete error:", err);
    alert("Something went wrong.");
  }
}

/*************************
 * DELETE REPLY
 *************************/
async function deleteReply(postId, replyId) {
  const t = localStorage.getItem("veridex_token");
  if (!t) return;
  if (!confirm("Delete this reply?")) return;
  try {
    const res = await fetch(`${API}/discussions/${postId}/reply/${replyId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${t}` }
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || "Failed to delete reply"); return; }
    await loadPosts();
  } catch (err) {
    console.error("Delete reply error:", err);
    alert("Something went wrong.");
  }
}

/*************************
 * VOTING
 *************************/
async function vote(postId, type) {
  const t = localStorage.getItem("veridex_token");
  if (!t) return updateDiscussionVisibility();
  await fetch(`${API}/discussions/${postId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
    body: JSON.stringify({ type })
  });
  await loadPosts();
}

async function votePoll(postId, optionIndex) {
  const t = localStorage.getItem("veridex_token");
  if (!t) return updateDiscussionVisibility();
  await fetch(`${API}/discussions/${postId}/poll`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
    body: JSON.stringify({ optionIndex })
  });
  await loadPosts();
}

/*************************
 * REPLIES
 *************************/
function toggleReplyBox(id) {
  const b = document.getElementById(`reply-${id}`);
  if (b) b.classList.toggle("disc-hidden");
}

function toggleReplies(id) {
  const g = document.getElementById(`group-${id}`);
  if (g) g.classList.toggle("disc-hidden");
}

function countReplies(list, depth = 0) {
  if (!list || !list.length || depth > 20) return 0;
  return list.reduce((s, x) => s + 1 + countReplies(x.replies || [], depth + 1), 0);
}

async function submitReply(parentId, postId) {
  const t = localStorage.getItem("veridex_token");
  if (!t) return updateDiscussionVisibility();
  const box = document.getElementById(`reply-text-${parentId}`);
  if (!box || !box.value.trim()) return;
  const reply = {
    id: Date.now().toString(),
    parentId,
    content: box.value.trim(),
    votes: { up: [], down: [] },
    replies: []
  };
  try {
    const res = await fetch(`${API}/discussions/${postId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
      body: JSON.stringify(reply)
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || "Failed to post reply"); return; }
    box.value = "";
    await loadPosts();
  } catch (err) {
    console.error("Reply error:", err);
    alert("Something went wrong.");
  }
}

/*************************
 * RENDER REPLIES
 *************************/
function renderReplies(list, parentId, postId, depth = 0) {
  if (!list || !list.length || depth > 20) return "";
  const total = countReplies(list);
  const loggedIn = !!localStorage.getItem("veridex_token");
  return `
    <div class="reply-toggle" onclick="toggleReplies('${parentId}')">💬 ${total} ${total === 1 ? "reply" : "replies"}</div>
    <div class="reply-group disc-hidden" id="group-${parentId}">
      ${list.map(r => {
        const canDel = isOwnPost(r.author) || isModerator();
        return `<div class="reply-item" style="margin-left:${Math.min(depth * 20, 60)}px">
          <div class="reply-card">
            <div class="post-header">
              ${getDisplayName(r.author)}
              <span class="post-time">• ${relativeTime(r.createdAt)}</span>
              ${canDel ? `<span class="delete-btn" onclick="deleteReply('${postId}','${r.id}')">🗑</span>` : ""}
            </div>
            <p class="reply-content">${r.content}</p>
            <div class="actions">
              <span onclick="vote('${r.id}','up')">👍 ${r.votes?.up?.length || 0}</span>
              <span onclick="vote('${r.id}','down')">👎 ${r.votes?.down?.length || 0}</span>
              ${loggedIn ? `<span onclick="toggleReplyBox('${r.id}')">↩ Reply</span>` : ""}
            </div>
            <div id="reply-${r.id}" class="disc-hidden reply-input-box">
              <textarea id="reply-text-${r.id}" placeholder="Write a reply..."></textarea>
              <button class="reply-post-btn" onclick="submitReply('${r.id}','${postId}')">Post</button>
            </div>
            ${renderReplies(r.replies || [], r.id, postId, depth + 1)}
          </div>
        </div>`;
      }).join("")}
    </div>`;
}

/*************************
 * RENDER POST CONTENT
 *************************/
function renderPost(p) {
  let tagHtml = "";
  if (p.tag && TAG_META[p.tag]) {
    const m = TAG_META[p.tag];
    tagHtml = `<span class="post-tag" style="background:${m.color}22;color:${m.color};border-color:${m.color}55">${m.icon} ${p.tag}</span>`;
  }

  if (p.type === "text") return tagHtml + `<p class="post-content">${p.content}</p>`;

  if (p.type === "link") return tagHtml + `
    <a href="${p.link}" target="_blank" class="link-preview">
      <span class="link-icon">🔗</span>
      <span class="link-url">${p.link}</span>
      <span class="link-arrow">↗</span>
    </a>`;

  if (p.type === "image") {
    const imgs = Array.isArray(p.image) ? p.image : [p.image];
    return `<div class="image-grid single">${imgs.slice(0, 1).map(img =>
      `<img src="${img}" class="post-image-thumb" onclick="openImage('${img}')">`
    ).join("")}</div>`;
  }

  if (p.type === "poll") {
    const totalVotes = p.poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
    return `
      <div class="poll-container">
        <p class="poll-question">📊 ${p.poll.question}</p>
        <div class="poll-options-display">
          ${p.poll.options.map((o, i) => {
            const count = o.votes?.length || 0;
            const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            return `<div class="poll-vote-btn" onclick="votePoll('${p.id}', ${i})">
              <div class="poll-vote-fill" style="width:${pct}%"></div>
              <span class="poll-vote-label">${o.text}</span>
              <span class="poll-vote-stat">${pct}% · ${count}</span>
            </div>`;
          }).join("")}
        </div>
        <div class="poll-total">${totalVotes} total vote${totalVotes !== 1 ? "s" : ""}</div>
      </div>`;
  }
  return "";
}

/*************************
 * TAG FILTER
 *************************/
function setTagFilter(tag) {
  activeTagFilter = activeTagFilter === tag ? null : tag;
  document.querySelectorAll(".tag-filter-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tag === activeTagFilter)
  );
  render();
}

/*************************
 * RENDER FEED
 *************************/
function render() {
  const feed = document.getElementById("feed");
  if (!feed) return;
  let list = [...posts];
  if (activeTagFilter) list = list.filter(p => p.tag === activeTagFilter);
  const s = document.getElementById("searchBox")?.value?.toLowerCase() || "";
  if (s) list = list.filter(p =>
    p.content?.toLowerCase().includes(s) ||
    p.link?.toLowerCase().includes(s) ||
    p.poll?.question?.toLowerCase().includes(s)
  );
  if (currentSort === "top") list.sort((a, b) =>
    (b.votes.up.length - b.votes.down.length) - (a.votes.up.length - a.votes.down.length)
  );
  if (currentSort === "new") list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (currentSort === "discussed") list.sort((a, b) =>
    countReplies(b.replies || []) - countReplies(a.replies || [])
  );

  if (!list.length) {
    feed.innerHTML = `<div class="empty-feed">${activeTagFilter
      ? `No posts tagged <strong>${activeTagFilter}</strong>`
      : "No posts yet — be the first!"}</div>`;
    return;
  }

  const loggedIn = !!localStorage.getItem("veridex_token");
  feed.innerHTML = list.map(p => {
    // isOwnPost determines if Edit/Delete buttons are shown
    const isOwn = isOwnPost(p.author);
    const canDelete = isOwn || isModerator();
    // Edit is only shown to the author of text posts (only text content can be edited)
    const canEdit = isOwn && p.type === "text";

    return `<div class="card post-card" id="${p.id}">
      <div class="post-header">
        ${getDisplayName(p.author)}
        <span class="post-time">• ${relativeTime(p.createdAt)}</span>
        <div class="post-actions-right">
          ${canEdit   ? `<span class="edit-btn"   onclick="editPost('${p.id}')"   title="Edit post">✏️</span>` : ""}
          ${canDelete ? `<span class="delete-btn" onclick="deletePost('${p.id}')" title="Delete post">🗑</span>` : ""}
        </div>
      </div>
      ${renderPost(p)}
      <div class="actions">
        <span onclick="vote('${p.id}','up')">👍 ${p.votes.up.length}</span>
        <span onclick="vote('${p.id}','down')">👎 ${p.votes.down.length}</span>
        ${loggedIn ? `<span onclick="toggleReplyBox('${p.id}')">↩ Reply</span>` : ""}
        <span onclick="copyLink('${p.id}')">🔗 Share</span>
      </div>
      <div id="reply-${p.id}" class="disc-hidden reply-input-box">
        <textarea id="reply-text-${p.id}" placeholder="Write a reply..."></textarea>
        <button class="reply-post-btn" onclick="submitReply('${p.id}','${p.id}')">Post</button>
      </div>
      ${renderReplies(p.replies || [], p.id, p.id)}
    </div>`;
  }).join("");
}

/*************************
 * SORT
 *************************/
function setSort(type, el) {
  currentSort = type;
  document.querySelectorAll(".sort-bar span").forEach(s => s.classList.remove("active"));
  if (el) el.classList.add("active");
  render();
}

/*************************
 * AI SUMMARY
 *************************/
function updateAISummary() {
  const container = document.getElementById("aiSummaryContent");
  if (!container) return;
  if (!posts.length) {
    container.innerHTML = `<p class="ai-empty">No activity yet — start the discussion!</p>`;
    return;
  }
  const totalPosts = posts.length;
  const totalReplies = posts.reduce((s, p) => s + countReplies(p.replies || []), 0);
  const uniqueAuthors = new Set(posts.map(p => p.author?.email || p.author?.username).filter(Boolean)).size;
  const typeCounts = { text: 0, link: 0, image: 0, poll: 0 };
  const tagCounts = {};
  let totalUp = 0, totalDown = 0, topPost = null, topScore = -Infinity, hotPost = null, hotReplies = -1;
  posts.forEach(p => {
    typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
    if (p.tag) tagCounts[p.tag] = (tagCounts[p.tag] || 0) + 1;
    totalUp += p.votes.up.length;
    totalDown += p.votes.down.length;
    const sc = p.votes.up.length - p.votes.down.length;
    if (sc > topScore) { topScore = sc; topPost = p; }
    const rc = countReplies(p.replies || []);
    if (rc > hotReplies) { hotReplies = rc; hotPost = p; }
  });
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
  const dom = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
  const tl = { text: "Text", link: "Links", image: "Images", poll: "Polls" };
  const tv = totalUp + totalDown;
  const ur = tv ? Math.round((totalUp / tv) * 100) : null;
  const sent = ur === null ? "" : ur >= 70 ? "🟢 Positive" : ur >= 40 ? "🟡 Mixed" : "🔴 Critical";
  container.innerHTML = `
    <div class="ai-grid">
      <div class="ai-stat"><span class="ai-num">${totalPosts}</span><span class="ai-lbl">Posts</span></div>
      <div class="ai-stat"><span class="ai-num">${totalReplies}</span><span class="ai-lbl">Replies</span></div>
      <div class="ai-stat"><span class="ai-num">${uniqueAuthors}</span><span class="ai-lbl">Participants</span></div>
      <div class="ai-stat"><span class="ai-num">${totalUp}</span><span class="ai-lbl">Upvotes</span></div>
    </div>
    <div class="ai-insights">
      ${dom[1] > 0 ? `<div class="ai-row">📝 Most common: <strong>${tl[dom[0]]}</strong> (${dom[1]})</div>` : ""}
      ${topTag ? `<div class="ai-row">🏷️ Top tag: <strong style="color:${TAG_META[topTag[0]]?.color}">${TAG_META[topTag[0]]?.icon} ${topTag[0]}</strong> — ${topTag[1]} post${topTag[1] > 1 ? "s" : ""}</div>` : ""}
      ${sent ? `<div class="ai-row">${sent} sentiment — ${ur}% upvote ratio</div>` : ""}
      ${topPost && topScore > 0 ? `<div class="ai-row">🔥 Top post: <em>"${(topPost.content || topPost.poll?.question || "Image/Link").slice(0, 55)}…"</em> (+${topScore})</div>` : ""}
      ${hotPost && hotReplies > 0 ? `<div class="ai-row">💬 Most discussed: <em>"${(hotPost.content || hotPost.poll?.question || "Image/Link").slice(0, 55)}…"</em> (${hotReplies} replies)</div>` : ""}
      ${Object.keys(tagCounts).length > 1 ? `<div class="ai-row">🗂️ Tags: ${Object.entries(tagCounts).map(([t, c]) => `${TAG_META[t]?.icon} ${t} (${c})`).join(" · ")}</div>` : ""}
    </div>`;
}

/*************************
 * MISC
 *************************/
function copyLink(id) {
  const base = window.location.href.split("#")[0];
  const link = `${base}#${id}`;
  navigator.clipboard.writeText(link).catch(() => { prompt("Copy this link:", link); });
  const toast = document.getElementById("toast");
  if (toast) { toast.classList.remove("hidden"); setTimeout(() => toast.classList.add("hidden"), 2000); }
}

function openImage(src) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("fullImage");
  if (modal && img) { img.src = src; modal.classList.remove("hidden"); }
}

function closeImage() {
  const modal = document.getElementById("imageModal");
  if (modal) modal.classList.add("hidden");
}

const searchBox = document.getElementById("searchBox");
if (searchBox) {
  searchBox.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(render, 250);
  });
}

loadPosts();
