const pool = require("../config/db");

const createRecruiterProfile = async (client, { userId, fullName }) => {
  const result = await client.query(
    `
    INSERT INTO recruiter (user_id, full_name)
    VALUES ($1, $2)
    RETURNING *
    `,
    [userId, fullName]
  );

  return result.rows[0];
};

const getRecruiterByUserId = async (userId) => {
  if (!userId) return null;

  const result = await pool.query(
    `
    SELECT *
    FROM recruiter
    WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

const getRecruiterPostingChecklistByUserId = async (userId) => {
  if (!userId) return null;

  const result = await pool.query(
    `
    SELECT
      r.id AS recruiter_id,
      COALESCE(r.is_verify_phone, FALSE) AS is_verify_phone,
      (
        c.company_id IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM pending_companies pc
          WHERE pc.recruiter_id = r.id
            AND NULLIF(BTRIM(pc.certificate), '') IS NOT NULL
        )
      ) AS has_company_info,
      COALESCE(NULLIF(BTRIM(c.certificate), '') IS NOT NULL, FALSE)
        AS is_certificate_approved
    FROM recruiter r
    LEFT JOIN company c ON c.company_id = r.company_id
    WHERE r.user_id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

const updateRecruiterById = async (id, updateData = {}) => {
  if (!id) return null;

  const fields = [
    { keys: ["fullName", "full_name"], column: "full_name" },
    { keys: ["phone"], column: "phone" },
    { keys: ["gender"], column: "gender" },
    { keys: ["location"], column: "location" },
    { keys: ["dateOfBirth", "date_of_birth"], column: "date_of_birth" },
    { keys: ["avatar"], column: "avatar" },
    { keys: ["certificate"], column: "certificate" },
    { keys: ["status"], column: "status" },
    { keys: ["companyId", "company_id"], column: "company_id" },
    { keys: ["isVerifyPhone", "is_verify_phone"], column: "is_verify_phone" },
  ];

  const setClauses = [];
  const values = [];

  fields.forEach(({ keys, column }) => {
    const key = keys.find((fieldKey) =>
      Object.prototype.hasOwnProperty.call(updateData, fieldKey)
    );

    if (!key) return;

    values.push(updateData[key]);
    setClauses.push(`${column} = $${values.length}`);
  });

  if (setClauses.length === 0) {
    const result = await pool.query(
      `
      SELECT *
      FROM recruiter
      WHERE id = $1
      `,
      [id]
    );

    return result.rows[0] || null;
  }

  values.push(id);

  const result = await pool.query(
    `
    UPDATE recruiter
    SET ${setClauses.join(", ")}
    WHERE id = $${values.length}
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
};

module.exports = {
  createRecruiterProfile,
  getRecruiterByUserId,
  getRecruiterPostingChecklistByUserId,
  updateRecruiterById,
};
