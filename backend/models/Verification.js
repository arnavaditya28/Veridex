const mongoose = require("mongoose");

/**
 * A snapshot of a claim's reliability at a point in time.
 * One record is written each time the claim is (re)evaluated — when a source
 * is added and when a full evaluation runs — so the score can be charted over time.
 */
const VerificationSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Claim",
      required: true,
      index: true
    },
    reliabilityScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    confidenceLevel: {
      type: String,
      enum: ["very low", "low", "moderate", "high", "very high"],
      required: true
    },
    note: {
      type: String,
      default: ""
    }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model("Verification", VerificationSchema);
