import { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import { Resend } from "resend";
import admin from "@/config/firebase";
import { asyncHandler } from "@/utils/async-handler.util";
import { ApiError } from "@/utils/api-error.util";
import { ApiResponse } from "@/utils/api-response.util";

dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

export const contactForm = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { name, email, message, projectType, budget } = req.body;

    if (!name || !email || !message || !projectType || !budget) {
      throw new ApiError(400, "Missing required fields");
    }

    try {
      // 1. Save to Firestore first
      const db = admin.firestore();
      await db.collection("contact_queries").add({
        name,
        email,
        message,
        projectType,
        budget,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2. Send internal notification to Kunamix team
      const internalSubject = `🚀 New Lead: ${projectType} from ${name}`;

      const { error } = await resend.emails.send({
        from: "contact@kunamix.com",
        to: ["contact@kunamix.com"],
        subject: internalSubject,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Lead Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f4f4f5; padding: 30px; margin: 0; }
    .email-container { max-width: 600px; margin: auto; background: #ffffff; padding: 40px; border-radius: 12px; border-top: 6px solid #D95A15; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { font-size: 24px; font-weight: 800; margin-bottom: 25px; color: #09090b; letter-spacing: -0.5px; }
    .grid { background: #fafafa; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #eaeaea; }
    .section { margin-bottom: 16px; }
    .section:last-child { margin-bottom: 0; }
    .label { font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .value { font-size: 16px; color: #18181b; font-weight: 500; }
    .message-box { background: #fff; border-left: 4px solid #D95A15; padding: 16px 20px; color: #3f3f46; font-size: 15px; line-height: 1.6; margin-bottom: 30px; border-radius: 0 8px 8px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .button { display: inline-block; padding: 12px 24px; background: #18181b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">New Project Inquiry</div>
    <div class="grid">
      <div class="section"><div class="label">Client Name</div><div class="value">${name}</div></div>
      <div class="section"><div class="label">Email Address</div><div class="value"><a href="mailto:${email}" style="color: #D95A15; text-decoration: none;">${email}</a></div></div>
      <div class="section"><div class="label">Project Type</div><div class="value">${projectType}</div></div>
      <div class="section"><div class="label">Estimated Budget</div><div class="value">${budget}</div></div>
    </div>
    <div class="label">Message</div>
    <div class="message-box">${message.replace(/\n/g, "<br>")}</div>
    <div>
      <a href="mailto:${email}?subject=Re:%20Your%20inquiry%20to%20Kunamix%20Digital%20Solutions&body=Hi%20${encodeURIComponent(name.split(" ")[0])}," class="button">
        Reply to ${name.split(" ")[0]}
      </a>
    </div>
  </div>
</body>
</html>`,
      });

      if (error) {
        console.error("Resend internal mail error:", error);
        throw new ApiError(500, "Failed to send internal notification email");
      }

      // 3. Send auto-reply to user
      await resend.emails.send({
        from: "Kunamix <no-reply@kunamix.com>",
        to: [email],
        subject: `We've received your inquiry, ${name.split(" ")[0]}!`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Thank You for Contacting Kunamix</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9f9fb; padding: 20px; margin: 0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table style="max-width: 600px; width: 100%; text-align: left; background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); border-top: 4px solid #D95A15;">
          <tr>
            <td>
              <h2 style="color: #09090b; margin-top: 0; font-size: 22px;">Hi ${name.split(" ")[0]},</h2>
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">Thank you for reaching out to <strong>Kunamix Digital Solutions</strong>. We've received your inquiry regarding your <strong>${projectType.toLowerCase()}</strong> project.</p>
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">Our team will get back to you within 24 hours to discuss next steps.</p>
              <div style="background-color: #fafafa; padding: 20px; border-radius: 8px; margin: 30px 0; border: 1px solid #f4f4f5;">
                <h4 style="margin: 0 0 15px 0; color: #18181b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Your Inquiry Summary</h4>
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #52525b;"><strong>Project Type:</strong> ${projectType}</p>
                <p style="margin: 0 0 15px 0; font-size: 15px; color: #52525b;"><strong>Budget:</strong> ${budget}</p>
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #52525b;"><strong>Message:</strong></p>
                <div style="font-size: 15px; color: #71717a; font-style: italic;">"${message.replace(/\n/g, "<br>")}"</div>
              </div>
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">If you have immediate questions, simply reply to this email.</p>
              <p style="margin-top: 40px; font-size: 16px; color: #09090b; font-weight: 500;">Best regards,<br><span style="color: #D95A15;">The Kunamix Team</span></p>
              <hr style="margin: 40px 0 20px 0; border: none; border-top: 1px solid #eaeaea;">
              <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0;">🌐 <a href="https://kunamix.com" style="color: #D95A15; text-decoration: none;">kunamix.com</a><br>This is an automated confirmation, but you can reply directly to reach our team.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });

      res
        .status(200)
        .json(new ApiResponse(200, null, "Mail sent successfully"));
    } catch (err) {
      console.error("Server Error in contactForm:", err);
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, "Something went wrong while sending emails");
    }
  },
);
