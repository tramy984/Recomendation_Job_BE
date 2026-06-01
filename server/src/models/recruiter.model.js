const pool = require("../config/db");

const RECRUITER_FIELDS = `
  SELECT
    r.*,
    u.email,
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
    LEFT JOIN users u ON u.id = r.user_id
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
    LEFT JOIN users u ON u.id = r.user_id
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
      COALESCE(r.status, FALSE) AS recruiter_status,
      (
        c.company_id IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM pending_companies pc
          WHERE pc.recruiter_id = r.id
            AND NULLIF(BTRIM(pc.certificate), '') IS NOT NULL
        )
      ) AS has_company_info,
      COALESCE(r.status, FALSE) AS is_certificate_approved
    FROM recruiter r
    LEFT JOIN company c ON c.company_id = r.company_id
    WHERE r.user_id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

const getRecruiterPostedJobStats = async (recruiterId, filters = {}) => {
  if (!recruiterId) {
    return {
      total: 0,
      byYear: [],
      byMonth: [],
    };
  }

  const periodValues = [recruiterId];
  const periodWhere = ["recruiter_id = $1"];

  if (filters.year) {
    periodValues.push(filters.year);
    periodWhere.push(
      `EXTRACT(YEAR FROM created_at)::int = $${periodValues.length}`
    );
  }

  if (filters.month) {
    periodValues.push(filters.month);
    periodWhere.push(
      `EXTRACT(MONTH FROM created_at)::int = $${periodValues.length}`
    );
  }

  const totalQuery = pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM jobs
    WHERE ${periodWhere.join(" AND ")}
    `,
    periodValues
  );

  const byYearQuery = pool.query(
    `
    SELECT
      EXTRACT(YEAR FROM created_at)::int AS year,
      COUNT(*)::int AS total
    FROM jobs
    WHERE recruiter_id = $1
    GROUP BY EXTRACT(YEAR FROM created_at)::int
    ORDER BY year ASC
    `,
    [recruiterId]
  );

  const byMonthQuery = filters.year
    ? pool.query(
        `
        WITH months AS (
          SELECT generate_series(1, 12)::int AS month
        )
        SELECT
          $2::int AS year,
          m.month,
          COALESCE(COUNT(j.id), 0)::int AS total
        FROM months m
        LEFT JOIN jobs j
          ON j.recruiter_id = $1
          AND EXTRACT(YEAR FROM j.created_at)::int = $2
          AND EXTRACT(MONTH FROM j.created_at)::int = m.month
        GROUP BY m.month
        ORDER BY m.month ASC
        `,
        [recruiterId, filters.year]
      )
    : pool.query(
        `
        SELECT
          EXTRACT(YEAR FROM created_at)::int AS year,
          EXTRACT(MONTH FROM created_at)::int AS month,
          COUNT(*)::int AS total
        FROM jobs
        WHERE recruiter_id = $1
        GROUP BY
          EXTRACT(YEAR FROM created_at)::int,
          EXTRACT(MONTH FROM created_at)::int
        ORDER BY year ASC, month ASC
        `,
        [recruiterId]
      );

  const [totalResult, byYearResult, byMonthResult] = await Promise.all([
    totalQuery,
    byYearQuery,
    byMonthQuery,
  ]);

  const byMonth = filters.month
    ? byMonthResult.rows.filter((item) => Number(item.month) === filters.month)
    : byMonthResult.rows;

  return {
    total: totalResult.rows[0]?.total || 0,
    byYear: byYearResult.rows,
    byMonth,
  };
};

const getRecruiterApplicationsByJobStats = async (
  recruiterId,
  filters = {}
) => {
  if (!recruiterId) return [];

  const values = [recruiterId];
  const applicationDateConditions = [];

  if (filters.year) {
    values.push(filters.year);
    applicationDateConditions.push(
      `EXTRACT(YEAR FROM a.created_at)::int = $${values.length}`
    );
  }

  if (filters.month) {
    values.push(filters.month);
    applicationDateConditions.push(
      `EXTRACT(MONTH FROM a.created_at)::int = $${values.length}`
    );
  }

  const applicationDateSql =
    applicationDateConditions.length > 0
      ? `AND ${applicationDateConditions.join(" AND ")}`
      : "";

  const result = await pool.query(
    `
    SELECT
      j.id AS job_id,
      j.name AS job_name,
      j.status AS job_status,
      j.created_at AS job_created_at,
      COALESCE(COUNT(a.id), 0)::int AS total_applications,
      COALESCE(
        COUNT(a.id) FILTER (WHERE a.status = 'approved'),
        0
      )::int AS cv_passed_applications
    FROM jobs j
    LEFT JOIN applications a
      ON a.job_id = j.id
      ${applicationDateSql}
    WHERE j.recruiter_id = $1
    GROUP BY
      j.id,
      j.name,
      j.status,
      j.created_at
    ORDER BY j.created_at DESC, j.id DESC
    `,
    values
  );

  return result.rows;
};

const getRecruiterCvPassedStats = async (recruiterId, filters = {}) => {
  if (!recruiterId) return { total: 0 };

  const values = [recruiterId];
  const whereClauses = [
    "j.recruiter_id = $1",
    "a.status = 'approved'",
  ];

  if (filters.year) {
    values.push(filters.year);
    whereClauses.push(
      `EXTRACT(YEAR FROM a.created_at)::int = $${values.length}`
    );
  }

  if (filters.month) {
    values.push(filters.month);
    whereClauses.push(
      `EXTRACT(MONTH FROM a.created_at)::int = $${values.length}`
    );
  }

  const result = await pool.query(
    `
    SELECT COUNT(a.id)::int AS total
    FROM applications a
    INNER JOIN jobs j ON j.id = a.job_id
    WHERE ${whereClauses.join(" AND ")}
    `,
    values
  );

  return {
    total: result.rows[0]?.total || 0,
  };
};

const getRecruiterDashboardStatistics = async (recruiterId, filters = {}) => {
  const [postedJobs, applicationsByJob, cvPassed] = await Promise.all([
    getRecruiterPostedJobStats(recruiterId, filters),
    getRecruiterApplicationsByJobStats(recruiterId, filters),
    getRecruiterCvPassedStats(recruiterId, filters),
  ]);

  return {
    postedJobs,
    applicationsByJob,
    cvPassed: {
      total: cvPassed.total,
      byJob: applicationsByJob.map((job) => ({
        job_id: job.job_id,
        job_name: job.job_name,
        total: job.cv_passed_applications,
      })),
    },
  };
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
  getRecruiterDashboardStatistics,
  getRecruiterById,
  getRecruiterByUserId,
  getRecruiterPostingChecklistByUserId,
  updateRecruiterById,
};
