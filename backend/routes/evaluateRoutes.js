const express = require("express");
const Claim = require("../models/Claim");
const Source = require("../models/Source");
const evaluateClaim = require("../rules/evaluate");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/:claimId", authMiddleware, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.claimId);
    if (!claim || claim.isDeleted) {
      return res.status(404).json({ error: "Claim not found" });
    }

    const sources = await Source.find({ claimId: claim._id });
    const result = evaluateClaim(sources, claim.createdAt);

    claim.reliabilityScore = result.totalScore;
    claim.confidenceLevel = result.confidenceLevel;
    await claim.save();

    // Return full breakdown to all authenticated users
    return res.json({
      claimId: claim._id,
      totalScore: result.totalScore,
      confidenceLevel: result.confidenceLevel,
      freshnessScore: result.freshnessScore,
      ruleBreakdown: result.ruleBreakdown
    });

  } catch (err) {
    console.error("EVALUATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
