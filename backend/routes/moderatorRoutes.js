// backend/routes/moderatorRoutes.js

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireModerator = require("../middleware/requireModerator");
const moderatorController = require("../controllers/moderatorController");

/* =========================
   DASHBOARD SUMMARY
========================= */
router.get("/dashboard", authMiddleware, requireModerator, moderatorController.getDashboard);

/* =========================
   CLAIM MANAGEMENT
========================= */
router.get("/claims", authMiddleware, requireModerator, moderatorController.getAllClaims);
router.patch("/claim/:id/accept", authMiddleware, requireModerator, moderatorController.acceptClaim);
router.patch("/claim/:id/flag", authMiddleware, requireModerator, moderatorController.flagClaim);
router.patch("/claim/:id/reject", authMiddleware, requireModerator, moderatorController.rejectClaim);
router.delete("/claim/:id", authMiddleware, requireModerator, moderatorController.removeClaim);

/* =========================
   USER MANAGEMENT
========================= */
router.get("/users", authMiddleware, requireModerator, moderatorController.getAllUsers);
router.patch("/user/:id/suspend", authMiddleware, requireModerator, moderatorController.suspendUser);
router.patch("/user/:id/unsuspend", authMiddleware, requireModerator, moderatorController.unsuspendUser);

module.exports = router;