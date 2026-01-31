import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../customResponses/ErrorHandler";
import dotenv from "dotenv";
import { Resend } from "resend";
dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

export const contactForm = async (req: Request, res: Response, next: NextFunction) => {
  const { email, name, message, subject, company } = req.body;

  if (!email || !name || !message || !subject) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  try {
    // Send to Kunamix internal team
    const { data, error } = await resend.emails.send({
      from: "contact@kunamix.com",
      to: ["contact@kunamix.com"],
      subject,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Message Notification</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f6f6f6;
      padding: 30px;
    }
    .email-container {
      max-width: 600px;
      margin: auto;
      background: #ffffff;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .header {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #333;
    }
    .section {
      margin-bottom: 20px;
    }
    .label {
      font-weight: bold;
      color: #555;
    }
    .value {
      margin-top: 5px;
      color: #222;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
    }
    .button:hover {
      background: #0056b3;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">📩 Message from ${name}</div>
    <div class="section">
      <div class="label">Sender Email:</div>
      <div class="value">${email}</div>
    </div>
    ${company ? `
    <div class="section">
      <div class="label">Company:</div>
      <div class="value">${company}</div>
    </div>
    ` : ''}
    <div class="section">
      <div class="label">Message:</div>
      <div class="value">${message}</div>
    </div>
    <div class="section">
      <a href="mailto:${email}?subject=Reply%20to%20your%20message&body=Hi%20${encodeURIComponent(
        name
      )}%2C%0A%0AThanks%20for%20reaching%20out..." class="button">Reply to ${name}</a>
    </div>
  </div>
</body>
</html>
`,
    });

    if (error) {
      return next(new ErrorHandler("Failed to send email to Kunamix", 500));
    }

    // Send thank-you email to user
    await resend.emails.send({
      from: "no-reply@kunamix.com",
      to: [email],
      subject: `Thanks for contacting Kunamix!`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Thank You for Contacting Kunamix</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px;">
  <table style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
    <tr>
      <td>
        <h2 style="color: #1a1a1a;">Hi ${name},</h2>
        <p style="font-size: 16px; color: #333;">
          Thank you for reaching out to <strong>Kunamix</strong>. We've received your message and will get back to you shortly.
        </p>
        <h4 style="margin-top: 30px; color: #555;">Your Message:</h4>
        <blockquote style="font-size: 15px; color: #444; margin: 10px 0; padding: 10px 15px; background-color: #f2f2f2; border-left: 4px solid #007bff;">
          ${message}
        </blockquote>
        <p style="font-size: 16px; color: #333;">If your message is urgent, you can reach us directly at 
          <a href="mailto:contact@kunamix.com" style="color: #007bff;">contact@kunamix.com</a>.
        </p>
        <p style="margin-top: 30px; font-size: 16px; color: #333;">
          Best regards,<br>
          Kunamix Team
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
      message: "Mail sent successfully",
    });
  } catch (err) {
    return next(new ErrorHandler("Something went wrong while sending emails", 500));
  }
};

export const referForm = async (req: Request, res: Response, next: NextFunction) => {
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
      ${clientCompany ? `
      <div class="field">
        <span class="label">Company:</span>
        <span class="value">${clientCompany}</span>
      </div>
      ` : ''}
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
          Thank you for referring <strong>${clientName}</strong> to <strong>Kunamix</strong>! 🎉
        </p>
        <p style="font-size: 16px; color: #333;">
          We've received your referral and will reach out to them shortly to discuss their project needs.
        </p>
        
        <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Referral Summary</h3>
          <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}${clientCompany ? ` (${clientCompany})` : ''}</p>
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
          Kunamix Team
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
          At <strong>Kunamix</strong>, we specialize in creating exceptional digital solutions that help businesses grow and succeed.
        </p>

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin: 20px 0; color: white;">
          <h3 style="margin-top: 0; color: white;">Why Choose Kunamix?</h3>
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
          <li>Call us at +91-7004689636</li>
        </ul>

        <p style="margin-top: 30px; font-size: 16px; color: #333;">
          Looking forward to working with you!<br><br>
          Best regards,<br>
          Kunamix Team
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
    return next(new ErrorHandler("Something went wrong while processing referral", 500));
  }
};


