import dotenv from "dotenv";
import OpenAI from "openai";
import {
  estimatePromptTokens,
  queueOpenAIRequest,
} from "../utils/openaiRateLimiter.js";
import { safeOpenAICall } from "../utils/openaiClient.js";


dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const optimizeResume = async (resumeData) => {
  try {
    const { 
      personal = {}, 
      skills = [], 
      jobDescription = "",
      educations = [],
      experience = [],
      projects = [],
      internships = [],
      certifications = []
    } = resumeData;

    const schema = `
You are an expert resume optimizer and ATS analyzer. Your task is to:

1. Optimize ONLY the objective/summary to better align with the job description. Do NOT modify any other fields.
2. Analyze the resume data to calculate ATS score, identify skill gaps, and provide recommendations.
3. Generate interview questions based on the resume and job description.

IMPORTANT: Only optimize the objective field. All other fields (skills, education, experience, projects, internships, certifications) should be used for analysis only, NOT modified.

Return strictly valid JSON with this schema:
{
  "optimizedObjective": "string - optimized objective only",
  "skillGap": {
    "missingSkills": ["Skill 1", "Skill 2"],
    "recommendations": "string - actionable recommendations"
  },
  "atsScore": 72,
  "interviewQuestions": ["question 1", "... up to 20"]
}

RESUME DATA:
Objective: ${personal.objective || ""}
Skills: ${(skills || []).join(", ")}
Education: ${JSON.stringify(educations || [])}
Experience: ${JSON.stringify(experience || [])}
Projects: ${JSON.stringify(projects || [])}
Internships: ${JSON.stringify(internships || [])}
Certifications: ${JSON.stringify(certifications || [])}

JOB DESCRIPTION:
${jobDescription || ""}
`;

    const tokenEstimate = estimatePromptTokens(schema, 600);

    const response = await queueOpenAIRequest(
      () =>
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a precise and pragmatic resume optimisation assistant. Never fabricate information.",
            },
            { role: "user", content: schema },
          ],
          temperature: 0.4,
        }),
      tokenEstimate
    );


    let aiText = response.choices?.[0]?.message?.content?.trim() || "";
    aiText = aiText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch (err) {
      console.error("⚠️ Failed to parse AI response as JSON:", aiText);
      throw err;
    }

    return {
      optimizedObjective: parsed.optimizedObjective || "",
      skillGap: {
        missingSkills: Array.isArray(parsed.skillGap?.missingSkills)
          ? parsed.skillGap.missingSkills
          : [],
        recommendations:
          parsed.skillGap?.recommendations ||
          "No specific recommendations were provided.",
      },
      atsScore:
        typeof parsed.atsScore === "number"
          ? Math.min(Math.max(Math.round(parsed.atsScore), 0), 100)
          : null,
      interviewQuestions: Array.isArray(parsed.interviewQuestions)
        ? parsed.interviewQuestions.slice(0, 20)
        : [],
    };
  } catch (error) {
    console.error("❌ Error optimising resume:", error);
    return {
      optimizedObjective: "",
      skillGap: {
        missingSkills: [],
        recommendations: "Unable to generate recommendations due to an error.",
      },
      atsScore: null,
      interviewQuestions: [],
    };
  }
};

