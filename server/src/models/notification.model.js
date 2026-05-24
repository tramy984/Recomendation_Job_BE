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
        type VARCHAR(100),
        reference_type VARCHAR(100),
        reference_id BIGINT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        CONSTRAINT fk_notification_sender
          FOREIGN KEY (sender_id)
          REFERENCES users(id),
        CONSTRAINT fk_notification_receiver
          FOREIGN KEY (receiver_id)
          REFERENCES users(id)
      );

      ALTER TABLE notifications
        ALTER COLUMN is_read SET DEFAULT FALSE;

      ALTER TABLE notifications
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS type VARCHAR(100);

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS reference_type VARCHAR(100);

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS reference_id BIGINT;

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

      CREATE INDEX IF NOT EXISTS idx_notifications_created_at
        ON notifications(created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_notifications_receiver
        ON notifications(receiver_id, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_notifications_reference
        ON notifications(receiver_id, type, reference_type, reference_id);
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
      n.type,
      n.reference_type,
      n.reference_id,
      n.is_read,
      n.created_at,
      n.updated_at
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
      type,
      reference_type,
      reference_id,
      is_read,
      created_at,
      updated_at
    `,
    [receiverId]
  );

  return result.rows;
};

const createNotification = async ({
  senderId = null,
  receiverId,
  title,
  content,
  type = "general",
  referenceType = null,
  referenceId = null,
}) => {
  await ensureNotificationTable();

  const result = await pool.query(
    `
    INSERT INTO notifications (
      sender_id,
      receiver_id,
      title,
      content,
      type,
      reference_type,
      reference_id,
      is_read,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
    RETURNING
      id,
      sender_id,
      receiver_id,
      title,
      content,
      type,
      reference_type,
      reference_id,
      is_read,
      created_at,
      updated_at
    `,
    [senderId, receiverId, title, content, type, referenceType, referenceId]
  );

  return result.rows[0] || null;
};

const getUserEmailById = async (userId) => {
  if (!userId) return null;

  const result = await pool.query(
    `
    SELECT email
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0]?.email || null;
};

const getJobApplicationNotificationTarget = async (jobId) => {
  if (!jobId) return null;

  const result = await pool.query(
    `
    SELECT
      j.id AS job_id,
      j.name AS job_name,
      COALESCE(j.applied_number, 0) AS applied_number,
      r.user_id AS receiver_id,
      u.email AS receiver_email
    FROM jobs j
    LEFT JOIN recruiter r ON r.id = j.recruiter_id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE j.id = $1
    `,
    [jobId]
  );

  return result.rows[0] || null;
};

const upsertJobApplicationCountNotification = async ({
  receiverId,
  jobId,
  title,
  content,
}) => {
  await ensureNotificationTable();

  const existingResult = await pool.query(
    `
    SELECT id
    FROM notifications
    WHERE receiver_id = $1
      AND type = 'job_application_count'
      AND reference_type = 'job'
      AND reference_id = $2
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    [receiverId, jobId]
  );

  const existingNotification = existingResult.rows[0];

  if (existingNotification) {
    const updateResult = await pool.query(
      `
      UPDATE notifications
      SET
        sender_id = NULL,
        title = $2,
        content = $3,
        is_read = FALSE,
        created_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        sender_id,
        receiver_id,
        title,
        content,
        type,
        reference_type,
        reference_id,
        is_read,
        created_at,
        updated_at
      `,
      [existingNotification.id, title, content]
    );

    return updateResult.rows[0] || null;
  }

  return createNotification({
    senderId: null,
    receiverId,
    title,
    content,
    type: "job_application_count",
    referenceType: "job",
    referenceId: jobId,
  });
};

module.exports = {
  createNotification,
  getJobApplicationNotificationTarget,
  getNotificationsByReceiverId,
  getUserEmailById,
  markAllNotificationsAsReadByReceiverId,
  upsertJobApplicationCountNotification,
};
