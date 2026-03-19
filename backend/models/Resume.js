/*

//models/Resume.js
import mongoose from "mongoose";
const resumeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    personal: {
      fullName: String,
      email: String,
      phone: String,
      objective: String,
      linkedIn: String,
      github: String,
      photo: String,
    },
    jobDescription: String,
    skills: [String],
    projects: [
      {
        title: String,
        description: String,
      },
    ],
    education: [
      {
        degree: String,
        institution: String,
        year: String,
      },
    ],
    experience: [
      {
        role: String,
        company: String,
        duration: String,
        details: String,
      },
    ],
    internships: [
      {
        company: String,
        role: String,
        duration: String,
        details: String,
      },
    ],
    certifications: [String],
    languages: [String],
    optimizedData: {
      objective: String,
      skills: { type: [String], default: [] },
      updatedAt: Date,
    },
    analysis: {
      atsScore: Number,
      skillGaps: { type: [String], default: [] },
      recommendations: String,
      interviewQuestions: { type: [String], default: [] },
      updatedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Resume = mongoose.models.Resume || mongoose.model("Resume", resumeSchema);
export default Resume;
*/
//********************************************************************************* */

import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },

    personal: {
      fullName: String,
      email: String,
      phone: String,
      objective: String,
      linkedIn: String,
      github: String,
      photo: String,
    },

    jobDescription: String,

    // OLD skills kept for safety (ATS analysis uses this)
    skills: [String],

    // NEW separated skills
    technicalSkills: {
      type: [String],
      default: [],
    },

    softSkills: {
      type: [String],
      default: [],
    },

    // NEW fields
    areasOfInterest: {
      type: [String],
      default: [],
    },

    achievements: {
      type: [String],
      default: [],
    },

    cellsAndClubs: {
      type: [String],
      default: [],
    },

    extracurricularActivities: {
      type: [String],
      default: [],
    },

    projects: [
      {
        title: String,
        description: String,
      },
    ],

    education: [
      {
        degree: String,
        institution: String,
        year: String,
      },
    ],

    experience: [
      {
        role: String,
        company: String,
        duration: String,
        details: String,
      },
    ],

    internships: [
      {
        company: String,
        role: String,
        duration: String,
        details: String,
      },
    ],

    certifications: [String],

    languages: [String],

    optimizedData: {
      objective: String,
      skills: { type: [String], default: [] },
      updatedAt: Date,
    },

    analysis: {
      atsScore: Number,
      skillGaps: { type: [String], default: [] },
      recommendations: String,
      interviewQuestions: { type: [String], default: [] },
      updatedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Resume =
  mongoose.models.Resume || mongoose.model("Resume", resumeSchema);

export default Resume;
