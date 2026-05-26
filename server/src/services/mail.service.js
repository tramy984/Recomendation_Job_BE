const nodemailer = require("nodemailer");

const getMailTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  const baseConfig = {
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 60000,
    greetingTimeout: 60000,
    socketTimeout: 60000,
  };

  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      ...baseConfig,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
    });
  }

  return nodemailer.createTransport({
    ...baseConfig,
    service: "gmail",
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  try {
    if (!to) return false;

    const transporter = getMailTransporter();

    if (!transporter) {
      console.log("SMTP is not configured");
      return false;
    }

    console.log("Sending email to:", to);

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });

    console.log("Email sent successfully:", info.messageId);

    return true;
  } catch (error) {
    console.error("Send mail error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });

    return false;
  }
};

module.exports = {
  sendMail,
};
