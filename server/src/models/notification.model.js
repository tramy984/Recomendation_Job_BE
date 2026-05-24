const pool = require("../config/db");

let tableReadyPromise = null;

const ensureNotificationTable = () => {
  if (!tableReadyPromise) {
    tableReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,
        sender_id BIGINT,
        receiver_id BIGINT,
        title VARCHAR(255),
        content TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notification_sender
          FOREIGN KEY (sender_id)
          REFERENCES users(id),
        CONSTRAINT fk_notification_receiver
          FOREIGN KEY (receiver_id)
          REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_created_at
        ON notifications(created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_notifications_receiver
        ON notifications(receiver_id, created_at DESC, id DESC);
    `);
  }

  return tableReadyPromise;
};

const getNotificationsByReceiverId = async (receiverId) => {
  await ensureNotificationTable();

  const result = await pool.query(
    `
    SELECT
      n.id,
      n.sender_id,
      CASE
        WHEN sender.role = 'candidate' THEN 'Ứng viên'
        WHEN sender.role = 'recruiter' THEN 'Nhà tuyển dụng'
        ELSE 'Hệ thống'
      END AS sender,
      n.receiver_id,
      n.title,
      n.content,
      n.is_read,
      n.created_at
    FROM notifications n
    LEFT JOIN users sender ON sender.id = n.sender_id
    WHERE n.receiver_id = $1
    ORDER BY n.created_at DESC, n.id DESC
    `,
    [receiverId]
  );

  return result.rows;
};

const markAllNotificationsAsReadByReceiverId = async (receiverId) => {
  await ensureNotificationTable();

  const result = await pool.query(
    `
    UPDATE notifications
    SET is_read = TRUE
    WHERE receiver_id = $1
      AND is_read = FALSE
    RETURNING
      id,
      sender_id,
      receiver_id,
      title,
      content,
      is_read,
      created_at
    `,
    [receiverId]
  );

  return result.rows;
};

module.exports = {
  getNotificationsByReceiverId,
  markAllNotificationsAsReadByReceiverId,
};
