const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    username: { type: String, unique: true, sparse: true, trim: true, minlength: 3, maxlength: 30 },
    displayName: { type: String, trim: true, maxlength: 50 },
    bio: { type: String, default: "", maxlength: 160 },
    location: { type: String, default: "", maxlength: 60 },
    role: { type: String, enum: ["regular", "verified", "moderator"], default: "regular" },
    accountStatus: { type: String, enum: ["pending", "active", "suspended"], default: "pending" },
    profilePicture: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    suspensionReason: { type: String, default: null },

    // Stats
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    factCheckAccuracy: { type: Number, default: 0, min: 0, max: 100 },
    factCheckCount: { type: Number, default: 0, min: 0 },
    reportsReceived: { type: Number, default: 0, min: 0 },
    reportsResolved: { type: Number, default: 0, min: 0 },
    postCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    discussionCount: { type: Number, default: 0, min: 0 },
    upvotes: { type: Number, default: 0, min: 0 },
    downvotes: { type: Number, default: 0, min: 0 },
    karma: { type: Number, default: 0 },
    reputationPoints: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    isTopContributor: { type: Boolean, default: false },
    isExpertVerified: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.verificationToken = token;
  this.verificationTokenExpires = Date.now() + 60 * 60 * 1000;
  return token;
};

UserSchema.methods.getDisplayName = function () {
  if (this.displayName) return this.displayName;
  if (this.username) return "@" + this.username;
  return "@" + this.email.split("@")[0];
};

UserSchema.methods.calculateTrustScore = function () {
  const accuracyScore = this.factCheckAccuracy * 0.3;
  const totalVotes = this.upvotes + this.downvotes;
  let qualityScore = 50;
  if (totalVotes > 0) qualityScore = (this.upvotes / totalVotes) * 100;
  if (this.upvotes > 50) qualityScore = Math.min(100, qualityScore + 10);
  const contentQualityScore = qualityScore * 0.25;
  const accountAgeDays = (Date.now() - new Date(this.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const ageScore = Math.min(100, (accountAgeDays / 365) * 100);
  const accountAgeScore = ageScore * 0.15;
  const reportPenalty = Math.min(50, this.reportsReceived * 10);
  const reportsScore = Math.max(0, 100 - reportPenalty) * 0.15;
  const verificationScore = this.isVerified ? 15 : 0;
  this.trustScore = Math.max(0, Math.min(100, Math.round(accuracyScore + contentQualityScore + accountAgeScore + reportsScore + verificationScore)));
  return this.trustScore;
};

UserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    email: this.email,
    username: this.username,
    displayName: this.displayName || this.username || this.email.split("@")[0],
    bio: this.bio,
    location: this.location,
    role: this.role,
    accountStatus: this.accountStatus,
    isVerified: this.isVerified || this.role === "verified" || this.role === "moderator",
    profilePicture: this.profilePicture,
    trustScore: this.trustScore,
    factCheckAccuracy: this.factCheckAccuracy,
    reportsReceived: this.reportsReceived,
    reportsResolved: this.reportsResolved,
    postCount: this.postCount,
    commentCount: this.commentCount,
    discussionCount: this.discussionCount,
    upvotes: this.upvotes,
    downvotes: this.downvotes,
    karma: this.karma,
    reputationPoints: this.reputationPoints,
    badges: this.badges,
    isTopContributor: this.isTopContributor,
    isExpertVerified: this.isExpertVerified,
    joinedAt: this.createdAt,
    lastActive: this.lastActive
  };
};

module.exports = mongoose.model("User", UserSchema);
