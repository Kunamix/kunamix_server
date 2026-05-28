import { asyncHandler } from "@/utils/async-handler.util";
import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import admin from "firebase-admin";
import { ApiError } from "@/utils/api-error.util";
import { ApiResponse } from "@/utils/api-response.util";
import dotenv from "dotenv";
import { Resend } from "resend";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ─── Types ────────────────────────────────────────────────────────────────────

interface CostTier {
  freelancer: string; // e.g. "$800 - $1,200"
  agency: string; // e.g. "$2,000 - $3,500"
}

interface BreakdownItem {
  category: string;
  description: string;
  cost: CostTier;
}

interface GeminiEstimate {
  // Overall ranges
  totalCost: {
    freelancer: { min: number; max: number };
    agency: { min: number; max: number };
  };
  currency: string;

  // Phase breakdown with dual tiers
  breakdown: BreakdownItem[];

  // Ongoing costs
  maintenanceCost: {
    monthly: CostTier;
    annually: CostTier;
    notes: string;
  };

  // Hosting / infra
  deploymentCost: {
    monthly: string;
    annually: string;
    notes: string;
  };

  // Timeline
  timeline: {
    optimistic: string;
    realistic: string;
    notes: string;
  };

  techStack: string[];
  riskFactors: string[];
  summary: string;
}

interface CalculateBody {
  name: string;
  email: string;
  platforms: string[];
  description: string;
  timeline: string;
  userScale: string;
  notes?: string;
}

// ─── Gemini Estimator ─────────────────────────────────────────────────────────

const getGeminiEstimate = async (
  data: Omit<CalculateBody, "name" | "email">,
): Promise<GeminiEstimate> => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
You are a senior software project estimator at a professional development agency.
Analyze the following project and return a cost + timeline estimate with TWO pricing tiers:
  - "freelancer": solo developer or small team on Upwork/Fiverr, lower cost, higher risk
  - "agency": professional digital agency with project management, QA, and support

PROJECT DETAILS:
- Platforms: ${data.platforms.join(", ")}
- Description: ${data.description}
- Desired Timeline: ${data.timeline}
- Expected User Scale: ${data.userScale}
${data.notes ? `- Additional Notes: ${data.notes}` : ""}

Respond ONLY with a valid JSON object (no markdown, no backticks, no preamble):
{
  "totalCost": {
    "freelancer": { "min": <number USD>, "max": <number USD> },
    "agency":     { "min": <number USD>, "max": <number USD> }
  },
  "currency": "USD",
  "breakdown": [
    {
      "category": "<phase name, e.g. UI/UX Design>",
      "description": "<1 sentence of what this covers>",
      "cost": {
        "freelancer": "<e.g. $300 - $600>",
        "agency":     "<e.g. $1,200 - $2,000>"
      }
    }
  ],
  "maintenanceCost": {
    "monthly": {
      "freelancer": "<e.g. $200 - $400/mo>",
      "agency":     "<e.g. $600 - $1,200/mo>"
    },
    "annually": {
      "freelancer": "<e.g. $2,400 - $4,800/yr>",
      "agency":     "<e.g. $7,200 - $14,400/yr>"
    },
    "notes": "<what maintenance covers: bug fixes, updates, monitoring>"
  },
  "deploymentCost": {
    "monthly":  "<e.g. $30 - $100/mo>",
    "annually": "<e.g. $360 - $1,200/yr>",
    "notes":    "<e.g. Vercel + Railway or AWS depending on scale>"
  },
  "timeline": {
    "optimistic": "<e.g. 6 weeks>",
    "realistic":  "<e.g. 10 weeks>",
    "notes":      "<what affects the timeline>"
  },
  "techStack":    ["<tech 1>", "<tech 2>"],
  "riskFactors":  ["<risk 1>", "<risk 2>"],
  "summary": "<2-3 sentence plain-English summary explaining the range and what drives cost>"
}

