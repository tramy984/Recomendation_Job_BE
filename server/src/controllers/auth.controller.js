const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const {
  findUserByEmail,
  checkLogin,
  createUser,
  getUserByIdWithPassword,
  updateUserPasswordById,
} = require("../models/user.model");

const {
  getRecruiterByUserId,
  updateRecruiterById,
} = require("../models/recruiter.model");

const {
  createPhoneVerificationCode,
  getActivePhoneVerificationCode,
  increasePhoneVerificationAttempts,
  consumePhoneVerificationCode,
} = require("../models/phone_verification.model");

const {
  createEmailVerificationCode,
  getActiveEmailVerificationCode,
  increaseEmailVerificationAttempts,
  consumeEmailVerificationCode,
} = require("../models/email_verification.model");

const ALLOWED_ROLES = ["candidate", "recruiter"];
const OTP_EXPIRES_IN_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

const normalizeEmail = (email) => {
  if (typeof email !== "string") return null;

  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return null;
  }

  return normalizedEmail;
};

const normalizePhoneNumber = (phone) => {
  if (typeof phone !== "string") return null;

  const compactPhone = phone.replace(/[\s().-]/g, "");

  if (/^0\d{9}$/.test(compactPhone)) {
    return `+84${compactPhone.slice(1)}`;
  }

  if (/^84\d{9}$/.test(compactPhone)) {
    return `+${compactPhone}`;
  }

  if (/^\+84\d{9}$/.test(compactPhone)) {
    return compactPhone;
  }

  return null;
};

const generateOtp = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const sendPhoneOtp = async ({ phone, otp }) => {
  console.log("======================================");
  console.log("OTP XÁC THỰC SỐ ĐIỆN THOẠI");
  console.log("Số điện thoại:", phone);
  console.log("Mã OTP:", otp);
  console.log("Hiệu lực:", OTP_EXPIRES_IN_MINUTES, "phút");
  console.log("======================================");

  return true;
};

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

