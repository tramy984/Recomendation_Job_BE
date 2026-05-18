const pool = require("../config/db");

const COMPANY_FIELDS = `
  SELECT
    c.company_id,
    c.name,
    c.tax_code,
    c.description,
    c.location,
    c.url_website,
    c.url_facebook,
    c.certificate,
    c.logo,
    COALESCE(
      (
        SELECT jsonb_agg(
          DISTINCT jsonb_build_object(
            'id', r.id,
            'full_name', r.full_name,
            'phone', r.phone,
            'gender', r.gender,
            'location', r.location,
            'avatar', r.avatar,
            'is_verify_phone', COALESCE(r.is_verify_phone, FALSE)
          )
        )
        FROM recruiter r
        WHERE r.company_id = c.company_id
      ),
      '[]'::jsonb
    ) AS recruiters,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', j.id,
            'name', j.name,
            'description', j.description,
            'requirement', j.job_requirement,
            'benefit', j.job_benefit,
            'salary_min', j.salary_min,
            'salary_max', j.salary_max,
            'location', j.location,
            'expire', j.expire,
            'status', j.status,
            'level_name', lt.name,
            'job_type_name', jt.name,
            'created_at', j.created_at
          )
          ORDER BY j.created_at DESC, j.id DESC
        )
        FROM jobs j
        LEFT JOIN level_table lt ON lt.id = j.id_level
        LEFT JOIN job_type jt ON jt.id = j.job_type_id
        WHERE j.company_id = c.company_id
          AND j.status = 1
          AND (j.expire IS NULL OR j.expire > CURRENT_TIMESTAMP)
      ),
      '[]'::jsonb
    ) AS jobs,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', i.id,
          'name', i.name
        )
      ) FILTER (WHERE i.id IS NOT NULL),
      '[]'::jsonb
    ) AS industries
`;

const getCompanyById = async (companyId) => {
  if (!companyId) return null;

  const result = await pool.query(
    `
    ${COMPANY_FIELDS}
    FROM company c
    LEFT JOIN company_industry ci ON ci.id_company = c.company_id
    LEFT JOIN industry i ON i.id = ci.id_industry
    WHERE c.company_id = $1
    GROUP BY c.company_id
    `,
    [companyId]
  );

  return result.rows[0] || null;
};

const getAllCompanies = async () => {
  const result = await pool.query(
    `
    ${COMPANY_FIELDS}
    FROM company c
    LEFT JOIN company_industry ci ON ci.id_company = c.company_id
    LEFT JOIN industry i ON i.id = ci.id_industry
    GROUP BY c.company_id
    ORDER BY c.company_id DESC
    `
  );

  return result.rows;
};

const getCompaniesByName = async (name) => {
  const keyword = typeof name === "string" ? name.trim() : "";

  if (!keyword) return [];

  const result = await pool.query(
    `
    ${COMPANY_FIELDS}
    FROM company c
    LEFT JOIN company_industry ci ON ci.id_company = c.company_id
    LEFT JOIN industry i ON i.id = ci.id_industry
    WHERE c.name ILIKE $1
    GROUP BY c.company_id
    ORDER BY c.company_id DESC
    `,
    [`%${keyword}%`]
  );

  return result.rows;
};

const getCompaniesByExactName = async (name) => {
  const keyword = typeof name === "string" ? name.trim() : "";

  if (!keyword) return [];

  const result = await pool.query(
    `
    ${COMPANY_FIELDS}
    FROM company c
    LEFT JOIN company_industry ci ON ci.id_company = c.company_id
    LEFT JOIN industry i ON i.id = ci.id_industry
    WHERE c.name ILIKE $1
    GROUP BY c.company_id
    ORDER BY c.company_id DESC
    `,
    [keyword]
  );

  return result.rows;
};

const getCompanyByRecruiterUserId = async (userId) => {
  if (!userId) return null;

  const result = await pool.query(
    `
    ${COMPANY_FIELDS}
    FROM recruiter r
    INNER JOIN company c ON c.company_id = r.company_id
    LEFT JOIN company_industry ci ON ci.id_company = c.company_id
    LEFT JOIN industry i ON i.id = ci.id_industry
    WHERE r.user_id = $1
    GROUP BY c.company_id
    `,
    [userId]
  );

  return result.rows[0] || null;
};

module.exports = {
  getAllCompanies,
  getCompanyById,
  getCompaniesByExactName,
  getCompaniesByName,
  getCompanyByRecruiterUserId,
};
