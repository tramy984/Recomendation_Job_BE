const nodemailer = require("nodemailer");
const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");

const getMailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",

    requireTLS: true,

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    family: 4,

    connectionTimeout: 60000,
    greetingTimeout: 60000,
    socketTimeout: 60000,
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  try {
    console.log("Sending email to:", to);

    const transporter = getMailTransporter();

    await transporter.verify();

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
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