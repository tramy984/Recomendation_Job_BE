const nodemailer = require("nodemailer");

const getMailTransporter = () => {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  if (!to) return false;

  const transporter = getMailTransporter();

  if (!transporter) {
    console.log("SMTP chưa được cấu hình, bỏ qua gửi mail:", {
      to,
      subject,
    });
    return false;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html: html || `<p>${text}</p>`,
  });

  return true;
};

module.exports = {
  sendMail,
};
