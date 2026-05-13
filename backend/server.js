require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");

const app = express();

connectDB();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/uploads", express.static("uploads"));

app.get("/health", (req, res) => {
  res.json({ status: "Veridex backend running" });
});

// Auth
app.use("/api/auth", require("./routes/authRoutes"));

// Profile
app.use("/api/profile", require("./routes/profileRoutes"));

// Claims — mounted at BOTH paths so frontend works regardless
app.use("/claims", require("./routes/claimRoutes"));
app.use("/api/claims", require("./routes/claimRoutes"));

// Sources — mounted at BOTH paths
app.use("/sources", require("./routes/sourceRoutes"));
app.use("/api/sources", require("./routes/sourceRoutes"));

// Evaluation
app.use("/evaluate", require("./routes/evaluateRoutes"));
app.use("/api/evaluate", require("./routes/evaluateRoutes"));

// Discussions
app.use("/discussions", require("./routes/discussionRoutes"));
app.use("/api/discussions", require("./routes/discussionRoutes"));

// Moderator
app.use("/api/moderator", require("./routes/moderatorRoutes"));

app.get("/", (req, res) => {
  res.send("Veridex backend running");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Veridex server running on port ${PORT}`);
});
