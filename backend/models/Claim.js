const mongoose = require("mongoose");

const ClaimSchema = new mongoose.Schema(
  {
    claimText: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 300          
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    reliabilityScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100
    },
    confidenceLevel: {
      type: String,
      enum: ["very low", "low", "moderate", "high", "very high", null],
      default: null
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "verified", "flagged", "rejected"],
      default: "pending"
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

ClaimSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Claim", ClaimSchema);
