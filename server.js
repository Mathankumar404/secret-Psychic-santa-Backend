import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

// -------------------------------
// Supabase Client
// -------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -------------------------------
// Nodemailer Transporter
// -------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// -------------------------------
// Function: Check Email Schedule
// -------------------------------
async function checkScheduledEmails() {
  const now = new Date().toISOString();

  console.log("⏳ Checking for scheduled emails...");

  const { data: emails, error } = await supabase
    .from("scheduled_emails")
    .select("*")
    .eq("status", "pending")
    .lte("schedule_time", now);

  if (error) {
    console.error("Supabase Error:", error);
    return;
  }

  if (!emails || emails.length === 0) return;

  console.log(`📬 Found ${emails.length} pending emails`);

  for (let email of emails) {
    try {
      await transporter.sendMail({
        from: ` ${process.env.MAIL_USER}`,
        to: email.to_email,   
        subject: email.subject,
        text: email.message,
      });

      console.log("✅ Email sent to:", email.to_email);

      await supabase
        .from("scheduled_emails")
        .update({ status: "sent" })
        .eq("id", email.id);

    } catch (err) {
      console.log("❌ Email send failed:", err);

      await supabase
        .from("scheduled_emails")
        .update({ status: "failed" })
        .eq("id", email.id);
    }
  }
}

// Loop every 1 second
setInterval(checkScheduledEmails, 1000);

// -------------------------------
// Start Server
// -------------------------------
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
