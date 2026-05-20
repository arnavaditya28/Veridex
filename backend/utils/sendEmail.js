const https = require("https");

const sendEmail = async (to, subject, text) => {
  const data = JSON.stringify({
    sender: { name: "Veridex", email: process.env.EMAIL_USER },
    to: [{ email: to }],
    subject,
    textContent: text
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log("Email sent successfully");
          resolve();
        } else {
          console.error("Brevo error:", body);
          reject(new Error("Email could not be sent"));
        }
      });
    });

    req.on("error", (error) => {
      console.error("Email sending failed:", error);
      reject(new Error("Email could not be sent"));
    });

    req.write(data);
    req.end();
  });
};

module.exports = sendEmail;
