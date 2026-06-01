const Verification = require("../models/Verification");

/**
 * Save a reliability snapshot for a claim. Fail-safe: any error is logged but
 * never interrupts the evaluation flow.
 */
async function recordVerification(claimId, reliabilityScore, confidenceLevel, note = "") {
  try {
    if (reliabilityScore === null || reliabilityScore === undefined || !confidenceLevel) return;
    await Verification.create({ claimId, reliabilityScore, confidenceLevel, note });
  } catch (err) {
    console.error("Verification snapshot failed:", err.message);
  }
}

module.exports = recordVerification;
