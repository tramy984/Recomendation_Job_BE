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
