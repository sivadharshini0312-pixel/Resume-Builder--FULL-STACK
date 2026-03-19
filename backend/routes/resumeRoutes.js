/*
import express from "express";
import Resume from "../models/Resume.js";

const router = express.Router();

// Save or update resume
router.post("/generate", async (req, res) => {
  try {
    const {
      email,
      personal = {},
      jobDescription = "",
      skills = [],
      projects = [],
      education = [],
      experience = [],
      internships = [],
      certifications = [],
      languages = [],
    } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const existing = await Resume.findOne({ email });

    const optimizedObjective =
      personal.objective ||
      existing?.optimizedData?.objective ||
      "";

    const update = {
      personal: {
        ...personal,
        objective: optimizedObjective,
      },
      jobDescription,
      skills,
      projects,
      education,
      experience,
      internships,
      certifications,
      languages,
      optimizedData: {
        objective: optimizedObjective,
        updatedAt: new Date(),
      },
      ...(existing?.analysis && { analysis: existing.analysis }),
    };

    const saved = await Resume.findOneAndUpdate(
      { email },
      { $set: update, $setOnInsert: { email } },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Resume saved", resume: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get latest resume by email
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const results = await Resume.find({ email })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(1);

    if (!results.length) {
      return res.status(404).json({ message: "Resume not found" });
    }

    res.status(200).json({ resume: results[0] });
  } catch (err) {
    console.error("Error fetching resume:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
*/

import express from "express";
import Resume from "../models/Resume.js";

const router = express.Router();

/* -------------------- SAVE / UPDATE RESUME -------------------- */
router.post("/generate", async (req, res) => {
  try {
    const {
      email,

      personal = {},
      jobDescription = "",
      skills = [],

      technicalSkills = [],
      softSkills = [],

      areasOfInterest = [],
      achievements = [],
      cellsAndClubs = [],
      extracurricularActivities = [],

      projects = [],
      education = [],
      experience = [],
      internships = [],
      certifications = [],
      languages = [],
    } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const existing = await Resume.findOne({ email });

    const optimizedObjective =
      personal.objective ||
      existing?.optimizedData?.objective ||
      "";

    const update = {
      email,
      personal: {
        ...personal,
        objective: optimizedObjective,
      },

      jobDescription,
      skills: skills || existing?.skills || [],

      technicalSkills: technicalSkills || existing?.technicalSkills || [],
      softSkills: softSkills || existing?.softSkills || [],

      areasOfInterest: areasOfInterest || existing?.areasOfInterest || [],
      achievements: achievements || existing?.achievements || [],
      cellsAndClubs: cellsAndClubs || existing?.cellsAndClubs || [],
      extracurricularActivities:
        extracurricularActivities ||
        existing?.extracurricularActivities ||
        [],

      projects: projects || existing?.projects || [],
      education: education || existing?.education || [],
      experience: experience || existing?.experience || [],
      internships: internships || existing?.internships || [],
      certifications: certifications || existing?.certifications || [],
      languages: languages || existing?.languages || [],

      optimizedData: {
        objective: optimizedObjective,
        skills: existing?.optimizedData?.skills || [],
        updatedAt: new Date(),
      },

      analysis: existing?.analysis || {
        atsScore: 0,
        skillGaps: [],
        recommendations: "",
        interviewQuestions: [],
        updatedAt: new Date(),
      },
    };

    const saved = await Resume.findOneAndUpdate(
      { email },
      { $set: update },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Resume saved", resume: saved });
  } catch (err) {
    console.error("Error in /generate:", err);
    res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});

/* -------------------- GET LATEST RESUME -------------------- */
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const results = await Resume.find({ email })
      .sort({ updatedAt: -1 })
      .limit(1);

    if (!results.length) {
      return res.status(404).json({ message: "Resume not found" });
    }

    res.status(200).json({ resume: results[0] });
  } catch (err) {
    console.error("Error fetching resume:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
