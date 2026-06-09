const { extractJobInfo } = require("./extractJobSkill.js");

const result = extractJobInfo(`
    Yêu cầu tốt nghiệp cao đẳng.
    Có kinh nghiệm Python, Django, PostgreSQL, Docker.
    Ưu tiên TOEIC.
    `);

console.log(result);
