// src/services/matchingScore.js

const DEGREE_RANK = {
  degree_trung_cap: 1,
  degree_cao_dang: 2,
  degree_dai_hoc: 3,
  degree_cu_nhan: 3,
  degree_thac_si: 4,
  degree_tien_si: 5,
};

function normalizeSkillList(skills = []) {
  if (!Array.isArray(skills)) return [];

  return [
    ...new Set(
      skills
        .map((s) =>
          String(s || "")
            .toLowerCase()
            .trim(),
        )
        .filter(Boolean)
        .filter((s) => !s.startsWith("degree_"))
        .filter((s) => !s.endsWith("_years_exp")),
    ),
  ];
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function calculateSkillScore(cvSkills = [], jobSkills = []) {
  const cleanCvSkills = normalizeSkillList(cvSkills);
  const cleanJobSkills = normalizeSkillList(jobSkills);

  if (cleanJobSkills.length === 0) {
    return {
      skillScore: 0,
      matchedSkills: [],
      matchCount: 0,
      totalJobSkills: 0,
      cleanCvSkills,
      cleanJobSkills,
    };
  }

  const cvSet = new Set(cleanCvSkills);
  const matchedSkills = cleanJobSkills.filter((skill) => cvSet.has(skill));

  const skillScore = matchedSkills.length / cleanJobSkills.length;

  return {
    skillScore: Number(skillScore.toFixed(4)),
    matchedSkills,
    matchCount: matchedSkills.length,
    totalJobSkills: cleanJobSkills.length,
    cleanCvSkills,
    cleanJobSkills,
  };
}

function calculateDegreePenalty(cvDegree, jobDegree) {
  const cvRank = DEGREE_RANK[String(cvDegree || "").trim()] || 0;
  const jobRank = DEGREE_RANK[String(jobDegree || "").trim()] || 0;

  if (jobRank === 0) return 0; // job không yêu cầu bằng cấp
  if (cvRank === 0) return 0.15; // CV không có bằng cấp

  const gap = jobRank - cvRank;

  if (gap <= 0) return 0; // CV đạt hoặc cao hơn yêu cầu
  if (gap === 1) return 0.1;
  if (gap === 2) return 0.2;

  return 0.3;
}

function calculateExpPenalty(cvExpMax, jobExpMin, jobExpMax) {
  const cvExp = Number(cvExpMax || 0);
  const min = Number(jobExpMin || 0);
  const max = Number(jobExpMax || min || 0);

  if (min === 0 && max === 0) {
    return {
      penalty: 0,
      gap: 0,
      reason: "job_no_exp_required",
    };
  }

  if (cvExp >= min && cvExp <= max) {
    return {
      penalty: 0,
      gap: 0,
      reason: "exp_in_range",
    };
  }

  let gap = 0;

  if (cvExp < min) {
    gap = min - cvExp;
  } else if (cvExp > max) {
    gap = cvExp - max;
  }

  let penalty = 0;

  if (gap <= 1) penalty = 0.05;
  else if (gap <= 2) penalty = 0.1;
  else if (gap <= 3) penalty = 0.15;
  else penalty = 0.2;

  return {
    penalty,
    gap,
    reason:
      cvExp < min ? "cv_exp_lower_than_job_min" : "cv_exp_higher_than_job_max",
  };
}

function calculateMatchingScore({
  cvSkills = [],
  jobSkills = [],
  cvDegree = null,
  jobDegree = null,
  cvExpMax = 0,
  jobExpMin = 0,
  jobExpMax = 0,
}) {
  const skillResult = calculateSkillScore(cvSkills, jobSkills);

  const degreePenalty = calculateDegreePenalty(cvDegree, jobDegree);

  const expPenaltyResult = calculateExpPenalty(cvExpMax, jobExpMin, jobExpMax);

  const finalScore = clamp(
    skillResult.skillScore - degreePenalty - expPenaltyResult.penalty,
  );

  return {
    score: Number(finalScore.toFixed(4)),
    percent: Number((finalScore * 100).toFixed(2)),

    skillScore: skillResult.skillScore,

    degreePenalty,
    expPenalty: expPenaltyResult.penalty,
    totalPenalty: Number((degreePenalty + expPenaltyResult.penalty).toFixed(4)),

    expGap: expPenaltyResult.gap,
    expReason: expPenaltyResult.reason,

    matchedSkills: skillResult.matchedSkills,
    matchCount: skillResult.matchCount,
    totalJobSkills: skillResult.totalJobSkills,

    cvSkills: skillResult.cleanCvSkills,
    jobSkills: skillResult.cleanJobSkills,

    detail: {
      cvDegree,
      jobDegree,
      cvExpMax,
      jobExpMin,
      jobExpMax,
    },
  };
}

module.exports = {
  calculateMatchingScore,
};
