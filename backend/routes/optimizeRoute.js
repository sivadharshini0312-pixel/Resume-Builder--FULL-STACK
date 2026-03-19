import dotenv from "dotenv";
dotenv.config();

import express from "express";
import Resume from "../models/Resume.js";
import { optimizeResume } from "../controllers/aiController.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      email,
      personal = {},
      jobDescription = "",
      skills = [],
      educations = [],
      experience = [],
      projects = [],
      internships = [],
      certifications = [],
    } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required for optimisation." });
    }

    const existingResume = await Resume.findOne({ email });

    const currentPersonal = existingResume?.personal || {};
    const currentSkills = existingResume?.skills || [];
    const currentJobDescription = existingResume?.jobDescription || "";
    const currentEducations = existingResume?.education || [];
    const currentExperience = existingResume?.experience || [];
    const currentProjects = existingResume?.projects || [];
    const currentInternships = existingResume?.internships || [];
    const currentCertifications = existingResume?.certifications || [];

    const objectiveInput =
      typeof personal.objective === "string"
        ? personal.objective
        : currentPersonal.objective || "";

    const skillsInput =
      Array.isArray(skills) && skills.length > 0 ? skills : currentSkills;

    const jobDescriptionInput = jobDescription || currentJobDescription || "";
    const educationsInput = Array.isArray(educations) && educations.length > 0 ? educations : currentEducations;
    const experienceInput = Array.isArray(experience) && experience.length > 0 ? experience : currentExperience;
    const projectsInput = Array.isArray(projects) && projects.length > 0 ? projects : currentProjects;
    const internshipsInput = Array.isArray(internships) && internships.length > 0 ? internships : currentInternships;
    const certificationsInput = Array.isArray(certifications) && certifications.length > 0 ? certifications : currentCertifications;

    const optimizationPayload = {
      personal: {
        objective: objectiveInput,
      },
      jobDescription: jobDescriptionInput,
      skills: skillsInput,
      educations: educationsInput,
      experience: experienceInput,
      projects: projectsInput,
      internships: internshipsInput,
      certifications: certificationsInput,
    };

    const optimisationResult = await optimizeResume(optimizationPayload);

    const optimizedObjective =
      optimisationResult.optimizedObjective?.trim() || objectiveInput || "";

    const updatedPersonal = {
      ...currentPersonal,
      objective: optimizedObjective,
    };

    const updateSet = {
      personal: updatedPersonal,
      jobDescription: jobDescriptionInput,
      skills: skillsInput,
      education: educationsInput,
      experience: experienceInput,
      projects: projectsInput,
      internships: internshipsInput,
      certifications: certificationsInput,
      optimizedData: {
        objective: optimizedObjective,
        updatedAt: new Date(),
      },
      analysis: {
        atsScore: optimisationResult.atsScore,
        skillGaps: optimisationResult.skillGap?.missingSkills || [],
        recommendations: optimisationResult.skillGap?.recommendations || "",
        interviewQuestions: optimisationResult.interviewQuestions || [],
        updatedAt: new Date(),
      },
    };

    const updatedResume = await Resume.findOneAndUpdate(
      { email },
      {
        $set: updateSet,
        $setOnInsert: { email },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: "Resume optimized successfully",
      optimization: {
        objective: updateSet.optimizedData.objective,
        atsScore: updateSet.analysis.atsScore,
        skillGaps: updateSet.analysis.skillGaps,
        recommendations: updateSet.analysis.recommendations,
        interviewQuestions: updateSet.analysis.interviewQuestions,
      },
      resume: updatedResume,
    });
  } catch (err) {
    console.error("AI optimisation error:", err);
    res.status(500).json({ message: "Error optimizing resume" });
  }
});

export default router;
