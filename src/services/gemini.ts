import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateBusinessInsights(businessData: any) {
  const prompt = `
    You are an expert business consultant for Remix OS. 
    Analyze the following small business data and provide a set of actionable insights.
    
    Business: ${businessData.companyName} (${businessData.industry})
    Current Plan: ${businessData.planLevel}
    Onboarding: ${businessData.onboardingCompleted ? 'COMPLETE' : 'INCOMPLETE/PENDING'}
    Total Customers: ${businessData.customersCount}
    Total Products: ${businessData.productsCount}
    Revenue (Last 30 Days): $${businessData.recentRevenue.toFixed(2)}
    Growth vs Prev Period: ${businessData.growth}%
    Top Products: ${JSON.stringify(businessData.topProducts)}
    Low Stock Items: ${JSON.stringify(businessData.lowStockItems)}
    Top Customers: ${JSON.stringify(businessData.topCustomers)}
    
    Constraint based on Plan:
    - If plan is "starter": Provide basic observations and straightforward advice.
    - If plan is "pro": Provide deeper analysis, identifying subtle patterns and market opportunities.
    - If plan is "business": Provide highly strategic, comprehensive directives, including predictive forecasting and custom growth blueprints.
    
    You MUST return the output as a JSON array of insight objects. 
    Each object MUST have:
    - title: (string) short and punchy
    - explanation: (string) 1-2 sentences
    - type: (string) "opportunity", "risk", "efficiency", "growth"
    - severity: (string) "info", "success", "warning", "critical"
    - recommendation: (string) 1 specific next action (e.g., "Reorder Product X", "Email Customer Y")

    Return ONLY the valid JSON array. No markdown, no preamble.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const text = response.text;
    // Strip potential markdown code blocks
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return null;
  }
}

export async function chatCopilot(message: string, history: any[], context: any) {
  const systemInstruction = `
    You are the Remix OS AI Operator, a premium business intelligence system.
    You are a proactive business advisor and operational assistant.
    
    SYSTEM STATUS:
    - Company: ${context.companyName} (${context.industry})
    - Onboarding: ${context.onboardingCompleted ? 'COMPLETED' : 'IN PROGRESS'}
    - User Role: ${context.userRole}
    
    BUSINESS TELEMETRY:
    - 30-Day Revenue: $${context.recentRevenue}
    - Sales Trend: ${context.salesVelocity.currentPeriodOrders} orders this week (${context.salesVelocity.trend} vs last week)
    - Inventory Risk: ${context.lowStockCount} items below threshold.
    - Engagement: ${context.pendingReminders?.length || 0} urgent follow-ups pending.
    
    OPERATIONAL PRINCIPLES:
    1. OPERATIONAL FOCUS: Avoid conversational filler. Provide high-impact data analysis first.
    2. INDUSTRY CONTEXT: Calibrate terminology to "${context.industry}". 
    3. PROACTIVE ADVICE: Prioritize critical risks (e.g. inventory or low sales) and suggest specific drafted actions.
    4. CUSTOMER ENGAGEMENT: Identify if customers have PENDING REMINDERS (follow_up, payment, order, reactivation). Suggest specific follow-up actions if a client is at risk.
    5. SECURITY PROTOCOL: Respect user roles.
    
    COMMAND PROTOCOLS (MUST follow exactly):
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
    Maintain a professional, efficient, and supportive persona.
  `;

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      history: history,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const result = await chat.sendMessage({ message: message });
    return result.text;
  } catch (error) {
    console.error("Copilot Chat Error:", error);
    return "I encountered a connection error. Please try again in a moment.";
  }
}
