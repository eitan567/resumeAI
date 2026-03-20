import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cron from "node-cron";
import nodemailer from "nodemailer";
import fs from "fs";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, collection, query, where, getDocs, doc, updateDoc, limit } from "firebase/firestore";

async function startServer() {
  fs.writeFileSync("startup-test.log", "STARTING SERVER\n");
  const app = express();
  const PORT = 3000;

  let clientDb: any;

  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  
  // Use the database ID from config, fallback to default if it fails
  const databaseId = config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)" 
    ? config.firestoreDatabaseId 
    : undefined;
  
  // Initialize Client SDK
  const clientApp = initializeClientApp(config);
  clientDb = getClientFirestore(clientApp, databaseId);
  console.log(`Firebase Client SDK initialized for database: ${databaseId || "(default)"}`);

  // Verify Client SDK connection
  try {
    const q = query(collection(clientDb, "users"), where("plan", "==", "pro"));
    const snap = await getDocs(q);
    console.log(`Firebase Client SDK connection verified. Found ${snap.docs.length} pro users.`);
    fs.appendFileSync("startup-test.log", `CLIENT SUCCESS: Found ${snap.docs.length} pro users on ${databaseId || "(default)"}\n`);
  } catch (err: any) {
    console.error(`Firebase Client SDK connection failed:`, err.message);
    fs.appendFileSync("startup-test.log", `CLIENT FAILED: ${err.message} on ${databaseId || "(default)"}\n`);
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
    if (!clientDb) {
      console.log("Cron job skipped: Firebase Client SDK not initialized.");
      return;
    }

    console.log("Running subscription expiration check...");
    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      // Use Client SDK for query since Admin SDK fails with PERMISSION_DENIED in this environment
      let docs: any[] = [];
      try {
        const q = query(
          collection(clientDb, "users"),
          where("plan", "==", "pro"),
          where("reminderSent", "==", false),
          where("proExpiresAt", "<=", threeDaysFromNow.toISOString())
        );
        const clientSnap = await getDocs(q);
        console.log(`Client SDK query successful: Found ${clientSnap.docs.length} users.`);
        
        docs = clientSnap.docs.map(d => ({
          id: d.id,
          data: () => d.data(),
          ref: doc(clientDb, "users", d.id)
        }));
      } catch (err: any) {
        console.error("Client SDK query failed:", err);
        throw err;
      }

      if (docs.length === 0) {
        console.log("No users found with expiring subscriptions.");
        return;
      }

      for (const doc of docs) {
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
          await updateDoc(doc.ref, { reminderSent: true });
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
    if (!clientDb) {
      res.status(500).json({ error: "Firebase Client SDK not initialized" });
      return;
    }

    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      // Use Client SDK for query since Admin SDK fails with PERMISSION_DENIED in this environment
      let docs: any[] = [];
      try {
        const q = query(
          collection(clientDb, "users"),
          where("plan", "==", "pro"),
          where("reminderSent", "==", false),
          where("proExpiresAt", "<=", threeDaysFromNow.toISOString())
        );
        const clientSnap = await getDocs(q);
        console.log(`Client SDK query successful: Found ${clientSnap.docs.length} users.`);
        
        docs = clientSnap.docs.map(d => ({
          id: d.id,
          data: () => d.data(),
          ref: doc(clientDb, "users", d.id)
        }));
      } catch (err: any) {
        console.error("Client SDK query failed:", err);
        throw err;
      }

      const sentTo = [];

      for (const doc of docs) {
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

          await updateDoc(doc.ref, { reminderSent: true });
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

  // Debug endpoint to trigger cron job logic
  app.get("/api/debug/cron", async (req, res) => {
    console.log("Manual trigger of expiration check...");
    if (!clientDb) {
      return res.status(500).json({ error: "Firestore not initialized" });
    }

    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      console.log(`Checking for expirations before: ${threeDaysFromNow.toISOString()}`);

      // Try a simple get first to check permissions
      try {
        const qTest = query(collection(clientDb, "users"), limit(1));
        const testSnap = await getDocs(qTest);
        console.log(`Simple get successful, found ${testSnap.docs.length} docs`);
      } catch (err: any) {
        console.error("Simple get failed in debug endpoint:", err.message);
        return res.status(403).json({ error: "Permission denied on simple get", details: err.message });
      }

      const q = query(
        collection(clientDb, "users"),
        where("plan", "==", "pro"),
        where("reminderSent", "==", false),
        where("proExpiresAt", "<=", threeDaysFromNow.toISOString())
      );
      const snapshot = await getDocs(q);

      const results = [];
      for (const doc of snapshot.docs) {
        results.push({ id: doc.id, ...doc.data() });
      }

      res.json({ 
        message: "Check completed", 
        found: snapshot.docs.length,
        results 
      });
    } catch (error: any) {
      console.error("Error in debug cron:", error);
      res.status(500).json({ error: error.message, stack: error.stack });
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
