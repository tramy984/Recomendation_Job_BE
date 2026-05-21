const pool = require("../config/db");

const getHomepageStats = async () => {
  const [overviewResult, topIndustriesResult] = await Promise.all([
    pool.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM jobs) AS total_jobs,
        (SELECT COUNT(*)::int FROM company) AS total_companies,
        (SELECT COUNT(*)::int FROM recruiter) AS total_recruiters,
        (SELECT COUNT(*)::int FROM candidate_profile) AS total_candidates
      `
    ),
    pool.query(
      `
      SELECT
        i.id,
        i.name,
        COUNT(DISTINCT j.id)::int AS jobs
      FROM jobs j
      INNER JOIN job_industry ji ON ji.job_id = j.id
      INNER JOIN industry i ON i.id = ji.industry_id
      GROUP BY i.id, i.name
      ORDER BY jobs DESC, i.name ASC
      LIMIT 8
      `
    ),
  ]);

  const overview = overviewResult.rows[0] || {
    total_jobs: 0,
    total_companies: 0,
    total_recruiters: 0,
    total_candidates: 0,
  };

  return {
    totalJobs: overview.total_jobs,
    totalCompanies: overview.total_companies,
    totalRecruiters: overview.total_recruiters,
    totalCandidates: overview.total_candidates,
    topIndustries: topIndustriesResult.rows,
  };
};

module.exports = {
  getHomepageStats,
};
