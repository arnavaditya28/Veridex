// backend/controllers/moderatorController.js

const Claim = require("../models/Claim");
const User = require("../models/User");

/* ===============================
   DASHBOARD SUMMARY
================================ */
exports.getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClaims = await Claim.countDocuments();
    const suspendedUsers = await User.countDocuments({ accountStatus: "suspended" });
    const acceptedClaims = await Claim.countDocuments({ status: "accepted" });
    const flaggedClaims = await Claim.countDocuments({ status: "flagged" });
    const rejectedClaims = await Claim.countDocuments({ status: "rejected" });
    const pendingClaims = await Claim.countDocuments({ status: "pending" });

    const suspendedPercentage = totalUsers
      ? ((suspendedUsers / totalUsers) * 100).toFixed(1)
      : 0;

    res.json({
      totalUsers,
      totalClaims,
      suspendedUsers,
      suspendedPercentage,
      acceptedClaims,
      flaggedClaims,
      rejectedClaims,
      pendingClaims
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
};

/* ===============================
   GET ALL CLAIMS
================================ */
exports.getAllClaims = async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate("createdBy", "email role")
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (err) {
    console.error("Get claims error:", err);
    res.status(500).json({ error: "Failed to fetch claims" });
  }
};

/* ===============================
   REMOVE CLAIM
================================ */
exports.removeClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    await claim.deleteOne();
    res.json({ message: "Claim removed successfully" });
  } catch (err) {
    console.error("Remove claim error:", err);
    res.status(500).json({ error: "Failed to remove claim" });
  }
};

/* ===============================
   GET ALL USERS
================================ */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

/* ===============================
   SUSPEND USER
================================ */
exports.suspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.accountStatus = "suspended";
    await user.save();
    res.json({ message: "User suspended successfully" });
  } catch (err) {
    console.error("Suspend user error:", err);
    res.status(500).json({ error: "Failed to suspend user" });
  }
};

/* ===============================
   UNSUSPEND USER
================================ */
exports.unsuspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.accountStatus = "active";
    await user.save();
    res.json({ message: "User unsuspended successfully" });
  } catch (err) {
    console.error("Unsuspend user error:", err);
    res.status(500).json({ error: "Failed to unsuspend user" });
  }
};

/* ===============================
   CLAIM STATUS ACTIONS
================================ */
exports.acceptClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    claim.status = "accepted";
    await claim.save();
    res.json({ message: "Accepted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to accept claim" });
  }
};

exports.flagClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    claim.status = "flagged";
    await claim.save();
    res.json({ message: "Flagged" });
  } catch (err) {
    res.status(500).json({ error: "Failed to flag claim" });
  }
};

exports.rejectClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    claim.status = "rejected";
    await claim.save();
    res.json({ message: "Rejected" });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject claim" });
  }
};
