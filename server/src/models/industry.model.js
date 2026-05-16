const pool = require("../config/db");

const getAllIndustries = async () => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      description
    FROM industry
    ORDER BY id ASC
    `
  );

  return result.rows;
};

module.exports = {
  getAllIndustries,
};
