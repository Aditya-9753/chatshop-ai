const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // Skip email sending if not configured (for testing)
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log("⚠️  Email not configured - skipping email send");
      console.log(`📧 Would have sent email to: ${to}`);
      console.log(`📧 Subject: ${subject}`);
      return {
        messageId: "test-mode-no-email",
        info: "Email skipped - no configuration",
      };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM || `"ChatShop AI" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || "",
      html: html || text,
    });

    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email sending error:", error.message);
    // Don't throw error in development - just log it
    if (process.env.NODE_ENV === "development") {
      console.log("⚠️  Email failed but continuing in development mode");
      return { messageId: "dev-mode-failed", error: error.message };
    }
    throw error;
  }
};

module.exports = sendEmail;
