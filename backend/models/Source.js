const mongoose = require("mongoose");

const SourceSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Claim",
      required: true
    },
    sourceType: {
      type: String,
      enum: ["official", "media", "document", "user"],
      required: true
    },
    sourceURL: {
      type: String,
      trim: true,
      default: null
    },
    fileName: {
      type: String,
      default: null
    },
    fileType: {
      type: String,
      enum: ["pdf", "image", null],
      default: null
    },
    fileSize: {
      type: Number,
      default: null
    },
    reviewedByMod: {
      type: Boolean,
      default: false
    },
    // Matches what evaluate.js checks: "pending","relevant","irrelevant","outdated"
    reviewStatus: {
      type: String,
      enum: ["pending", "relevant", "irrelevant", "outdated"],
      default: "pending"
    },
    reviewNotes: {
      type: String,
      default: ""
    },
    // Extracted text from uploaded PDFs — used for AI evidence checking
    extractedText: {
      type: String,
      default: ""
    },
    // Latest AI evidence-check verdict for this source
    aiStance: {
      type: String,
      enum: ["", "supports", "contradicts", "unrelated", "unanalyzed"],
      default: ""
    },
    aiReason: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

SourceSchema.index({ claimId: 1, createdAt: -1 });

module.exports = mongoose.model("Source", SourceSchema);
