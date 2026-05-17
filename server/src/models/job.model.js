const pool = require("../config/db");

const getAllJobTypes = async () => {
  const result = await pool.query(
    `
    SELECT
      id,
      name
    FROM job_type
    ORDER BY id ASC
    `
  );

  return result.rows;
};

const createJob = async ({
  name,
  description,
  careerId,
  companyId,
  recruiterId,
  salaryMin,
  salaryMax,
  status,
  expire,
  location,
  levelId,
  jobTypeId,
  candidateNumber,
  expMin,
  expMax,
  jobBenefit,
  jobRequirement,
}) => {
  const result = await pool.query(
    `
    INSERT INTO jobs (
      name,
      description,
      career_id,
      company_id,
      recruiter_id,
      salary_min,
      salary_max,
      status,
      expire,
      location,
      id_level,
      job_type_id,
      candidate_number,
      exp_min,
      exp_max,
      job_benefit,
      job_requirement
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17
    )
    RETURNING *
    `,
    [
      name,
      description,
      careerId,
      companyId,
      recruiterId,
      salaryMin,
      salaryMax,
      status,
      expire,
      location,
      levelId,
      jobTypeId,
      candidateNumber,
      expMin,
      expMax,
      jobBenefit,
      jobRequirement,
    ]
  );

  return result.rows[0];
};

module.exports = {
  createJob,
  getAllJobTypes,
};
