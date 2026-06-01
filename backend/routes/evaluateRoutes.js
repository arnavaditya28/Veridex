const express = require("express");
const Claim = require("../models/Claim");
const Source = require("../models/Source");
const evaluateClaim = require("../rules/evaluate");
const { analyzeSourcesStance } = require("../utils/aiStance");
const recordVerification = require("../utils/recordVerification");
const Verification = require("../models/Verification");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/:claimId", authMiddleware, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.claimId);
    if (!claim || claim.isDeleted) {
      return res.status(404).json({ error: "Claim not found" });
    }

    const sources = await Source.find({ claimId: claim._id });
    const stance = await analyzeSourcesStance(claim.claimText, sources);
    const result = evaluateClaim(sources, claim.createdAt, stance.results);

    // Persist per-source AI verdicts so they can be displayed later
    if (stance.enabled && stance.results.length) {
      try {
        await Promise.all(stance.results.map(r =>
          Source.findByIdAndUpdate(r.sourceId, {
            aiStance: r.stance || "",
            aiReason: r.reason || ""
          })
        ));
      } catch (e) {
        console.error("Failed to persist AI verdicts:", e.message);
      }
    }

    claim.reliabilityScore = result.totalScore;
    claim.confidenceLevel = result.confidenceLevel;
    await claim.save();
    await recordVerification(
      claim._id,
      result.totalScore,
      result.confidenceLevel,
      stance.enabled ? "AI evaluation" : "Re-evaluated"
    );

    // Return full breakdown to all authenticated users
    return res.json({
      claimId: claim._id,
      totalScore: result.totalScore,
      confidenceLevel: result.confidenceLevel,
      freshnessScore: result.freshnessScore,
      aiAdjustment: result.aiAdjustment,
      aiEnabled: stance.enabled,
      aiAnalysis: stance.results,
      ruleBreakdown: result.ruleBreakdown
    });

  } catch (err) {
    console.error("EVALUATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   GET /:claimId/history — reliability snapshots over time
======================= */
router.get("/:claimId/history", async (req, res) => {
  try {
    const history = await Verification.find({ claimId: req.params.claimId })
      .sort({ createdAt: 1 })
      .select("reliabilityScore confidenceLevel note createdAt");
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
