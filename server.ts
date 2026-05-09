import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { GoogleGenAI } from "@google/genai";
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

// Initialize Gemini (Lazy)
let genai: GoogleGenAI | null = null;
const getGenAI = () => {
  if (!genai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY is not configured. AI features will be disabled.");
      return null;
    }
    genai = new GoogleGenAI({ apiKey: key });
  }
  return genai;
};

// Verifies a Firebase ID token from Authorization: Bearer <token>, then asserts
// the caller is a member of the companyId in the request body with one of the
// required roles. On failure, sends an HTTP error and returns null.
async function requireCompanyAccess(
  req: any,
  res: any,
  allowedRoles: string[] = ["owner", "admin"]
): Promise<{ uid: string; companyId: string } | null> {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Missing Authorization bearer token" });
    return null;
  }
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(match[1]);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  const companyId = req.body?.companyId;
  if (!companyId || typeof companyId !== "string") {
    res.status(400).json({ error: "companyId is required" });
    return null;
  }
  const db = getDb();
  if (!db) {
    res.status(500).json({ error: "Database not initialized" });
    return null;
  }
  const memSnap = await db
    .collection("memberships")
    .doc(`${decoded.uid}_${companyId}`)
    .get();
  if (!memSnap.exists || !allowedRoles.includes(memSnap.data()?.role)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return { uid: decoded.uid, companyId };
}

