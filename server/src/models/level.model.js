const pool = require("../config/db");

const getAllLevels = async () => {
  const result = await pool.query(
    `
    SELECT
      id,
      name
    FROM level_table
    ORDER BY id ASC
    `
  );

  return result.rows;
};

module.exports = {
  getAllLevels,
};
