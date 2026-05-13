const mongoose = require("mongoose");

/* =======================
   REPLY SCHEMA (Recursive)
======================= */
const ReplySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true
    },

    /* 🔹 AUTHOR NOW OBJECTID */
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    content: {
      type: String,
      required: true,
      trim: true
    },

    votes: {
      up: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      down: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ]
    },

    replies: []
  },
  { timestamps: true }
);

ReplySchema.add({
  replies: [ReplySchema]
});

/* =======================
   POLL SCHEMA
======================= */
const PollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true
    },

    options: [
      {
        text: { type: String, required: true },
        votes: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
          }
        ]
      }
    ]
  },
  { _id: false }
);

/* =======================
   DISCUSSION (POST)
======================= */
const DiscussionSchema = new mongoose.Schema(
  {
    claimId: {
      type: String,
      default: "global",
      index: true
    },

    id: {
      type: String,
      required: true
    },

    /* 🔹 AUTHOR OBJECTID */
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ["text", "link", "image", "poll"],
      required: true
    },

    content: String,
    link: String,
    image: [String],
    tag: {
      type: String,
      enum: ["Source", "Opinion", "Correction", "Speculation", null],
      default: null
    },

    poll: PollSchema,

    votes: {
      up: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      down: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ]
    },

    replies: {
      type: [ReplySchema],
      default: []
    },

    /* 🔹 MODERATOR CONTROLS */
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

module.exports = mongoose.model("Discussion", DiscussionSchema);
