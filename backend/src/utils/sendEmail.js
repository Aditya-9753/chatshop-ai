const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error("SMTP is not configured");
  }

  const recipient = String(to || "").trim();
  if (!recipient) throw new Error("Email recipient is missing");
  const senderAddress = String(process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER).trim();
  const senderName = String(process.env.EMAIL_FROM_NAME || "ChatShop AI").trim();

  const port = Number(process.env.EMAIL_PORT) || 587;
  const secure = String(process.env.EMAIL_SECURE).toLowerCase() === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    ...(port === 587 && { requireTLS: true }),
  });

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"${senderName}" <${senderAddress}>`,
        sender: senderAddress,
        replyTo: senderAddress,
        envelope: { from: senderAddress, to: recipient },
        to: recipient,
        subject,
        text: text || "",
        html: html || text,
      });
      const rejected = Array.isArray(info.rejected) ? info.rejected : [];
      if (rejected.length) throw new Error(`SMTP rejected recipient: ${rejected.join(", ")}`);
      const accepted = Array.isArray(info.accepted) ? info.accepted : [];
      if (!accepted.length) throw new Error("SMTP did not accept the recipient");

      console.log(`✅ Email sent from ${senderAddress} to ${recipient}: ${info.messageId}`);
      return { ...info, recipient, sender: senderAddress };
    } catch (error) {
      lastError = error;
      console.error(`❌ Email delivery attempt ${attempt}/2 failed:`, error.message);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw lastError || new Error("Email could not be delivered");
};

module.exports = sendEmail;
