const express = require("express");
const Claim = require("../models/Claim");
const authMiddleware = require("../middleware/authMiddleware");
const { claimLimitMiddleware } = require("../middleware/rateLimitMiddleware");
const awardBadge = require("../utils/awardBadge");
const { validateClaimText } = require("../utils/validateClaim");

const router = express.Router();

/* =======================
   POST /claims — Create a new claim
======================= */
router.post("/", authMiddleware, claimLimitMiddleware, async (req, res) => {
  try {
    const { claimText } = req.body;

    // ── Backend claim validation (Rules 1) ──────────────────────
    const check = validateClaimText(claimText);
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }

    const claim = new Claim({
      claimText: claimText.trim(),
      createdBy: req.user._id,
      status: "pending"
    });

    await claim.save();

    // Award "First Claim" badge on very first submission
    const claimCount = await Claim.countDocuments({ createdBy: req.user._id });
    if (claimCount === 1) {
      await awardBadge(req.user._id, "firstClaim");
    }

    res.status(201).json(claim);
  } catch (err) {
    console.error("Error creating claim:", err);
    res.status(500).json({ error: "Server error while creating claim" });
  }
});

/* =======================
   GET /claims — All non-deleted, non-rejected claims
======================= */
router.get("/", async (req, res) => {
  try {
    const claims = await Claim.find({
      isDeleted: false,
      status: { $ne: "rejected" }
    }).sort({ createdAt: -1 });

    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: "Server error while fetching claims" });
  }
});

/* =======================
   GET /claims/:id
======================= */
router.get("/:id", async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim || claim.isDeleted) {
      return res.status(404).json({ error: "Claim not found" });
    }
    res.json(claim);
  } catch (err) {
    res.status(500).json({ error: "Server error while fetching claim" });
  }
});

module.exports = router;
