const dns = require("dns");
const nodemailer = require("nodemailer");

dns.setDefaultResultOrder("ipv4first");

const getMailTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    connectionTimeout: 60000,
    greetingTimeout: 60000,
    socketTimeout: 60000,
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  try {
    if (!to) return false;

    console.log("Sending email to:", to);

    const transporter = getMailTransporter();

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });

    console.log("Send mail success:", info.messageId);
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