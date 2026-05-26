const nodemailer = require("nodemailer");

const getMailTransporter = () => {
  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  try {
    if (!to) return false;

    const transporter = getMailTransporter();

    if (!transporter) {
      console.log("SMTP chưa được cấu hình");
      return false;
    }

    console.log("Đang gửi email tới:", to);

    await transporter.verify();

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });

    console.log("Gửi email thành công:", info.messageId);

    return true;
  } catch (error) {
    console.error("Lỗi gửi mail:", {
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