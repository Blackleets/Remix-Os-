import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (Lazy)
let adminDb: Firestore | null = null;
const getDb = () => {
  if (!adminDb) {
    try {
      const configPath = path.join(__dirname, "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        
        // In AI Studio Cloud Run environment, initializeApp() without arguments 
        // will pick up the correct ambient project credentials.
        if (getApps().length === 0) {
          initializeApp({
            projectId: firebaseConfig.projectId
          });
          console.log(`Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
        }

        const dbId = firebaseConfig.firestoreDatabaseId;
        const app = getApps()[0];
        // Specifically check if it is not the default database
        if (dbId && dbId !== "(default)") {
          adminDb = getFirestore(app, dbId);
          console.log(`Connected to named Firestore database: ${dbId} for project: ${firebaseConfig.projectId}`);
        } else {
          adminDb = getFirestore(app);
          console.log(`Connected to default Firestore database for project: ${firebaseConfig.projectId}`);
        }
      } else {
        console.warn("firebase-applet-config.json not found.");
      }
    } catch (error: any) {
      console.error("Firebase Admin initialization error:", error.message);
    }
  }
  return adminDb;
};

// Initialize Stripe (Lazy)
let stripe: Stripe | null = null;
const getStripe = () => {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn("STRIPE_SECRET_KEY is not configured. Stripe features will run in Mock Mode.");
      return null;
    }
    stripe = new Stripe(key);
  }
  return stripe;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Get Billing Config
  app.get("/api/billing/config", (req, res) => {
    res.json({ 
      stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY,
      prices: {
        starter: { amount: 0, id: process.env.STRIPE_PRICE_ID_STARTER },
        pro: { amount: 49, id: process.env.STRIPE_PRICE_ID_PRO },
        business: { amount: 199, id: process.env.STRIPE_PRICE_ID_BUSINESS }
      }
    });
  });

  // Stripe Checkout Session Creation
  app.post("/api/billing/create-checkout-session", async (req, res) => {
    try {
      const { planId, companyId, customerEmail } = req.body;
      const stripeClient = getStripe();

      if (!stripeClient) {
        // FALLBACK: Mock Checkout for Preview Environment
        const mockUrl = `${process.env.APP_URL || "http://localhost:3000"}/billing?success=true&session_id=mock_session_${planId}_${Date.now()}`;
        return res.json({ url: mockUrl });
      }

      // Real Price IDs from Environment
      const prices: Record<string, string | undefined> = {
        starter: process.env.STRIPE_PRICE_ID_STARTER,
        pro: process.env.STRIPE_PRICE_ID_PRO,
        business: process.env.STRIPE_PRICE_ID_BUSINESS,
      };

      const priceId = prices[planId];
      if (!priceId) {
        return res.status(400).json({ error: `Price mapping for ${planId} is missing in configuration.` });
      }

      // 1. Get or Create Stripe Customer
      const db = getDb();
      if (!db) throw new Error("Database not initialized");

      const companyRef = db.collection("companies").doc(companyId);
      const companyDoc = await companyRef.get();
      const companyData = companyDoc.data();
      
      let stripeCustomerId = companyData?.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripeClient.customers.create({
          email: customerEmail,
          metadata: { companyId },
        });
        stripeCustomerId = customer.id;
        await companyRef.update({ stripeCustomerId });
      }

      // 2. Create Session
      const session = await stripeClient.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${process.env.APP_URL || "http://localhost:3000"}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || "http://localhost:3000"}/billing?canceled=true`,
        metadata: { companyId, planId },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Session Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Customer Portal Session
  app.post("/api/billing/create-portal-session", async (req, res) => {
    try {
      const { companyId } = req.body;
      const stripeClient = getStripe();

      if (!stripeClient) {
        return res.status(400).json({ error: "Stripe configuration missing. Portal unavailable in Mock Mode." });
      }

      const db = getDb();
      if (!db) throw new Error("Database not initialized");

      const companyDoc = await db.collection("companies").doc(companyId).get();
      const stripeCustomerId = companyDoc.data()?.stripeCustomerId;

      if (!stripeCustomerId) {
        return res.status(400).json({ error: "No active Stripe customer found for this account." });
      }

      const session = await stripeClient.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${process.env.APP_URL || "http://localhost:3000"}/billing`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync Subscription Status (Callback/Manual)
  app.post("/api/billing/sync", async (req, res) => {
    try {
      const { sessionId, companyId } = req.body;
      const db = getDb();
      if (!db) throw new Error("Database not initialized");

      if (sessionId.startsWith("mock_session_")) {
        // Handle Mock Sync
        const parts = sessionId.split('_');
        const planId = parts[2] || 'starter';

        await db.collection("companies").doc(companyId).update({
          subscription: {
            planId: planId,
            status: "active",
            currentPeriodEnd: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
            stripeSubscriptionId: "mock_" + Date.now(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });

        return res.json({ status: "success", planId });
      }

      const stripeClient = getStripe();
      if (!stripeClient) throw new Error("Stripe not configured");
      
      const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });

      if (session.payment_status === "paid") {
        const subscription = session.subscription as any;
        const planId = session.metadata?.planId as any;

        await db.collection("companies").doc(companyId).update({
          subscription: {
            planId: planId || 'starter',
            status: subscription.status,
            currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
            stripeSubscriptionId: subscription.id,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });

        res.json({ status: "success", planId });
      } else {
        res.status(400).json({ error: "Payment not completed" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe Webhook (Async updates)
  app.post("/api/billing/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const stripeClient = getStripe();
    const db = getDb();
    if (!stripeClient || !db) return res.sendStatus(200);

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (webhookSecret && sig) {
        event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = JSON.parse(req.body.toString()); 
      }
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const { type, data } = event;

    // Handle the event
    switch (type) {
      case 'checkout.session.completed': {
        const session = data.object;
        if (session.mode === 'subscription') {
          const subId = session.subscription;
          const companyId = session.metadata?.companyId;
          const planId = session.metadata?.planId;
          
          if (companyId && subId) {
            const sub = await stripeClient.subscriptions.retrieve(subId) as any;
            await db.collection("companies").doc(companyId).update({
              "subscription.planId": planId,
              "subscription.status": sub.status,
              "subscription.currentPeriodEnd": Timestamp.fromMillis(sub.current_period_end * 1000),
              "subscription.stripeSubscriptionId": subId,
            });
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = data.object as any;
        const custId = sub.customer as string;
        
        const companies = await db.collection("companies").where("stripeCustomerId", "==", custId).limit(1).get();
        if (!companies.empty) {
          const companyDoc = companies.docs[0];
          await companyDoc.ref.update({
            "subscription.status": sub.status,
            "subscription.currentPeriodEnd": Timestamp.fromMillis(sub.current_period_end * 1000),
          });
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = data.object;
        if (invoice.subscription) {
          await db.collection("companies")
            .where("stripeCustomerId", "==", invoice.customer)
            .limit(1)
            .get()
            .then(qs => {
              if (!qs.empty) {
                qs.docs[0].ref.update({ "subscription.status": 'active' });
              }
            });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = data.object;
        if (invoice.subscription) {
          await db.collection("companies")
            .where("stripeCustomerId", "==", invoice.customer)
            .limit(1)
            .get()
            .then(qs => {
              if (!qs.empty) {
                qs.docs[0].ref.update({ "subscription.status": 'past_due' });
              }
            });
        }
        break;
      }
    }

    res.json({ received: true });
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
