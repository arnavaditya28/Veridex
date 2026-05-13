// utils/awardBadge.js
// Awards a badge to a user if they don't already have it

const User = require("../models/User");

async function awardBadge(userId, badge) {
  try {
    await User.findByIdAndUpdate(userId, {
      $addToSet: { badges: badge }
    });
  } catch (err) {
    console.error(`Failed to award badge "${badge}" to user ${userId}:`, err.message);
  }
}

module.exports = awardBadge;
