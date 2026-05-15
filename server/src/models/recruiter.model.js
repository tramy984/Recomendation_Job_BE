const createRecruiterProfile = async (client, { userId, fullName }) => {
  const result = await client.query(
    `INSERT INTO recruiter (user_id, name)
     VALUES ($1, $2)
     RETURNING id, user_id, name`,
    [userId, fullName]
  );

  return result.rows[0];
};

module.exports = {
  createRecruiterProfile,
};
