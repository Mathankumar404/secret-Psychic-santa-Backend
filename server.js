import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Function: Check Email Schedule
async function checkScheduledEmails() {
  const now = new Date().toISOString();
  console.log("⏳ Checking for scheduled emails...");

  // Fetch only 5 emails at a time
  const { data: emails, error } = await supabase
    .from("scheduled_emails")
    .select("*")
    .eq("status", "pending")
    .lte("schedule_time", now)
    .order("schedule_time", { ascending: true })
    .limit(5);

  if (error) {
    console.error("Supabase Error:", error);
    return;
  }

  if (!emails || emails.length === 0) return;

  console.log(`📬 Found ${emails.length} pending emails`);

  for (let email of emails) {
    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email.to_email,
        subject: email.subject,
        text: email.message,
      });

      console.log("✅ Email sent to:", email.to_email);

      // Mark as sent
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

// Run every 30 seconds
setInterval(checkScheduledEmails, 30000);

// Start Server
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
