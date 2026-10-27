import { supabase } from "./supabase";

export type AiReply = {
  scope: "in" | "out";
  answer: string;
  followup: string | null;
  chips: string[];
  action:
    | null
    | { type: "send_message"; to: string; body: string }
    | { type: "read_data"; source: string; why: string };
  memory: string | null;
};

function generateDemoReply(
  message: string,
  history: { role: "user" | "assistant"; text: string }[],
  scopeOff: boolean
): AiReply {
  const lower = message.toLowerCase();

  // 1. Explanation request
  if (/^\s*(explain|go deeper|tell me more)/i.test(message)) {
    return {
      scope: "in",
      answer: `## Deep Dive\n\nHere is a comprehensive breakdown:\n\n- **Core assumptions**: Everything operates on explicit permission and zero implicit data exposure.\n- **Trade-offs**: Prioritizing safety and clarity over unbounded autonomy.\n- **Unknowns**: Real-world external APIs require secure connector authorization tokens.\n\nLet me know which specific angle you'd like to explore next.`,
      followup: "Would you like me to draft an action plan?",
      chips: ["Draft action plan", "Summarize in 2 bullet points", "Move to next topic"],
      action: null,
      memory: null,
    };
  }

  // 2. Action triggers (messaging)
  if (lower.includes("send") || lower.includes("message") || lower.includes("email") || lower.includes("draft")) {
    const to = lower.includes("alex") ? "alex@example.com" : "contact@example.com";
    return {
      scope: "in",
      answer: `I have prepared a draft message for you. Before anything is sent, please review and approve the draft in the confirmation modal.`,
      followup: "You can edit the recipient or text before confirming.",
      chips: ["Looks good", "Change recipient", "Cancel"],
      action: {
        type: "send_message",
        to,
        body: `Hi,\n\nFollowing up on our discussion regarding the project milestones. Let me know when you are free to sync.\n\nBest regards,\nYour AI`,
      },
      memory: null,
    };
  }

  // 3. Action triggers (read private data)
  if (lower.includes("read") || lower.includes("file") || lower.includes("calendar") || lower.includes("drive") || lower.includes("access")) {
    return {
      scope: "in",
      answer: `To answer this accurately, I need permission to look at your private data source. Please review the access request.`,
      followup: null,
      chips: [],
      action: {
        type: "read_data",
        source: "Google Calendar & Drive",
        why: "To inspect schedule constraints and project documents",
      },
      memory: null,
    };
  }

  // 4. Memory suggestion trigger
  let memorySuggestion: string | null = null;
  if (lower.includes("prefer") || lower.includes("i like") || lower.includes("always")) {
    memorySuggestion = `Prefers: ${message.slice(0, 80)}`;
  }

  // 5. Out of context simulation if scope checking is active
  if (!scopeOff && (lower.includes("weather") || lower.includes("football") || lower.includes("recipe"))) {
    return {
      scope: "out",
      answer: `This topic appears unrelated to your active project context.`,
      followup: null,
      chips: [],
      action: null,
      memory: null,
    };
  }

  // Default conversational answer
  return {
    scope: "in",
    answer: `Here is what to consider:\n\n- **Target goals**: Keep the scope clearly defined and break it into measurable tasks.\n- **Action items**: Start with initial research, list required resources, and track progress.\n- **Next step**: Let me know if you would like to create a new task or explore specific criteria.`,
    followup: "Would you like me to add this to your active projects?",
    chips: ["Create a task for this", "Explain in more detail", "Make it concise"],
    action: null,
    memory: memorySuggestion,
  };
}

export async function askAi(
  message: string,
  history: { role: "user" | "assistant"; text: string }[],
  scopeOff: boolean
): Promise<AiReply> {
  const isDemo = localStorage.getItem("yai_demo") === "true";

  if (!isDemo) {
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { message, history, scopeOff },
      });
      if (!error && data && data.answer) {
        return data as AiReply;
      }
    } catch {
      // Fallback to demo generator if Supabase endpoint is not yet connected
    }
  }

  // Seamless fallback for local preview / demo testing
  return generateDemoReply(message, history, scopeOff);
}
