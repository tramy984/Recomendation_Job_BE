const pool = require("../config/db");

const getDashboardSummary = async (year) => {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS total_jobs
    FROM jobs
    WHERE EXTRACT(YEAR FROM created_at)::int = $1
    `,
    [year]
  );

  return result.rows[0] || { total_jobs: 0 };
};

const getJobsByMonth = async (year) => {
  const result = await pool.query(
    `
    WITH months AS (
      SELECT generate_series(1, 12) AS month_number
    )
    SELECT
      CONCAT('T', m.month_number) AS month,
      COALESCE(COUNT(j.id), 0)::int AS jobs
    FROM months m
    LEFT JOIN jobs j
      ON EXTRACT(MONTH FROM j.created_at)::int = m.month_number
      AND EXTRACT(YEAR FROM j.created_at)::int = $1
    GROUP BY m.month_number
    ORDER BY m.month_number ASC
    `,
    [year]
  );

  return result.rows;
};

const getTopIndustries = async (year, limit = 10) => {
  const result = await pool.query(
    `
    SELECT
      i.id,
      i.name,
      COUNT(DISTINCT j.id)::int AS jobs
    FROM jobs j
    INNER JOIN job_industry ji ON ji.job_id = j.id
    INNER JOIN industry i ON i.id = ji.industry_id
    WHERE EXTRACT(YEAR FROM j.created_at)::int = $1
    GROUP BY i.id, i.name
    ORDER BY jobs DESC, i.name ASC
    LIMIT $2
    `,
    [year, limit]
  );

  return result.rows;
};

const getTopLocations = async (year, limit = 5) => {
  const result = await pool.query(
    `
    SELECT
      COALESCE(NULLIF(BTRIM(location), ''), 'Khac') AS name,
      COUNT(*)::int AS jobs
    FROM jobs
    WHERE EXTRACT(YEAR FROM created_at)::int = $1
    GROUP BY COALESCE(NULLIF(BTRIM(location), ''), 'Khac')
    ORDER BY jobs DESC, name ASC
    LIMIT $2
    `,
    [year, limit]
  );

  return result.rows;
};

const getTopCompanies = async (year, limit = 5) => {
  const result = await pool.query(
    `
    SELECT
      c.company_id,
      c.name,
      COUNT(j.id)::int AS jobs
    FROM jobs j
    INNER JOIN company c ON c.company_id = j.company_id
    WHERE EXTRACT(YEAR FROM j.created_at)::int = $1
    GROUP BY c.company_id, c.name
    ORDER BY jobs DESC, c.name ASC
    LIMIT $2
    `,
    [year, limit]
  );

  return result.rows;
};

const getDashboardYears = async () => {
  const result = await pool.query(
    `
    SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year
    FROM jobs
    WHERE created_at IS NOT NULL
    ORDER BY year DESC
    `
  );

  return result.rows.map((row) => row.year);
};

const getAdminDashboard = async (year) => {
  const [
    summary,
    jobsByMonth,
    topIndustries,
    topLocations,
    topCompanies,
    years,
  ] = await Promise.all([
    getDashboardSummary(year),
    getJobsByMonth(year),
    getTopIndustries(year),
    getTopLocations(year),
    getTopCompanies(year),
    getDashboardYears(),
  ]);

  return {
    summary: {
      year,
      totalJobs: summary.total_jobs,
    },
    jobsByMonth,
    topIndustries,
    topLocations,
    topCompanies,
    years,
  };
};

module.exports = {
  getAdminDashboard,
};
