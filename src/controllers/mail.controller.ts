import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../customResponses/ErrorHandler";
import path from "path";
import dotenv from "dotenv";
import { sendMail } from "@kunal_kumar/mail-sender-sdk";
import { Resend } from "resend";
dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);



const kunamixMailSender = async (req:Request,res:Response,next:NextFunction)=>{
  const { email, name, message, subject } = req.body;

  if (!email || !name || !message || !subject) {
    return next(new ErrorHandler("Missing filed", 400))
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
      return next(new ErrorHandler("Failed to send email to Kunamix",500));
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
          Thank you for reaching out to <strong>Kunamix</strong>. We’ve received your message and will get back to you shortly.
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
    return next(new ErrorHandler("Something went wrong while sending emails",500));
  }
};


export { kunamixMailSender };
