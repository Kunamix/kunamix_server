import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../customResponses/ErrorHandler";
import dotenv from "dotenv";
import { Resend } from "resend";
dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

export const contactForm = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Update destructured fields to match your new frontend payload
  const { name, email, message, projectType, budget } = req.body;

  // 2. Update validation to check for the new required fields
  if (!name || !email || !message || !projectType || !budget) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  try {
    // 3. Dynamic subject for the internal Kunamix team notification
    const internalSubject = `🚀 New Lead: ${projectType} from ${name}`;

    // Send to Kunamix internal team
    const { data, error } = await resend.emails.send({
      from: "contact@kunamix.com", // Make sure this is a verified domain in Resend
      to: ["contact@kunamix.com"],
      subject: internalSubject,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Lead Notification</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f4f4f5;
      padding: 30px;
      margin: 0;
    }
    .email-container {
      max-width: 600px;
      margin: auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      border-top: 6px solid #D95A15; /* Kunamix Orange */
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    .header {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 25px;
      color: #09090b;
      letter-spacing: -0.5px;
    }
    .grid {
      background: #fafafa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 25px;
      border: 1px solid #eaeaea;
    }
    .section {
      margin-bottom: 16px;
    }
    .section:last-child {
      margin-bottom: 0;
    }
    .label {
      font-size: 12px;
      font-weight: 600;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .value {
      font-size: 16px;
      color: #18181b;
      font-weight: 500;
    }
    .message-box {
      background: #fff;
      border-left: 4px solid #D95A15;
      padding: 16px 20px;
      color: #3f3f46;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 30px;
      border-radius: 0 8px 8px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #18181b; /* Dark Button */
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
    }
    .button:hover {
      background: #27272a;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">New Project Inquiry</div>
    
    <div class="grid">
      <div class="section">
        <div class="label">Client Name</div>
        <div class="value">${name}</div>
      </div>
      <div class="section">
        <div class="label">Email Address</div>
        <div class="value"><a href="mailto:${email}" style="color: #D95A15; text-decoration: none;">${email}</a></div>
      </div>
      <div class="section">
        <div class="label">Project Type</div>
        <div class="value">${projectType}</div>
      </div>
      <div class="section">
        <div class="label">Estimated Budget</div>
        <div class="value">${budget}</div>
      </div>
    </div>

    <div class="label">Message</div>
    <div class="message-box">
      ${message.replace(/\n/g, "<br>")}
    </div>

    <div>
      <a href="mailto:${email}?subject=Re:%20Your%20inquiry%20to%20Kunamix%20Digital%20Solutions&body=Hi%20${encodeURIComponent(name.split(" ")[0])},%0A%0AThanks%20for%20reaching%20out%20about%20your%20${encodeURIComponent(projectType)}%20project..." class="button">
        Reply to ${name.split(" ")[0]}
      </a>
    </div>
  </div>
</body>
</html>
`,
    });

    if (error) {
      console.error("Resend Error:", error);
      return next(
        new ErrorHandler(
          "Failed to send email to Kunamix Digital Solutions",
          500,
        ),
      );
    }

    // Send thank-you auto-reply email to the user
    await resend.emails.send({
      from: "Kunamix <no-reply@kunamix.com>", // Make sure to use an actual verified sender address
      to: [email],
      subject: `We've received your inquiry, ${name.split(" ")[0]}!`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Thank You for Contacting Kunamix</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9f9fb; padding: 20px; margin: 0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table style="max-width: 600px; width: 100%; text-align: left; background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); border-top: 4px solid #D95A15;">
          <tr>
            <td>
              <h2 style="color: #09090b; margin-top: 0; font-size: 22px;">Hi ${name.split(" ")[0]},</h2>
              
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">
                Thank you for reaching out to <strong>Kunamix Digital Solutions</strong>. We have successfully received your inquiry regarding your <strong>${projectType.toLowerCase()}</strong> project.
              </p>

              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">
                Our technical team is currently reviewing your requirements. We aim to get back to you within 24 hours to discuss the next steps, provide an honest timeline, and review your expectations.
              </p>

              <div style="background-color: #fafafa; padding: 20px; border-radius: 8px; margin: 30px 0; border: 1px solid #f4f4f5;">
                <h4 style="margin: 0 0 15px 0; color: #18181b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Your Inquiry Summary</h4>
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #52525b;"><strong>Project Type:</strong> ${projectType}</p>
                <p style="margin: 0 0 15px 0; font-size: 15px; color: #52525b;"><strong>Budget:</strong> ${budget}</p>
                
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #52525b;"><strong>Message:</strong></p>
                <div style="font-size: 15px; color: #71717a; font-style: italic;">
                  "${message.replace(/\n/g, "<br>")}"
                </div>
              </div>

              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">
                If you have any immediate questions or need to add more details, simply reply directly to this email.
              </p>

              <p style="margin-top: 40px; font-size: 16px; color: #09090b; font-weight: 500;">
                Best regards,<br>
                <span style="color: #D95A15;">The Kunamix Team</span>
              </p>

              <hr style="margin: 40px 0 20px 0; border: none; border-top: 1px solid #eaeaea;">
              
              <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0;">
                🌐 <a href="https://kunamix.com" style="color: #D95A15; text-decoration: none;">kunamix.com</a><br>
                This is an automated confirmation, but you can reply directly to reach our team.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
    });

    res.status(200).json({
      success: true,
      message: "Mail sent successfully",
    });
  } catch (err) {
    console.error("Server Error in contactForm:", err);
    return next(
      new ErrorHandler("Something went wrong while sending emails", 500),
    );
  }
};

export const referForm = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const {
    yourName,
    yourEmail,
    yourPhone,
    clientName,
    clientEmail,
    clientPhone,
    clientCompany,
    projectDetails,
    estimatedBudget,
  } = req.body;

  // Validate required fields
  if (
    !yourName ||
    !yourEmail ||
    !yourPhone ||
    !clientName ||
    !clientEmail ||
    !clientPhone ||
    !projectDetails ||
    !estimatedBudget
  ) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  try {
    // Determine commission rate based on budget
    const getCommissionInfo = (budget: string) => {
      switch (budget) {
        case "under-50k":
          return { rate: "15%", range: "Under ₹50,000" };
        case "50k-1l":
          return { rate: "15%", range: "₹50,000 - ₹1,00,000" };
        case "1l-3l":
          return { rate: "20%", range: "₹1,00,000 - ₹3,00,000" };
        case "3l-5l":
          return { rate: "20%", range: "₹3,00,000 - ₹5,00,000" };
        case "5l-plus":
          return { rate: "20%", range: "₹5,00,000+" };
        default:
          return { rate: "15%", range: budget };
      }
    };

    const commissionInfo = getCommissionInfo(estimatedBudget);

    // Send to Kunamix internal team
    const { data, error } = await resend.emails.send({
      from: "referrals@kunamix.com",
      to: ["contact@kunamix.com"],
      subject: `🎁 New Referral from ${yourName}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Referral Submission</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f6f6f6;
      padding: 30px;
    }
    .email-container {
      max-width: 700px;
      margin: auto;
      background: #ffffff;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .header {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 20px;
      color: #333;
      border-bottom: 3px solid #007bff;
      padding-bottom: 10px;
    }
    .section {
      margin-bottom: 25px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #007bff;
      margin-bottom: 10px;
    }
    .field {
      margin-bottom: 10px;
    }
    .label {
      font-weight: bold;
      color: #555;
      display: inline-block;
      width: 150px;
    }
    .value {
      color: #222;
    }
    .commission-badge {
      display: inline-block;
      padding: 8px 16px;
      background: #28a745;
      color: white;
      border-radius: 20px;
      font-weight: bold;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">🎁 New Referral Submission</div>
    
    <!-- Referrer Information -->
    <div class="section">
      <div class="section-title">👤 Referrer Information</div>
      <div class="field">
        <span class="label">Name:</span>
        <span class="value">${yourName}</span>
      </div>
      <div class="field">
        <span class="label">Email:</span>
        <span class="value"><a href="mailto:${yourEmail}">${yourEmail}</a></span>
      </div>
      <div class="field">
        <span class="label">Phone:</span>
        <span class="value">${yourPhone}</span>
      </div>
    </div>

    <!-- Client Information -->
    <div class="section">
      <div class="section-title">🏢 Client Information</div>
      <div class="field">
        <span class="label">Name:</span>
        <span class="value">${clientName}</span>
      </div>
      <div class="field">
        <span class="label">Email:</span>
        <span class="value"><a href="mailto:${clientEmail}">${clientEmail}</a></span>
      </div>
      <div class="field">
        <span class="label">Phone:</span>
        <span class="value">${clientPhone}</span>
      </div>
      ${
        clientCompany
          ? `
      <div class="field">
        <span class="label">Company:</span>
        <span class="value">${clientCompany}</span>
      </div>
      `
          : ""
      }
    </div>

    <!-- Project Details -->
    <div class="section">
      <div class="section-title">📋 Project Details</div>
      <div class="field">
        <span class="label">Budget Range:</span>
        <span class="value">${commissionInfo.range}</span>
      </div>
      <div class="field">
        <span class="label">Description:</span>
        <div class="value" style="margin-top: 10px; padding: 10px; background: white; border-radius: 5px;">
          ${projectDetails}
        </div>
      </div>
      <div class="commission-badge">
        💰 Commission Rate: ${commissionInfo.rate}
      </div>
    </div>

    <!-- Next Steps -->
    <div class="section" style="background: #e7f3ff;">
      <div class="section-title" style="color: #0056b3;">📌 Next Steps</div>
      <ol style="margin: 10px 0; padding-left: 20px;">
        <li>Contact the client at <a href="mailto:${clientEmail}">${clientEmail}</a></li>
        <li>Discuss project requirements and provide quote</li>
        <li>Update ${yourName} on the referral status</li>
        <li>Process commission after project completion</li>
      </ol>
    </div>
  </div>
</body>
</html>
`,
    });

    if (error) {
      return next(new ErrorHandler("Failed to send referral to Kunamix", 500));
    }

    // Send thank-you email to referrer
    await resend.emails.send({
      from: "no-reply@kunamix.com",
      to: [yourEmail],
      subject: `🎉 Thank You for Your Referral!`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Thank You for Your Referral</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px;">
  <table style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
    <tr>
      <td>
        <h2 style="color: #1a1a1a;">Hi ${yourName},</h2>
        <p style="font-size: 16px; color: #333;">
          Thank you for referring <strong>${clientName}</strong> to <strong>Kunamix Digital Solutions</strong>! 🎉
        </p>
        <p style="font-size: 16px; color: #333;">
          We've received your referral and will reach out to them shortly to discuss their project needs.
        </p>
        
        <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Referral Summary</h3>
          <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}${clientCompany ? ` (${clientCompany})` : ""}</p>
          <p style="margin: 5px 0;"><strong>Budget Range:</strong> ${commissionInfo.range}</p>
          <p style="margin: 5px 0;"><strong>Your Commission:</strong> <span style="color: #28a745; font-weight: bold;">${commissionInfo.rate}</span></p>
        </div>

        <h3 style="color: #333;">What Happens Next?</h3>
        <ol style="color: #555;">
          <li>We'll contact ${clientName} within 24-48 hours</li>
          <li>We'll keep you updated on the referral status</li>
          <li>Once the project is completed and paid, we'll process your commission</li>
          <li>Commission payout within 7 business days after receiving payment</li>
        </ol>

        <p style="font-size: 16px; color: #333; margin-top: 30px;">
          If you have any questions, feel free to reach out to us at 
          <a href="mailto:contact@kunamix.com" style="color: #007bff;">contact@kunamix.com</a>.
        </p>

        <p style="margin-top: 30px; font-size: 16px; color: #333;">
          Best regards,<br>
          Kunamix Digital Solutions Team
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 14px; color: #777;">
          📞 +91-7050553648<br>
          🌐 <a href="https://kunamix.com" style="color: #007bff;">kunamix.com</a><br>
          📧 <a href="mailto:contact@kunamix.com" style="color: #007bff;">contact@kunamix.com</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`,
    });

    // Send notification email to client
    await resend.emails.send({
      from: "hello@kunamix.com",
      to: [clientEmail],
      subject: `${clientName}, you've been referred to Kunamix!`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>You've Been Referred to Kunamix</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px;">
  <table style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
    <tr>
      <td>
        <h2 style="color: #1a1a1a;">Hi ${clientName},</h2>
        <p style="font-size: 16px; color: #333;">
          <strong>${yourName}</strong> thought we'd be a great fit for your project needs! 
        </p>
        <p style="font-size: 16px; color: #333;">
          At <strong>Kunamix Digital Solutions</strong>, we specialize in creating exceptional digital solutions that help businesses grow and succeed.
        </p>

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin: 20px 0; color: white;">
          <h3 style="margin-top: 0; color: white;">Why Choose Kunamix Digital Solutions?</h3>
          <ul style="padding-left: 20px; margin: 10px 0;">
            <li style="margin: 8px 0;">Expert team of developers & designers</li>
            <li style="margin: 8px 0;">50+ successful projects delivered</li>
            <li style="margin: 8px 0;">100% client satisfaction rate</li>
            <li style="margin: 8px 0;">Modern tech stack & best practices</li>
          </ul>
        </div>

        <p style="font-size: 16px; color: #333;">
          We'll be reaching out to you soon to discuss your project in detail. In the meantime, feel free to:
        </p>
        <ul style="color: #555;">
          <li>Check out our portfolio at <a href="https://kunamix.com" style="color: #007bff;">kunamix.com</a></li>
          <li>Email us directly at <a href="mailto:contact@kunamix.com" style="color: #007bff;">contact@kunamix.com</a></li>
          <li>Call us at +91-7050553648</li>
        </ul>

        <p style="margin-top: 30px; font-size: 16px; color: #333;">
          Looking forward to working with you!<br><br>
          Best regards,<br>
          Kunamix Digital Solutions Team
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 14px; color: #777;">
          📞 +91-7004689636<br>
          🌐 <a href="https://kunamix.com" style="color: #007bff;">kunamix.com</a><br>
          📧 <a href="mailto:contact@kunamix.com" style="color: #007bff;">contact@kunamix.com</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`,
    });

    res.status(200).json({
      success: true,
      message: "Referral submitted successfully",
    });
  } catch (err) {
    console.error("Referral form error:", err);
    return next(
      new ErrorHandler("Something went wrong while processing referral", 500),
    );
  }
};
