const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  findUserByEmail,
  checkLogin,
  createUser,
  getUserByIdWithPassword,
  updateUserPasswordById,
} = require("../models/user.model");

const ALLOWED_ROLES = ["candidate", "recruiter"];

const register = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    const normalizedRole =
      typeof role === "string"
        ? role.trim().toLowerCase()
        : role;

    if (!fullName || !email || !password || !normalizedRole) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin.",
      });
    }

    // FULL NAME
    if (fullName.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên phải có ít nhất 3 ký tự.",
      });
    }

    // PASSWORD
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 8 ký tự.",
      });
    }

    // ROLE
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
      message: "Đăng ký tài khoản thành công",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau",
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
      message: "Đăng nhập thành công",
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    console.error("lỗi đăng nhập:", error);

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
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chua dang nhap.",
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin",
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
        message: "tài khoản của bạn đã bị khóa.",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không đúng",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await updateUserPasswordById(userId, passwordHash);

    return res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error("Lỗi:", error);

    return res.status(500).json({
      success: false,
      message: "lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

module.exports = {
  changePassword,
  register,
  login,
};