Rules:
- breakdown must have 5-7 items covering: Design, Frontend, Backend, Database, Auth/Security, Testing & QA, Deployment
- Be realistic — not overly conservative or inflated
- Agency costs should be 2.5x–4x freelancer costs on average
- techStack must be specific (e.g. "React + TypeScript", "Node.js + Express", "PostgreSQL")
- riskFactors: 3-4 honest items
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed: GeminiEstimate = JSON.parse(clean);
  return parsed;
};

// ─── PDF Generator ────────────────────────────────────────────────────────────

const generateEstimatePDF = (
  data: CalculateBody,
  estimate: GeminiEstimate,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers: Buffer[] = [];

    doc.on("data", (b: Buffer) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // ── Palette ──
    const orange = "#D95A15";
    const dark = "#18181b";
    const gray = "#52525b";
    const lightBg = "#f9f9f9";
    const borderColor = "#e4e4e7";

    const PAGE_W = 595 - 100; // A4 minus margins (50 each side)

    // ── Helper: section title ──
    const sectionTitle = (title: string) => {
      doc.moveDown(0.8);
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor(dark)
        .text(title.toUpperCase(), { characterSpacing: 0.8 });
      doc
        .moveTo(50, doc.y + 3)
        .lineTo(545, doc.y + 3)
        .strokeColor(orange)
        .lineWidth(1.5)
        .stroke();
      doc.moveDown(0.6);
    };

    // ─── HEADER ───────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor(orange)
      .text("Kunamix Digital Solutions", { align: "center" });
    doc
      .fontSize(13)
      .font("Helvetica")
      .fillColor(dark)
      .text("Project Estimate Report", { align: "center" });
    doc
      .fontSize(9)
      .fillColor(gray)
      .text(
        `Generated on ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`,
        { align: "center" },
      );

    doc.moveDown(1);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor(borderColor)
      .lineWidth(1)
      .stroke();

    // ─── CLIENT INFO ──────────────────────────────────────────────────────────
    doc.moveDown(0.8);
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(dark)
      .text("Prepared for:");
    doc
      .font("Helvetica")
      .fillColor(gray)
      .fontSize(10)
      .text(`${data.name}  ·  ${data.email}`);

    doc.moveDown(0.6);
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(dark)
      .text("Project Summary:");
    doc.font("Helvetica").fillColor(gray).fontSize(9);
    doc.text(`Platforms:   ${data.platforms.join(", ")}`);
    doc.text(`Timeline:    ${data.timeline}`);
    doc.text(`User Scale:  ${data.userScale}`);
    doc.moveDown(0.4);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(dark)
      .text(data.description, { width: PAGE_W, align: "justify" });

    if (data.notes) {
      doc.moveDown(0.4);
      doc
        .font("Helvetica-Bold")
        .fillColor(dark)
        .text("Notes: ", { continued: true });
      doc.font("Helvetica").fillColor(gray).text(data.notes, { width: PAGE_W });
    }

    // ─── AI SUMMARY ───────────────────────────────────────────────────────────
    sectionTitle("Estimate Summary");
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(gray)
      .text(estimate.summary, { width: PAGE_W, align: "justify" });

    // ─── TOTAL COST COMPARISON BOX ────────────────────────────────────────────
    doc.moveDown(1);
    const boxY = doc.y;
    const halfW = PAGE_W / 2 - 6;

    // Freelancer box
    doc.rect(50, boxY, halfW, 70).fillAndStroke("#fff8f5", orange);
    doc
      .fillColor(gray)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("FREELANCER RANGE", 62, boxY + 8, { characterSpacing: 0.5 });
    doc
      .fillColor(orange)
      .fontSize(16)
      .text(
        `$${estimate.totalCost.freelancer.min.toLocaleString()} – $${estimate.totalCost.freelancer.max.toLocaleString()}`,
        62,
        boxY + 24,
      );
    doc
      .fillColor(gray)
      .fontSize(8)
      .font("Helvetica")
      .text("Solo dev / small team", 62, boxY + 50);

    // Agency box
    const box2X = 50 + halfW + 12;
    doc.rect(box2X, boxY, halfW, 70).fillAndStroke("#fff8f5", orange);
    doc
      .fillColor(gray)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("AGENCY RANGE", box2X + 12, boxY + 8, { characterSpacing: 0.5 });
    doc
      .fillColor(orange)
      .fontSize(16)
      .text(
        `$${estimate.totalCost.agency.min.toLocaleString()} – $${estimate.totalCost.agency.max.toLocaleString()}`,
        box2X + 12,
        boxY + 24,
      );
    doc
      .fillColor(gray)
      .fontSize(8)
      .font("Helvetica")
      .text("Professional agency w/ PM & QA", box2X + 12, boxY + 50);

    doc.moveDown(5);

    // ─── COST BREAKDOWN TABLE ─────────────────────────────────────────────────
    sectionTitle("Cost Breakdown by Phase");

    // Table header
    const colCat = 50;
    const colDesc = 175;
    const colFree = 360;
    const colAgency = 460;
    const headerY = doc.y;

    doc.rect(50, headerY, PAGE_W, 18).fill("#18181b");
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("PHASE", colCat + 4, headerY + 5);
    doc.text("DESCRIPTION", colDesc + 4, headerY + 5);
    doc.text("FREELANCER", colFree, headerY + 5);
    doc.text("AGENCY", colAgency, headerY + 5);
    doc.moveDown(1.4);

    estimate.breakdown.forEach((item, i) => {
      const rowY = doc.y;
      const rowH = 32;
      if (i % 2 === 0) doc.rect(50, rowY, PAGE_W, rowH).fill(lightBg);

      doc
        .fillColor(dark)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(item.category, colCat + 4, rowY + 4, { width: 118 });
      doc
        .font("Helvetica")
        .fillColor(gray)
        .fontSize(7.5)
        .text(item.description, colDesc + 4, rowY + 4, { width: 178 });
      doc
        .font("Helvetica-Bold")
        .fillColor("#16a34a")
        .fontSize(8)
        .text(item.cost.freelancer, colFree, rowY + 4, { width: 95 });
      doc
        .fillColor(orange)
        .text(item.cost.agency, colAgency, rowY + 4, { width: 95 });
      doc.moveDown(2.1);
    });

    // ─── MAINTENANCE COSTS ────────────────────────────────────────────────────
    sectionTitle("Maintenance & Support Costs");

    const mBoxY = doc.y;
    doc.rect(50, mBoxY, PAGE_W, 56).fill(lightBg);

    doc
      .fillColor(dark)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("Monthly", colCat + 4, mBoxY + 6);
    doc
      .fillColor("#16a34a")
      .font("Helvetica")
      .fontSize(8)
      .text(
        `Freelancer: ${estimate.maintenanceCost.monthly.freelancer}`,
        colCat + 4,
        mBoxY + 18,
      );
    doc
      .fillColor(orange)
      .text(
        `Agency: ${estimate.maintenanceCost.monthly.agency}`,
        colCat + 4,
        mBoxY + 30,
      );

    doc
      .fillColor(dark)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("Annually", colFree, mBoxY + 6);
    doc
      .fillColor("#16a34a")
      .font("Helvetica")
      .fontSize(8)
      .text(
        `Freelancer: ${estimate.maintenanceCost.annually.freelancer}`,
        colFree,
        mBoxY + 18,
      );
    doc
      .fillColor(orange)
      .text(
        `Agency: ${estimate.maintenanceCost.annually.agency}`,
        colFree,
        mBoxY + 30,
      );

    doc
      .fillColor(gray)
      .font("Helvetica")
      .fontSize(7.5)
      .text(estimate.maintenanceCost.notes, colCat + 4, mBoxY + 44, {
        width: PAGE_W - 8,
      });

    doc.moveDown(4.5);

    // ─── DEPLOYMENT COSTS ─────────────────────────────────────────────────────
    sectionTitle("Deployment & Hosting");
    doc.fontSize(9).font("Helvetica").fillColor(gray);
    doc.text(`Monthly:   ${estimate.deploymentCost.monthly}`);
    doc.text(`Annually:  ${estimate.deploymentCost.annually}`);
    doc.moveDown(0.3);
    doc.text(estimate.deploymentCost.notes, { width: PAGE_W });

    // ─── TIMELINE ─────────────────────────────────────────────────────────────
    sectionTitle("Estimated Timeline");
    doc.fontSize(9).font("Helvetica").fillColor(gray);
    doc.text(`Optimistic:  ${estimate.timeline.optimistic}`);
    doc.text(`Realistic:   ${estimate.timeline.realistic}`);
    doc.moveDown(0.3);
    doc.text(estimate.timeline.notes, { width: PAGE_W });

    // ─── TECH STACK ───────────────────────────────────────────────────────────
    sectionTitle("Recommended Tech Stack");
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(gray)
      .text(estimate.techStack.join("  ·  "), { width: PAGE_W });

    // ─── RISK FACTORS ─────────────────────────────────────────────────────────
    sectionTitle("Risk Factors");
    estimate.riskFactors.forEach((risk) => {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(gray)
        .text(`• ${risk}`, { width: PAGE_W - 10 });
      doc.moveDown(0.2);
    });

    // ─── FOOTER ───────────────────────────────────────────────────────────────
    doc.moveDown(1.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor(borderColor)
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.6);
    doc
      .fontSize(8)
      .fillColor(gray)
      .font("Helvetica")
      .text(
        "This estimate is AI-assisted and based on the information provided. Final pricing is confirmed after a detailed scoping call.",
        { width: PAGE_W, align: "center" },
      );
    doc.moveDown(0.3);
    doc
      .fillColor(orange)
      .text("kunamix.com  ·  contact@kunamix.com", { align: "center" });

    doc.end();
  });
};

