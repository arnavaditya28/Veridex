# Veridex

> A public information reliability platform — submit claims, attach supporting sources, and let the community evaluate and discuss how trustworthy they are.

Veridex lets users post claims, back them with evidence (including uploaded PDF documents that are parsed automatically), and have those claims evaluated and debated. It includes user accounts with email verification, threaded discussions, and a moderator role for oversight.

## Features

- **Claim submission & evaluation** — users submit claims and the community evaluates their reliability
- **AI evidence check** *(optional)* — when a Gemini API key (free tier) is configured, evaluation judges whether each source actually supports, contradicts, or is unrelated to the claim, and factors that into the reliability score
- **Reliability history** — every evaluation is snapshotted, so a claim's reliability score can be charted over time as sources are added and reviewed
- **Source attachments** — attach supporting sources, including PDF uploads parsed with `pdf-parse`
- **Discussions** — threaded discussion around each claim
- **Authentication** — JWT-based auth with email verification (Gmail SMTP)
- **Moderation** — dedicated moderator role and routes
- **Hardened backend** — Helmet, rate limiting, mongo-sanitize, HPP, and XSS protection

## Tech Stack

**Frontend:** HTML, CSS, JavaScript, Bootstrap (served statically by the backend)

**Backend:** Node.js, Express.js, MongoDB (Mongoose), JWT (`jsonwebtoken`), bcryptjs, Multer, Nodemailer

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- A MongoDB instance — local (`mongodb://127.0.0.1:27017/veridex`) or MongoDB Atlas
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) for email verification

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/veridex.git
cd veridex

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment variables
#    Copy the example file, then fill in your own values
cp .env.example .env

# 4. Start the server
npm start        # or: npm run dev   (auto-reload with nodemon)
```

### Environment Variables

Create `backend/.env` from `backend/.env.example` and set:

| Variable      | Description                                          |
|---------------|------------------------------------------------------|
| `PORT`        | Port the server runs on (default `3001`)             |
| `MONGO_URI`   | MongoDB connection string                            |
| `JWT_SECRET`  | Secret used to sign JWT tokens                       |
| `EMAIL_USER`  | Gmail address used to send verification emails       |
| `EMAIL_PASS`  | Gmail **App Password** (not your account password)   |
| `CLIENT_URL`  | Base URL of the app (default `http://localhost:3001`)|
| `GEMINI_API_KEY` | *(optional)* Enables the AI evidence check (free key at aistudio.google.com) |
| `GEMINI_MODEL`   | *(optional)* Gemini model for the AI check (default `gemini-2.5-flash`)     |

### Running

Once the server is running, open **http://localhost:3001** in your browser — the backend serves the frontend from the `frontend/` directory.

## Project Structure

```
Veridex/
├── backend/
│   ├── config/         # DB connection
│   ├── controllers/    # Route handlers
│   ├── middleware/     # Auth & security middleware
│   ├── models/         # Mongoose schemas
│   ├── routes/         # API routes (auth, claims, sources, evaluate, discussions, moderator)
│   ├── rules/          # Evaluation rules
│   ├── utils/          # Helpers
│   ├── uploads/        # User uploads (gitignored)
│   └── server.js       # App entry point
└── frontend/           # HTML/CSS/JS + Bootstrap (index, submit, discussion, profile, moderator, about)
```
<img width="1001" height="485" alt="10" src="https://github.com/user-attachments/assets/8bf1313a-c987-4c5e-8eea-58079b3ca200" />

<img width="999" height="461" alt="11" src="https://github.com/user-attachments/assets/0e054d71-c368-4b63-995d-46211c0213e5" />

<img width="695" height="906" alt="16" src="https://github.com/user-attachments/assets/b25b7c1b-12fe-4502-81ca-a6065a1002ca" />

<img width="1253" height="579" alt="27" src="https://github.com/user-attachments/assets/9860ea68-55ca-4100-bb60-fb91ff7f07c0" />



## Veridex - Testing

https://drive.google.com/file/d/1Tf7A-OCwbbimbSOFDfW5H3puRgPO7Nwx/view?usp=drive_link



## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
