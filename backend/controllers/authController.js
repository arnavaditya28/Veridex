const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

/* =========================
   GENERATE JWT
========================= */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* =========================
   PASSWORD VALIDATION
========================= */
const validatePassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
  return regex.test(password);
};

/* =========================
   SIGNUP
========================= */
exports.signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error: "Password must be at least 8 characters and include uppercase, lowercase and number"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = new User({ email, password });
    const token = user.generateVerificationToken();
    await user.save();

    const verificationURL = `${process.env.CLIENT_URL}/api/auth/verify/${token}`;
    await sendEmail(
      email,
      "Verify your Veridex account",
      `Click this link to verify your account (valid for 1 hour):\n\n${verificationURL}`
    );

    res.status(201).json({
      message: "Signup successful. Please check your email to verify your account."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during signup" });
  }
};

/* =========================
   VERIFY EMAIL
========================= */
exports.verifyEmail = async (req, res) => {
  try {
    const token = req.params.token;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired verification token" });
    }

    user.role = "verified";
    user.accountStatus = "active";
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json({ message: "Email verified successfully. You are now a verified user." });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
};

/* =========================
   LOGIN
========================= */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.accountStatus === "pending") {
      return res.status(403).json({ error: "Please verify your email first" });
    }

    if (user.accountStatus === "suspended") {
      return res.status(403).json({ error: "Your account is suspended" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Display name: @username if set, else @emailprefix
    const displayName = user.username
      ? "@" + user.username
      : "@" + user.email.split("@")[0];

    res.json({
      token: generateToken(user),
      role: user.role,
      email: user.email,
      username: user.username || null,
      displayName,
      isVerified: user.role === "verified" || user.role === "moderator"
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
};