// ─── Controller ───────────────────────────────────────────────────────────────

export const calculate = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, platforms, description, timeline, userScale, notes } =
    req.body as CalculateBody;

  // Validate required fields
  if (
    !name ||
    !email ||
    !platforms ||
    !description ||
    !timeline ||
    !userScale
  ) {
    throw new ApiError(400, "Missing required fields for calculator");
  }

  // Normalize platforms — accept both string and array from frontend
  const normalizedPlatforms: string[] = Array.isArray(platforms)
    ? platforms
    : [platforms];

  if (normalizedPlatforms.length === 0) {
    throw new ApiError(400, "At least one platform must be selected");
  }

  try {
    // 1. Get AI-powered estimate from Gemini
    const estimate = await getGeminiEstimate({
      platforms: normalizedPlatforms,
      description,
      timeline,
      userScale,
      notes,
    });

    // 2. Save to Firestore
    const db = admin.firestore();
    await db.collection("estimates").add({
      name,
      email,
      platforms: normalizedPlatforms,
      description,
      timeline,
      userScale,
      notes: notes ?? null,
      freelancerCostMin: estimate.totalCost.freelancer.min,
      freelancerCostMax: estimate.totalCost.freelancer.max,
      agencyCostMin: estimate.totalCost.agency.min,
      agencyCostMax: estimate.totalCost.agency.max,
      currency: estimate.currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Generate PDF
    const pdfBuffer = await generateEstimatePDF(
      {
        name,
        email,
        platforms: normalizedPlatforms,
        description,
        timeline,
        userScale,
        notes,
      },
      estimate,
    );

    // Resend requires base64 string for attachments
    const pdfBase64 = pdfBuffer.toString("base64");
    const safeFileName = `Kunamix_Estimate_${name.replace(/\s+/g, "_")}.pdf`;

    // 4. Send PDF to client
    const { error: userMailError } = await resend.emails.send({
      from: "Kunamix <no-reply@kunamix.com>",
      to: [email],
      subject: `Your Project Estimate – Kunamix Digital Solutions`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; max-width: 580px; margin: auto; color: #18181b;">
          <h2 style="margin: 0 0 8px; font-size: 22px; color: #18181b;">Hi ${name.split(" ")[0]},</h2>
          <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px;">
            Your project estimate is ready. Here's a summary of what it would cost to build your product:
          </p>

          <!-- Cost comparison table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="background: #f4f4f5; border: 1px solid #e4e4e7; padding: 16px 20px; border-radius: 8px 0 0 8px; width: 50%;">
                <p style="margin: 0; font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Freelancer Range</p>
                <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #16a34a;">
                  $${estimate.totalCost.freelancer.min.toLocaleString()} – $${estimate.totalCost.freelancer.max.toLocaleString()}
                </p>
                <p style="margin: 4px 0 0; font-size: 11px; color: #71717a;">Solo dev / small team</p>
              </td>
              <td style="background: #fff8f5; border: 1px solid #D95A15; padding: 16px 20px; border-radius: 0 8px 8px 0; width: 50%;">
                <p style="margin: 0; font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Agency Range</p>
                <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #D95A15;">
                  $${estimate.totalCost.agency.min.toLocaleString()} – $${estimate.totalCost.agency.max.toLocaleString()}
                </p>
                <p style="margin: 4px 0 0; font-size: 11px; color: #71717a;">Professional agency w/ PM & QA</p>
              </td>
            </tr>
          </table>

          <p style="color: #52525b; line-height: 1.6; margin: 0 0 8px;">${estimate.summary}</p>

          <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
            The full breakdown — cost per phase (freelancer vs agency), maintenance costs, 
            deployment costs, recommended tech stack, and timeline — is attached as a PDF.
          </p>

          <p style="color: #52525b; line-height: 1.6; margin: 0 0 24px;">
            Ready to move forward? Just reply to this email and we'll schedule a free 30-minute scoping call.
          </p>

          <p style="margin: 0; color: #18181b; font-weight: 600;">
            Best regards,<br/>
            <span style="color: #D95A15;">The Kunamix Team</span>
          </p>
          <hr style="margin: 32px 0 16px; border: none; border-top: 1px solid #e4e4e7;" />
          <p style="font-size: 12px; color: #a1a1aa; margin: 0;">
            🌐 <a href="https://kunamix.com" style="color: #D95A15; text-decoration: none;">kunamix.com</a>
            &nbsp;·&nbsp; This estimate is AI-assisted. Final pricing confirmed after a scoping call.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: safeFileName,
          content: pdfBase64,
        },
      ],
    });

    if (userMailError) {
      console.error("Resend user mail error:", userMailError);
      throw new ApiError(500, "Failed to send estimate email to user");
    }

    // 5. Internal team notification
    await resend.emails.send({
      from: "calculator@kunamix.com",
      to: ["contact@kunamix.com"],
      subject: `New Lead: ${name} — $${estimate.totalCost.freelancer.min.toLocaleString()}–$${estimate.totalCost.agency.max.toLocaleString()} USD`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; max-width: 560px;">
          <h2 style="margin: 0 0 16px;">New Estimate Lead</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Platforms:</strong> ${normalizedPlatforms.join(", ")}</p>
          <p><strong>Timeline:</strong> ${timeline}</p>
          <p><strong>User Scale:</strong> ${userScale}</p>
          <p><strong>Freelancer Range:</strong> $${estimate.totalCost.freelancer.min.toLocaleString()} – $${estimate.totalCost.freelancer.max.toLocaleString()} USD</p>
          <p><strong>Agency Range:</strong> $${estimate.totalCost.agency.min.toLocaleString()} – $${estimate.totalCost.agency.max.toLocaleString()} USD</p>
          <p><strong>Description:</strong> ${description}</p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
          <hr/>
          <p style="font-size: 12px; color: #999;">Full PDF attached.</p>
        </div>
      `,
      attachments: [
        {
          filename: `Copy_${safeFileName}`,
          content: pdfBase64,
        },
      ],
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "Estimate generated, saved, and sent successfully",
        ),
      );
  } catch (err) {
    console.error("Server error in calculate:", err);
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      500,
      "Something went wrong while processing the estimate",
    );
  }
});
