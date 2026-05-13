// backend/routes/profileRoutes.js

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { getMyProfile, updateProfile, getPublicProfile } = require("../controllers/profileController");

// Get own profile (requires login)
router.get("/me", authMiddleware, getMyProfile);

// Update own profile (requires login)
router.patch("/me", authMiddleware, updateProfile);

// Get public profile by username
router.get("/:username", getPublicProfile);

module.exports = router;