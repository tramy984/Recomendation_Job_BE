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
  updateRecruiterById,
};
