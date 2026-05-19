require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./config/db");
const adminRoutes = require("./routes/admin.routes");
const authRoutes = require("./routes/auth.routes");
const recruiterRoutes = require("./routes/recruiter.routes");
const companyRoutes = require("./routes/company.routes");
const industryRoutes = require("./routes/industry.routes");
const jobRoutes = require("./routes/job.routes");
const levelRoutes = require("./routes/level.routes");
const candidateRoutes = require("./routes/candidate.routes");
const cvRoutes = require("./routes/cv.routes");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.json({
    message: "Backend is running",
  });
});
app.use("/api/cvs", cvRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/recruiters", recruiterRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/industries", industryRoutes);
app.use("/api/levels", levelRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/candidate", candidateRoutes);
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
