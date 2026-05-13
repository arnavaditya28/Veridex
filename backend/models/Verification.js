const mongoose = require("mongoose");

// This model is currently unused. Kept for potential future use.
const VerificationSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Claim",
      required: true,
      index: true
    },
    confidenceLevel: {
      type: String,
      enum: ["very low", "low", "moderate", "high", "very high"],
      required: true
    }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model("Verification", VerificationSchema);
