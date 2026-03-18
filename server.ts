import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cron from "node-cron";
import nodemailer from "nodemailer";
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
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
      fs.writeFileSync("startup-test.log", `Using Project ID: ${config.projectId}, Database ID: ${config.firestoreDatabaseId}\n`);
      
      if (getApps().length === 0) {
        initializeApp({
          credential: applicationDefault(),
          projectId: config.projectId,
        });
      }
      
      // Try the named database from config
      const namedDb = getFirestore(config.firestoreDatabaseId);
      db = namedDb;
      console.log(`Firebase Admin initialized for project: ${config.projectId}, database: ${config.firestoreDatabaseId}`);
      
      // Startup test query to verify permissions and identify the correct database
      namedDb.collection("users").limit(1).get()
        .then(snap => {
          console.log(`Startup test query successful on database ${config.firestoreDatabaseId}. Found ${snap.size} users.`);
          fs.writeFileSync("startup-test.log", `SUCCESS: Found ${snap.size} users on ${config.firestoreDatabaseId}\n`);
        })
        .catch(async (err: any) => {
          console.error(`Startup test query failed on database ${config.firestoreDatabaseId}:`, err.message);
          fs.appendFileSync("startup-test.log", `FAILED: ${err.message} on ${config.firestoreDatabaseId}\n`);
          
          console.log("Attempting a test write...");
          try {
            await namedDb.collection("test_connection").doc("startup").set({ timestamp: new Date().toISOString() });
            console.log("Test write successful!");
            fs.appendFileSync("startup-test.log", "SUCCESS: Test write worked!\n");
          } catch (writeErr: any) {
            console.error("Test write failed:", writeErr.message);
            fs.appendFileSync("startup-test.log", `FAILED: Test write ${writeErr.message}\n`);
          }

          console.log("Attempting collectionGroup test...");
          try {
            const groupSnap = await namedDb.collectionGroup("users").limit(1).get();
            console.log(`CollectionGroup test successful on ${config.firestoreDatabaseId}. Found ${groupSnap.size} docs.`);
            fs.appendFileSync("startup-test.log", `SUCCESS: CollectionGroup found ${groupSnap.size} docs on ${config.firestoreDatabaseId}\n`);
          } catch (groupErr: any) {
            console.error(`CollectionGroup test failed on ${config.firestoreDatabaseId}:`, groupErr.message);
            fs.appendFileSync("startup-test.log", `FAILED: CollectionGroup ${groupErr.message} on ${config.firestoreDatabaseId}\n`);
          }

          console.log("Attempting to fallback to (default) database of the same project...");
          const defaultDb = getFirestore(); // This uses the default app initialized above
          try {
            const snap = await defaultDb.collection("users").limit(1).get();
            console.log(`Startup test successful on (default) database of ${config.projectId}. Found ${snap.size} users. Switching to (default).`);
            db = defaultDb;
            fs.appendFileSync("startup-test.log", `SUCCESS: Found ${snap.size} users on (default) database of ${config.projectId}\n`);
          } catch (err2: any) {
            console.error(`Startup test failed on (default) database of ${config.projectId} too:`, err2.message);
            fs.appendFileSync("startup-test.log", `FAILED: ${err2.message} on (default) database of ${config.projectId}\n`);
          }

          console.log("Attempting auto-discovery (no projectId in initializeApp)...");
          try {
            if (getApps().find(app => app.name === "auto")) {
              const autoApp = getApps().find(app => app.name === "auto")!;
              const autoDb = getFirestore(autoApp);
              const snap = await autoDb.collection("users").limit(1).get();
              console.log(`Auto-discovery successful! Found ${snap.size} users.`);
              db = autoDb;
              fs.appendFileSync("startup-test.log", `SUCCESS: Auto-discovery worked! Found ${snap.size} users.\n`);
            } else {
              const autoApp = initializeApp({}, "auto");
              const autoDb = getFirestore(autoApp);
              const snap = await autoDb.collection("users").limit(1).get();
              console.log(`Auto-discovery successful! Found ${snap.size} users.`);
              db = autoDb;
              fs.appendFileSync("startup-test.log", `SUCCESS: Auto-discovery worked! Found ${snap.size} users.\n`);
            }
          } catch (autoErr: any) {
            console.error("Auto-discovery failed:", autoErr.message);
            fs.appendFileSync("startup-test.log", `FAILED: Auto-discovery ${autoErr.message}\n`);
          }
        });

      // List collections for debugging
      db.listCollections()
        .then(cols => console.log("Available collections:", cols.map(c => c.id)))
        .catch(err => console.error("Failed to list collections:", err.message));
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

  // Debug endpoint to trigger cron job logic
  app.get("/api/debug/cron", async (req, res) => {
    console.log("Manual trigger of expiration check...");
    if (!db) {
      return res.status(500).json({ error: "Firestore not initialized" });
    }

    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      console.log(`Checking for expirations before: ${threeDaysFromNow.toISOString()}`);

      const usersRef = db.collection("users");
      
      // Try a simple get first to check permissions
      try {
        const testSnap = await usersRef.limit(1).get();
        console.log(`Simple get successful, found ${testSnap.size} docs`);
      } catch (err: any) {
        console.error("Simple get failed in debug endpoint:", err.message);
        return res.status(403).json({ error: "Permission denied on simple get", details: err.message });
      }

      const snapshot = await usersRef
        .where("plan", "==", "pro")
        .where("reminderSent", "==", false)
        .where("proExpiresAt", "<=", threeDaysFromNow.toISOString())
        .get();

      const results = [];
      for (const doc of snapshot.docs) {
        results.push({ id: doc.id, ...doc.data() });
      }

      res.json({ 
        message: "Check completed", 
        found: snapshot.size,
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
