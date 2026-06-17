// backend/utils/sendEmail.js
//
// Sends transactional email via Brevo's HTTPS API (port 443).
// Render blocks outbound SMTP ports (465/587), so we do NOT use nodemailer/SMTP.
// Same signature as before — sendEmail(to, subject, text) — so no controller changes needed.

const sendEmail = async (to, subject, text) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "Veridex";

  if (!apiKey || !fromEmail) {
    throw new Error(
      "Email not configured: set BREVO_API_KEY and EMAIL_FROM environment variables"
    );
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Brevo email failed:", res.status, detail);
      throw new Error("Email could not be sent");
    }

    console.log("Email sent successfully via Brevo");
  } catch (error) {
    console.error("Email sending failed:", error.message);
    throw new Error("Email could not be sent");
  }
};

module.exports = sendEmail;