const sendEmailOtp = async ({ email, otp }) => {
  console.log("======================================");
  console.log("OTP XÁC THỰC EMAIL");
  console.log("Email:", email);
  console.log("Mã OTP:", otp);
  console.log("Hiệu lực:", OTP_EXPIRES_IN_MINUTES, "phút");
  console.log("======================================");

  const transporter = getMailTransporter();

  if (!transporter) {
    console.log(
      "SMTP chưa được cấu hình, bỏ qua bước gửi email thật. Hãy xem OTP ở terminal."
    );
    return false;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Mã OTP xác thực email",
    text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong ${OTP_EXPIRES_IN_MINUTES} phút.`,
    html: `
      <p>Mã OTP của bạn là:</p>
      <h2>${otp}</h2>
      <p>Mã có hiệu lực trong ${OTP_EXPIRES_IN_MINUTES} phút.</p>
    `,
  });

  return true;
};

const register = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    const normalizedRole =
      typeof role === "string" ? role.trim().toLowerCase() : role;

    if (!fullName || !email || !password || !normalizedRole) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin.",
      });
    }

    if (fullName.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên phải có ít nhất 3 ký tự.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 8 ký tự.",
      });
    }

    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Role không hợp lệ.",
      });
    }

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email của bạn đã được sử dụng.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await createUser({
      fullName,
      email,
      passwordHash,
      role: normalizedRole,
    });

    const token = process.env.JWT_SECRET
      ? jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        )
      : null;

    return res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công.",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập email và mật khẩu.",
      });
    }

    const user = await checkLogin(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng.",
      });
    }

    if (user.status === false) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng.",
      });
    }

    const { password: passwordHash, ...userWithoutPassword } = user;

    const token = process.env.JWT_SECRET
      ? jwt.sign(
          {
            id: userWithoutPassword.id,
            email: userWithoutPassword.email,
            role: userWithoutPassword.role,
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        )
      : null;

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công.",
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const checkEmailRegistered = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ.",
      });
    }

    const user = await findUserByEmail(email);

    return res.status(200).json({
      success: true,
      message: user
        ? "Email đã được đăng ký tài khoản."
        : "Email chưa được đăng ký tài khoản.",
      data: {
        email,
        isRegistered: Boolean(user),
      },
    });
  } catch (error) {
    console.error("Lỗi kiểm tra email đăng ký:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập.",
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 8 ký tự.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
      });
    }

    const user = await getUserByIdWithPassword(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản.",
      });
    }

    if (user.status === false) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa.",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không đúng.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await updateUserPasswordById(userId, passwordHash);

    return res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công.",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const requestEmailOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ.",
      });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000
    );

    await createEmailVerificationCode({
      email,
      otpHash,
      expiresAt,
    });

    const emailSent = await sendEmailOtp({ email, otp });

    return res.status(200).json({
      success: true,
      message: emailSent
        ? "Đã gửi mã OTP đến email. Vui lòng xem thêm OTP trong terminal backend để test."
        : "Đã tạo mã OTP. SMTP chưa cấu hình nên hay xem OTP trong terminal backend.",
      data: {
        email,
        emailSent,
        expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
      },
    });
  } catch (error) {
    console.error("Lỗi gửi OTP xác thực email:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Email hoặc mã OTP không hợp lệ.",
      });
    }

    const verificationCode = await getActiveEmailVerificationCode(email);

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không tồn tại hoặc đã hết hạn.",
      });
    }

    if (verificationCode.attempts >= OTP_MAX_ATTEMPTS) {
      await consumeEmailVerificationCode(verificationCode.id);

      return res.status(429).json({
        success: false,
        message: "Bạn đã nhập sai OTP quá nhiều lần. Hãy gửi lại mã mới.",
      });
    }

    const isOtpValid = await bcrypt.compare(otp, verificationCode.otp_hash);

    if (!isOtpValid) {
      const updatedCode = await increaseEmailVerificationAttempts(
        verificationCode.id
      );

      return res.status(400).json({
        success: false,
        message: "Mã OTP không đúng.",
        data: {
          remainingAttempts: Math.max(
            OTP_MAX_ATTEMPTS - (updatedCode?.attempts || 0),
            0
          ),
        },
      });
    }

    await consumeEmailVerificationCode(verificationCode.id);

    return res.status(200).json({
      success: true,
      message: "Xác thực email thành công.",
      data: {
        email,
      },
    });
  } catch (error) {
    console.error("Lỗi xác thực OTP email:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const requestPhoneOtp = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const phone = normalizePhoneNumber(req.body?.phone);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhà tuyển dụng mới có thể xác thực số điện thoại.",
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại không hợp lệ. Hãy dùng số Việt Nam 10 chữ số.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000
    );

    await createPhoneVerificationCode({
      userId,
      phone,
      otpHash,
      expiresAt,
    });

    await sendPhoneOtp({ phone, otp });

    return res.status(200).json({
      success: true,
      message: "Đã tạo mã OTP.",
      data: {
        phone,
        expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
      },
    });
  } catch (error) {
    console.error("Lỗi gửi OTP xác thực số điện thoại:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const verifyPhoneOtp = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const phone = normalizePhoneNumber(req.body?.phone);
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhà tuyển dụng mới có thể xác thực số điện thoại.",
      });
    }

    if (!phone || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại hoặc mã OTP không hợp lệ.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    const verificationCode = await getActivePhoneVerificationCode({
      userId,
      phone,
    });

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không tồn tại hoặc đã hết hạn.",
      });
    }

    if (verificationCode.attempts >= OTP_MAX_ATTEMPTS) {
      await consumePhoneVerificationCode(verificationCode.id);

      return res.status(429).json({
        success: false,
        message: "Bạn đã nhập sai OTP quá nhiều lần. Hãy gửi lại mã mới.",
      });
    }

    const isOtpValid = await bcrypt.compare(otp, verificationCode.otp_hash);

    if (!isOtpValid) {
      const updatedCode = await increasePhoneVerificationAttempts(
        verificationCode.id
      );

      return res.status(400).json({
        success: false,
        message: "Mã OTP không đúng.",
        data: {
          remainingAttempts: Math.max(
            OTP_MAX_ATTEMPTS - (updatedCode?.attempts || 0),
            0
          ),
        },
      });
    }

    await consumePhoneVerificationCode(verificationCode.id);

    const updatedRecruiter = await updateRecruiterById(recruiter.id, {
      phone,
      isVerifyPhone: true,
    });

    return res.status(200).json({
      success: true,
      message: "Xác thực số điện thoại thành công.",
      data: {
        recruiter: updatedRecruiter,
      },
    });
  } catch (error) {
    console.error("Lỗi xác thực số điện thoại:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

module.exports = {
  changePassword,
  register,
  login,
  checkEmailRegistered,
  requestEmailOtp,
  verifyEmailOtp,
  requestPhoneOtp,
  verifyPhoneOtp,
};
