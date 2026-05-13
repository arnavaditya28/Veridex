const express = require("express");
const router = express.Router();

const Discussion = require("../models/Discussion");
const authMiddleware = require("../middleware/authMiddleware");
const { discussionLimitMiddleware } = require("../middleware/rateLimitMiddleware");
const awardBadge = require("../utils/awardBadge");

/* =======================
   RECURSIVE REPLY HELPERS
======================= */
function addReplyRecursive(replies, parentId, newReply) {
  for (let r of replies) {
    if (r.id === parentId) {
      r.replies = r.replies || [];
      r.replies.push(newReply);
      return true;
    }
    if (r.replies && r.replies.length) {
      if (addReplyRecursive(r.replies, parentId, newReply)) return true;
    }
  }
  return false;
}

function deleteReplyRecursive(replies, replyId, userId, isMod) {
  for (let i = 0; i < replies.length; i++) {
    if (replies[i].id === replyId) {
      const isOwner = replies[i].author && replies[i].author.toString() === userId.toString();
      if (!isOwner && !isMod) return { found: true, allowed: false };
      replies.splice(i, 1);
      return { found: true, allowed: true };
    }
    if (replies[i].replies && replies[i].replies.length) {
      const result = deleteReplyRecursive(replies[i].replies, replyId, userId, isMod);
      if (result.found) return result;
    }
  }
  return { found: false };
}

function populateReplyAuthors(replies, userMap) {
  return replies.map(r => {
    const plain = r.toObject ? r.toObject() : { ...r };
    if (plain.author && userMap[plain.author.toString()]) {
      plain.author = userMap[plain.author.toString()];
    }
    if (plain.replies && plain.replies.length) {
      plain.replies = populateReplyAuthors(plain.replies, userMap);
    }
    return plain;
  });
}

/* =======================
   CREATE POST
======================= */
router.post("/", authMiddleware, discussionLimitMiddleware, async (req, res) => {
  try {
    const { claimId, type, content, link, image, poll, id, tag } = req.body;

    const post = await Discussion.create({
      id,
      claimId: "global",
      author: req.user._id,
      type,
      content,
      link,
      image,
      poll,
      tag: tag || null,
      votes: { up: [], down: [] },
      replies: []
    });

    const postCount = await Discussion.countDocuments({ author: req.user._id, isDeleted: false });
    if (postCount === 1) {
      await awardBadge(req.user._id, "firstPost");
    }

    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* =======================
   GET POSTS
======================= */
router.get("/", async (req, res) => {
  try {
    // Only return posts that are NOT permanently deleted (isDeleted false or not set)
    const posts = await Discussion.find({ claimId: "global", isDeleted: { $ne: true } })
      .populate("author", "username email role")
      .sort({ createdAt: -1 });

    const User = require("../models/User");

    function collectAuthorIds(replies, ids) {
      for (const r of replies) {
        if (r.author) ids.add(r.author.toString());
        if (r.replies && r.replies.length) collectAuthorIds(r.replies, ids);
      }
    }

    const authorIds = new Set();
    posts.forEach(p => { collectAuthorIds(p.replies, authorIds); });

    const users = await User.find({ _id: { $in: [...authorIds] } }).select("username email role");
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = { _id: u._id, username: u.username, email: u.email, role: u.role }; });

    const result = posts.map(p => {
      const plain = p.toObject();
      plain.replies = populateReplyAuthors(plain.replies, userMap);
      return plain;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   VOTE ON POST
======================= */
router.post("/:postId/vote", authMiddleware, async (req, res) => {
  try {
    const { type } = req.body;
    if (!["up", "down"].includes(type)) return res.status(400).json({ error: "Invalid vote type" });

    const post = await Discussion.findOne({ id: req.params.postId, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const userId = req.user._id;
    post.votes.up   = post.votes.up.filter(u => u.toString() !== userId.toString());
    post.votes.down = post.votes.down.filter(u => u.toString() !== userId.toString());
    post.votes[type].push(userId);
    await post.save();

    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   VOTE ON POLL
======================= */
router.post("/:postId/poll", authMiddleware, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const post = await Discussion.findOne({ id: req.params.postId, isDeleted: { $ne: true } });
    if (!post || !post.poll) return res.status(404).json({ error: "Poll not found" });

    const userId = req.user._id;
    post.poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(u => u.toString() !== userId.toString());
    });
    post.poll.options[optionIndex].votes.push(userId);
    await post.save();

    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   EDIT POST (UPDATE)
   — Author only
   — Only updates the content field (text posts)
   — Permanent update in MongoDB
======================= */
router.patch("/:postId", authMiddleware, async (req, res) => {
  try {
    const post = await Discussion.findOne({ id: req.params.postId, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Only the author can edit
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only the author can edit this post" });
    }

    // Only text posts can be edited (content field)
    if (post.type !== "text") {
      return res.status(400).json({ error: "Only text posts can be edited" });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content cannot be empty" });
    }

    // Update ONLY the content field in MongoDB — nothing else changes
    post.content = content.trim();
    await post.save();

    res.json({ message: "Post updated", content: post.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   DELETE TOP-LEVEL POST
   — PERMANENT deletion from MongoDB (deleteOne)
   — No soft delete, no isDeleted flag
   — Owner or moderator only
======================= */
router.delete("/:postId", authMiddleware, async (req, res) => {
  try {
    const post = await Discussion.findOne({ id: req.params.postId });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const isOwner = post.author.toString() === req.user._id.toString();
    const isModerator = req.user.role === "moderator";

    if (!isOwner && !isModerator) {
      return res.status(403).json({ error: "Not allowed to delete this post" });
    }

    // PERMANENTLY remove from MongoDB — no soft delete
    await post.deleteOne();

    res.json({ message: "Post permanently deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   DELETE REPLY
======================= */
router.delete("/:postId/reply/:replyId", authMiddleware, async (req, res) => {
  try {
    const post = await Discussion.findOne({ id: req.params.postId, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const isMod = req.user.role === "moderator";
    const result = deleteReplyRecursive(post.replies, req.params.replyId, req.user._id, isMod);

    if (!result.found) return res.status(404).json({ error: "Reply not found" });
    if (!result.allowed) return res.status(403).json({ error: "Not allowed to delete this reply" });

    post.markModified("replies");
    await post.save();
    res.json({ message: "Reply deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   ADD REPLY
======================= */
router.post("/:postId/reply", authMiddleware, discussionLimitMiddleware, async (req, res) => {
  try {
    const post = await Discussion.findOne({ id: req.params.postId, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const newReply = {
      ...req.body,
      author: req.user._id,
      votes: { up: [], down: [] },
      replies: []
    };

    const added = addReplyRecursive(post.replies, req.body.parentId, newReply);
    if (!added) post.replies.push(newReply);

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