// Safely extract the period-end timestamp from Stripe subscription objects.
// The newer Stripe API moved current_period_end to subscription.items[].
function getPeriodEndMs(sub: any): number {
  const direct = sub?.current_period_end;
  if (typeof direct === "number") return direct * 1000;
  const item = sub?.items?.data?.[0]?.current_period_end;
  if (typeof item === "number") return item * 1000;
  return Date.now() + 30 * 24 * 60 * 60 * 1000;
}

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
      const access = await requireCompanyAccess(req, res, ["owner", "admin"]);
      if (!access) return;
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
      const access = await requireCompanyAccess(req, res, ["owner", "admin"]);
      if (!access) return;
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
      const access = await requireCompanyAccess(req, res, ["owner", "admin"]);
      if (!access) return;
      const { sessionId, companyId } = req.body;
      const db = getDb();
      if (!db) throw new Error("Database not initialized");

      if (typeof sessionId !== "string" || !sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }

      if (sessionId.startsWith("mock_session_")) {
        // Mock-mode is only honored when Stripe is not configured (dev/preview).
        if (getStripe()) {
          return res.status(400).json({ error: "Mock sessions are not allowed in production" });
        }
        const parts = sessionId.split("_");
        const planId = parts[2] || "starter";
        if (!["starter", "pro", "business"].includes(planId)) {
          return res.status(400).json({ error: "Invalid mock plan" });
        }

        await db.collection("companies").doc(companyId).update({
          subscription: {
            planId,
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

      // Verify the checkout session was created for THIS company.
      if (session.metadata?.companyId !== companyId) {
        return res.status(403).json({ error: "Session does not belong to this company" });
      }

      if (session.payment_status === "paid") {
        const subscription = session.subscription as any;
        const planId = session.metadata?.planId as any;

        await db.collection("companies").doc(companyId).update({
          subscription: {
            planId: planId || "starter",
            status: subscription.status,
            currentPeriodEnd: Timestamp.fromMillis(getPeriodEndMs(subscription)),
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

    if (!webhookSecret || !sig) {
      // Without a configured secret we cannot verify origin; refuse to process.
      return res.status(503).send("Webhook secret not configured");
    }

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
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
              "subscription.currentPeriodEnd": Timestamp.fromMillis(getPeriodEndMs(sub)),
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
            "subscription.currentPeriodEnd": Timestamp.fromMillis(getPeriodEndMs(sub)),
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

  // ===== AI: Insights =====
  // The Gemini API key never leaves the server. The client posts the business
  // context it already has access to via Firestore; we call Gemini and return
  // the parsed insights array.
  app.post("/api/ai/insights", async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ["owner", "admin"]);
      if (!access) return;
      const ai = getGenAI();
      if (!ai) return res.status(503).json({ error: "AI not configured" });

      const { businessData, language } = req.body || {};
      if (!businessData) return res.status(400).json({ error: "businessData required" });

      const langMap: Record<string, string> = {
        en: "Output all text in English.",
        es: "Entrega toda la salida de texto en Español.",
        pt: "Entregue toda a saída de texto em Português.",
      };
      const langInstruction = langMap[language] || langMap.en;

      const prompt = `
You are an expert business consultant for Remix OS.
Analyze the following small business data and provide a set of actionable insights.

CRITICAL: ${langInstruction}

Business: ${businessData.companyName} (${businessData.industry})
Current Plan: ${businessData.planLevel}
Onboarding: ${businessData.onboardingCompleted ? 'COMPLETE' : 'INCOMPLETE/PENDING'}
Total Customers: ${businessData.customersCount}
Total Products: ${businessData.productsCount}
Revenue (Last 30 Days): $${Number(businessData.recentRevenue || 0).toFixed(2)}
Growth vs Prev Period: ${businessData.growth}%
Top Products: ${JSON.stringify(businessData.topProducts)}
Low Stock Items: ${JSON.stringify(businessData.lowStockItems)}
Top Customers: ${JSON.stringify(businessData.topCustomers)}

Constraint based on Plan:
- starter: basic observations and straightforward advice.
- pro: deeper analysis, subtle patterns and market opportunities.
- business: highly strategic, predictive forecasting and growth blueprints.

Return ONLY a valid JSON array of insight objects. Each must have:
- title (string), explanation (1-2 sentences), type ("opportunity"|"risk"|"efficiency"|"growth"),
- severity ("info"|"success"|"warning"|"critical"), recommendation (1 specific next action).
No markdown, no preamble.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      if (!text) return res.json({ insights: null });
      try {
        return res.json({ insights: JSON.parse(text) });
      } catch (e) {
        console.error("Insight JSON parse error:", e);
        return res.json({ insights: null });
      }
    } catch (err: any) {
      console.error("/api/ai/insights error:", err);
      res.status(500).json({ error: err?.message || "AI request failed" });
    }
  });

  // ===== AI: Copilot chat =====
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ["owner", "admin", "staff", "viewer"]);
      if (!access) return;
      const ai = getGenAI();
      if (!ai) return res.status(503).json({ error: "AI not configured" });

      const { message, history, context, language } = req.body || {};
      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "message required" });
      }

      const langMap: Record<string, string> = {
        en: "Communicate in English.",
        es: "Comunícate en Español. Mantén un tono profesional y premium.",
        pt: "Comunique-se em Português. Mantenha um tom profissional e premium.",
      };
      const langInstruction = langMap[language] || langMap.en;

      const ctx = context || {};
      const systemInstruction = `
You are the Remix OS AI Operator, a premium business intelligence system.
You are a proactive business advisor and operational assistant.

CRITICAL: ${langInstruction}

SYSTEM STATUS:
- Company: ${ctx.companyName} (${ctx.industry})
- Onboarding: ${ctx.onboardingCompleted ? 'COMPLETED' : 'IN PROGRESS'}
- User Role: ${ctx.userRole}

BUSINESS TELEMETRY:
- 30-Day Revenue: $${ctx.recentRevenue}
- Sales Trend: ${ctx.salesVelocity?.currentPeriodOrders} orders this week (${ctx.salesVelocity?.trend} vs last week)
- Inventory Risk: ${ctx.lowStockCount} items below threshold.
- Engagement: ${ctx.pendingReminders?.length || 0} urgent follow-ups pending.

OPERATIONAL PRINCIPLES:
1. OPERATIONAL FOCUS: Avoid conversational filler. Provide high-impact data analysis first.
2. INDUSTRY CONTEXT: Calibrate terminology to "${ctx.industry}".
3. PROACTIVE ADVICE: Prioritize critical risks and suggest specific drafted actions.
4. CUSTOMER ENGAGEMENT: Identify pending reminders and suggest follow-ups.
5. SECURITY PROTOCOL: Respect user roles.

COMMAND PROTOCOLS (MUST appear at the END of the response, on their own line):
- [COMMAND: NAVIGATE | /path] - ONLY for changing screens. Valid paths: /dashboard, /customers, /products, /inventory, /orders, /insights, /team, /settings.
- [COMMAND: OPEN_FILTER | module | payload] - For complex data views.
- [COMMAND: DRAFT_REPORT | summary] - When generating an analysis or report. (REVIEW_ONLY)
- [COMMAND: REVIEW_ONLY | summary] - For complex advice without automated path.
- [COMMAND: DRAFT_ORDER | details] - For preparing new orders.

CRITICAL RULES:
1. NEVER put long markdown reports inside [COMMAND: NAVIGATE].
2. If a customer needs a REMINDER, suggest it and tell the user to check the Customers module.
3. If there are messages in "draft" status, suggest reviewing them.

STRUCTURE: Use SUMMARY, STATUS REPORT, RECOMMENDATIONS, and [COMMANDS].
Maintain a professional, efficient, and supportive persona.`;

      const chat = ai.chats.create({
        model: "gemini-2.0-flash",
        history: Array.isArray(history) ? history : [],
        config: { systemInstruction },
      });
      const result = await chat.sendMessage({ message });
      res.json({ text: result.text ?? "" });
    } catch (err: any) {
      console.error("/api/ai/chat error:", err);
      res.status(500).json({ error: err?.message || "AI request failed" });
    }
  });

  // AI: Proactive Thoughts (Bot generates insights without user prompting)
  app.post("/api/ai/proactive-thoughts", async (req, res) => {
    try {
      const { context, language } = req.body || {};
      if (!context) return res.status(400).json({ error: "context required" });

      const ai = getGenAI();
      if (!ai) return res.status(503).json({ error: "AI not configured" });

      const langMap: Record<string, string> = {
        en: "Respond in English.",
        es: "Responde en Español. Sé directo y útil.",
        pt: "Responda em Português. Seja direto e útil.",
      };
      const langInstruction = langMap[language] || langMap.en;

      const topProductsText = (context.topProducts?.slice(0, 3) || [])
        .map((p: any, i: number) => (i + 1) + ". " + p.name + ": " + p.quantity + " sold ($" + p.revenue + ")")
        .join("\n") || "No data";

      const topCustomersText = (context.topCustomers?.slice(0, 3) || [])
        .map((c: any, i: number) => (i + 1) + ". " + c.name + ": $" + c.total + " total (" + c.count + " orders)")
        .join("\n") || "No data";

      const inventoryText = (context.inventoryStatus?.slice(0, 3) || [])
        .map((p: any) => "- " + p.name + ": " + p.stock + " units")
        .join("\n") || "All stock healthy";

      const salesTrend = context.salesVelocity?.trend === "up" ? "Increasing" : "Decreasing";

      const prompt = `You are the Remix OS AI Operator thinking about business insights in real-time.
Analyze the current business context and generate 1-2 specific, actionable insights.
Be direct, logical, and practical. Focus on what matters NOW.

CRITICAL: ${langInstruction}

CURRENT BUSINESS STATE:
- Company: ${context.companyName}
- Total Customers: ${context.customersCount}
- Total Products: ${context.productsCount}
- 7-Day Revenue: $${context.recentRevenue}
- Sales Trend: ${salesTrend} (${context.salesVelocity?.currentPeriodOrders} vs ${context.salesVelocity?.previousPeriodOrders} orders)
- Low Stock Items: ${context.lowStockCount}

TOP PERFORMERS:
${topProductsText}

TOP CUSTOMERS:
${topCustomersText}

LOW INVENTORY:
${inventoryText}

Generate HONEST, SPECIFIC insights based on real data. Examples:
- "Coca-Cola dominates with 250 units sold—increase stock by 20% next week to avoid shortages."
- "Your top customer Maria has not ordered in 2 weeks—follow up today with a special offer."
- "Mobile cases are sitting at 5 units but sell 30/week—critical restock needed ASAP."

Format: Return ONLY a JSON object with:
{ "insights": [ { "text": "specific insight", "priority": "high" or "medium" or "low" } ] }

NO markdown, NO preamble, just valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      if (!text) return res.json({ insights: [] });

      try {
        const parsed = JSON.parse(text);
        return res.json({ insights: parsed.insights || [] });
      } catch (e) {
        console.error("Proactive thoughts JSON parse error:", e);
        return res.json({ insights: [] });
      }
    } catch (err: any) {
      console.error("/api/ai/proactive-thoughts error:", err);
      res.status(500).json({ error: err?.message || "AI request failed" });
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
