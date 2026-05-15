const createCandidateProfile = async (client, { userId, fullName }) => {
  const result = await client.query(
    `INSERT INTO candidate_profile (user_id, full_name)
     VALUES ($1, $2)
     RETURNING id, user_id, full_name`,
    [userId, fullName]
  );

  return result.rows[0];
};

module.exports = {
  createCandidateProfile,
};
