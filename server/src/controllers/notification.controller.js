const {
  getNotificationsByReceiverId,
  markAllNotificationsAsReadByReceiverId,
} = require("../models/notification.model");

const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập.",
      });
    }

    const notifications = await getNotificationsByReceiverId(userId);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách thông báo theo người dùng thành công.",
      data: {
        notifications,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách thông báo theo người dùng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const readAllNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chua dang nhap.",
      });
    }

    const notifications = await markAllNotificationsAsReadByReceiverId(userId);

    return res.status(200).json({
      success: true,
      message: "Da danh dau tat ca thong bao la da doc.",
      data: {
        updatedCount: notifications.length,
        notifications,
      },
    });
  } catch (error) {
    console.error("Loi danh dau tat ca thong bao la da doc:", error);

    return res.status(500).json({
      success: false,
      message: "Loi server. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getNotifications,
  readAllNotifications,
};
