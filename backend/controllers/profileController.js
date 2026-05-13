const User = require("../models/User");
const Discussion = require("../models/Discussion");
const Claim = require("../models/Claim");

/* =========================
   GET OWN PROFILE
========================= */
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const postCount = await Discussion.countDocuments({ author: req.user._id, isDeleted: false });
    const claimCount = await Claim.countDocuments({ createdBy: req.user._id });

    const profileData = user.toSafeJSON();
    profileData.postCount = postCount;
    profileData.claimCount = claimCount;
    profileData.location = user.location || "";

    res.json(profileData);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
};

/* =========================
   UPDATE PROFILE
========================= */
exports.updateProfile = async (req, res) => {
  try {
    const { displayName, username, bio, location } = req.body;

    if (username !== undefined && username !== "") {
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        return res.status(400).json({
          error: "Username must be 3-30 characters: letters, numbers, underscores only"
        });
      }
      const existing = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (existing) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName.slice(0, 50);
    if (username !== undefined) updates.username = username || undefined; // don't set empty string
    if (bio !== undefined) updates.bio = bio.slice(0, 160);
    if (location !== undefined) updates.location = location.slice(0, 60);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user.toSafeJSON());
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

/* =========================
   GET PUBLIC PROFILE BY USERNAME
========================= */
exports.getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username })
      .select("-password -verificationToken -verificationTokenExpires -suspensionReason");

    if (!user) return res.status(404).json({ error: "User not found" });

    const postCount = await Discussion.countDocuments({ author: user._id, isDeleted: false });
    const claimCount = await Claim.countDocuments({ createdBy: user._id });

    const profileData = user.toSafeJSON();
    profileData.postCount = postCount;
    profileData.claimCount = claimCount;
    profileData.location = user.location || "";
    profileData.email = undefined; // never expose email on public profile

    res.json(profileData);
  } catch (err) {
    console.error("Get public profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
};
