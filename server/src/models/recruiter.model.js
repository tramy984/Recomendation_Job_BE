const pool = require("../config/db");

const RECRUITER_FIELDS = `
  SELECT
    r.*,
    CASE
      WHEN c.company_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'company_id', c.company_id,
        'name', c.name,
        'tax_code', c.tax_code,
        'description', c.description,
        'location', c.location,
        'url_website', c.url_website,
        'url_facebook', c.url_facebook,
        'certificate', c.certificate,
        'logo', c.logo,
        'industries', COALESCE(
          (
            SELECT jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', i.id,
                'name', i.name
              )
            )
            FROM company_industry ci
            INNER JOIN industry i ON i.id = ci.id_industry
            WHERE ci.id_company = c.company_id
          ),
          '[]'::jsonb
        )
      )
    END AS company
`;

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
    ${RECRUITER_FIELDS}
    FROM recruiter r
    LEFT JOIN company c ON c.company_id = r.company_id
    WHERE r.user_id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

const getRecruiterById = async (recruiterId) => {
  if (!recruiterId) return null;

  const result = await pool.query(
    `
    ${RECRUITER_FIELDS}
    FROM recruiter r
    LEFT JOIN company c ON c.company_id = r.company_id
    WHERE r.id = $1
    `,
    [recruiterId]
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

  const hasPhoneUpdate = Object.prototype.hasOwnProperty.call(
    updateData,
    "phone"
  );
  const hasVerifyPhoneUpdate =
    Object.prototype.hasOwnProperty.call(updateData, "isVerifyPhone") ||
    Object.prototype.hasOwnProperty.call(updateData, "is_verify_phone");

  if (hasPhoneUpdate && !hasVerifyPhoneUpdate) {
    const currentResult = await pool.query(
      `
      SELECT phone
      FROM recruiter
      WHERE id = $1
      `,
      [id]
    );

    const currentPhone = currentResult.rows[0]?.phone ?? null;
    const nextPhone = updateData.phone ?? null;

    if (nextPhone !== currentPhone) {
      updateData = {
        ...updateData,
        isVerifyPhone: false,
      };
    }
  }

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
  getRecruiterById,
  getRecruiterByUserId,
  getRecruiterPostingChecklistByUserId,
  updateRecruiterById,
};
