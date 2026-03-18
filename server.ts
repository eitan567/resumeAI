import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cron from "node-cron";
import nodemailer from "nodemailer";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin
  let db: FirebaseFirestore.Firestore | null = null;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: config.projectId,
      });
      db = getFirestore(adminApp, config.firestoreDatabaseId);
      console.log("Firebase Admin initialized with database:", config.firestoreDatabaseId);
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
  }

  // Configure Nodemailer
  let transporter: nodemailer.Transporter;
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Create a test account for development
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("Nodemailer test account created. Emails will be logged to Ethereal.");
    } catch (err) {
      console.error("Failed to create Nodemailer test account:", err);
    }
  }

  // Setup Cron Job to run daily at midnight (or every minute for testing)
  // We'll run it every hour in this example, but check for expirations within 3 days.
  cron.schedule("0 * * * *", async () => {
    if (!db) {
      console.log("Cron job skipped: Firebase Admin not initialized.");
      return;
    }

    console.log("Running subscription expiration check...");
    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      // Query users whose plan is 'pro', reminderSent is false, and proExpiresAt is within 3 days
      const usersRef = db.collection("users");
      const snapshot = await usersRef
        .where("plan", "==", "pro")
        .where("reminderSent", "==", false)
        .where("proExpiresAt", "<=", threeDaysFromNow.toISOString())
        .get();

      if (snapshot.empty) {
        console.log("No users found with expiring subscriptions.");
        return;
      }

      console.log(`Found ${snapshot.size} users with expiring subscriptions.`);

      for (const doc of snapshot.docs) {
        const user = doc.data();
        
        // Send email
        try {
          const info = await transporter.sendMail({
            from: '"AI Resume Builder" <noreply@airesumebuilder.com>',
            to: user.email,
            subject: "Your Pro Subscription is Expiring Soon!",
            text: `Hi ${user.name},\n\nYour Pro subscription is set to expire on ${new Date(user.proExpiresAt).toLocaleDateString()}. Please renew your subscription to keep enjoying unlimited AI resume and cover letter generation.\n\nBest,\nThe AI Resume Builder Team`,
            html: `<p>Hi ${user.name},</p><p>Your Pro subscription is set to expire on <strong>${new Date(user.proExpiresAt).toLocaleDateString()}</strong>. Please renew your subscription to keep enjoying unlimited AI resume and cover letter generation.</p><p>Best,<br>The AI Resume Builder Team</p>`,
          });

          console.log(`Reminder email sent to ${user.email}. Message ID: ${info.messageId}`);
          console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

          // Update reminderSent to true
          await doc.ref.update({ reminderSent: true });
        } catch (emailErr) {
          console.error(`Failed to send email to ${user.email}:`, emailErr);
        }
      }
    } catch (err) {
      console.error("Error running expiration check cron job:", err);
    }
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Manual trigger for testing the cron job
  app.post("/api/cron/trigger-reminders", async (req, res) => {
    if (!db) {
      res.status(500).json({ error: "Firebase Admin not initialized" });
      return;
    }

    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      const usersRef = db.collection("users");
      const snapshot = await usersRef
        .where("plan", "==", "pro")
        .where("reminderSent", "==", false)
        .where("proExpiresAt", "<=", threeDaysFromNow.toISOString())
        .get();

      const sentTo = [];

      for (const doc of snapshot.docs) {
        const user = doc.data();
        try {
          const info = await transporter.sendMail({
            from: '"AI Resume Builder" <noreply@airesumebuilder.com>',
            to: user.email,
            subject: "Your Pro Subscription is Expiring Soon!",
            text: `Hi ${user.name},\n\nYour Pro subscription is set to expire on ${new Date(user.proExpiresAt).toLocaleDateString()}. Please renew your subscription to keep enjoying unlimited AI resume and cover letter generation.\n\nBest,\nThe AI Resume Builder Team`,
            html: `<p>Hi ${user.name},</p><p>Your Pro subscription is set to expire on <strong>${new Date(user.proExpiresAt).toLocaleDateString()}</strong>. Please renew your subscription to keep enjoying unlimited AI resume and cover letter generation.</p><p>Best,<br>The AI Resume Builder Team</p>`,
          });

          console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

          await doc.ref.update({ reminderSent: true });
          sentTo.push(user.email);
        } catch (emailErr) {
          console.error(`Failed to send email to ${user.email}:`, emailErr);
        }
      }

      res.json({ status: "success", sentCount: sentTo.length, sentTo });
    } catch (err) {
      console.error("Error triggering reminders:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Client-side triggered reminder (fallback for environments without Firebase Admin)
  app.use(express.json());
  app.post("/api/send-reminder", async (req, res) => {
    try {
      const { email, name, expiresAt } = req.body;
      
      if (!email || !name || !expiresAt) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const info = await transporter.sendMail({
        from: '"AI Resume Builder" <noreply@airesumebuilder.com>',
        to: email,
        subject: "Your Pro Subscription is Expiring Soon!",
        text: `Hi ${name},\n\nYour Pro subscription is set to expire on ${new Date(expiresAt).toLocaleDateString()}. Please renew your subscription to keep enjoying unlimited AI resume and cover letter generation.\n\nBest,\nThe AI Resume Builder Team`,
        html: `<p>Hi ${name},</p><p>Your Pro subscription is set to expire on <strong>${new Date(expiresAt).toLocaleDateString()}</strong>. Please renew your subscription to keep enjoying unlimited AI resume and cover letter generation.</p><p>Best,<br>The AI Resume Builder Team</p>`,
      });

      console.log(`Client-triggered reminder email sent to ${email}.`);
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

      res.json({ status: "success" });
    } catch (err) {
      console.error("Error sending client-triggered reminder:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Cron job scheduled: 0 * * * * (Every hour)");
  });
}

startServer();
