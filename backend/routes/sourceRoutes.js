const express = require("express");
const path = require("path");
const router = express.Router();

const upload = require("../middleware/upload");
const Source = require("../models/Source");
const Claim = require("../models/Claim");
const evaluateClaim = require("../rules/evaluate");
const authMiddleware = require("../middleware/authMiddleware");
const {
  validateSourceType,
  validateSourceURL,
  validateFile,
  validatePDFContent,
  hasDuplicateURLs,
} = require("../utils/validateClaim");

/* =======================
   POST /sources — Add a source to a claim
   All Rules 2–8 enforced here on the backend
======================= */
router.post("/", authMiddleware, (req, res) => {
  upload.single("referenceFile")(req, res, async function (uploadErr) {
    try {
      // ── Multer / file-type error ─────────────────────────────
      if (uploadErr) {
        return res.status(400).json({ error: "File upload error: " + uploadErr.message });
      }

      const { claimId, sourceType, sourceURL } = req.body;
      const file = req.file || null;

      // ── Rule 2: Source type required ─────────────────────────
      const typeCheck = validateSourceType(sourceType);
      if (!typeCheck.valid) {
        return res.status(400).json({ error: typeCheck.error });
      }

      // ── claimId required ─────────────────────────────────────
      if (!claimId) {
        return res.status(400).json({ error: "claimId is required" });
      }

      // ── Claim must exist ─────────────────────────────────────
      const claim = await Claim.findById(claimId);
      if (!claim || claim.isDeleted) {
        return res.status(404).json({ error: "Claim not found" });
      }

      // ── Rule 7: At least one of URL or file ──────────────────
      const urlTrimmed = sourceURL ? sourceURL.trim() : "";
      if (!urlTrimmed && !file) {
        return res.status(400).json({ error: "Provide a URL or upload a file for this source" });
      }

      // ── Rule 4: URL format + blocked/official domain check ───
      if (urlTrimmed) {
        const urlCheck = validateSourceURL(urlTrimmed, sourceType);
        if (!urlCheck.valid) {
          return res.status(400).json({ error: urlCheck.error });
        }
      }

      // ── Rule 7: Max 5 sources per claim ──────────────────────
      const existingCount = await Source.countDocuments({ claimId });
      if (existingCount >= 5) {
        return res.status(400).json({ error: "Maximum 5 sources allowed per claim" });
      }

      // ── Rule 4: Duplicate URL check (against existing sources) ─
      if (urlTrimmed) {
        const existing = await Source.findOne({
          claimId,
          sourceURL: { $regex: new RegExp(`^${urlTrimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
        });
        if (existing) {
          return res.status(400).json({ error: "This URL has already been added as a source" });
        }
      }

      // ── Rule 5: File type + size ──────────────────────────────
      let pdfRelevanceScore = null;
      let pdfMatchedKeywords = [];

      if (file) {
        const fileCheck = validateFile(file);
        if (!fileCheck.valid) {
          return res.status(400).json({ error: fileCheck.error });
        }

        // ── Rule 6: PDF content + relevance ──────────────────────
        if (file.mimetype === "application/pdf") {
          const filePath = path.join(__dirname, "../uploads", file.filename);
          const pdfCheck = await validatePDFContent(filePath, claim.claimText);

          if (!pdfCheck.valid) {
            // Delete the uploaded file since we're rejecting it
            try {
              const fs = require("fs");
              fs.unlinkSync(filePath);
            } catch (_) {}

            return res.status(400).json({
              error: pdfCheck.error,
              relevanceScore: pdfCheck.relevanceScore ?? null,
              matchedKeywords: pdfCheck.matchedKeywords ?? []
            });
          }

          pdfRelevanceScore = pdfCheck.relevanceScore ?? null;
          pdfMatchedKeywords = pdfCheck.matchedKeywords ?? [];
        }
      }

      // ── Build source record ───────────────────────────────────
      const sourceData = {
        claimId,
        sourceType,
        sourceURL: urlTrimmed || null,
        reviewedByMod: false,
        reviewStatus: "pending"
      };

      if (file) {
        sourceData.fileName = file.filename;
        sourceData.fileType = file.mimetype.includes("pdf") ? "pdf" : "image";
        sourceData.fileSize = file.size;
      }

      const source = await Source.create(sourceData);

      // ── Re-evaluate claim reliability ─────────────────────────
      const allSources = await Source.find({ claimId });
      const result = evaluateClaim(allSources, claim.createdAt);
      claim.reliabilityScore = result.totalScore;
      claim.confidenceLevel = result.confidenceLevel;
      await claim.save();

      // ── Response includes PDF relevance info if available ─────
      res.status(201).json({
        ...source.toObject(),
        ...(pdfRelevanceScore !== null && {
          pdfRelevanceScore,
          pdfMatchedKeywords
        })
      });

    } catch (error) {
      console.error("SOURCE ERROR:", error);
      res.status(500).json({ error: "Server error while adding source" });
    }
  });
});

/* =======================
   GET /sources?claimId=xxx
======================= */
router.get("/", async (req, res) => {
  try {
    const { claimId } = req.query;
    if (!claimId) return res.status(400).json({ error: "claimId is required" });
    const sources = await Source.find({ claimId }).sort({ createdAt: -1 });
    res.json(sources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
