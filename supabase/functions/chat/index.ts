// Supabase Edge Function. The Gemini key lives only in server secrets.
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SYS = `You are "Your AI", a personal assistant. Rules:
1. Answer the user's question directly first.
2. Only if it adds real value, give ONE optional follow-up ("followup") and up to 3 short "chips". Never interview the user.
3. If the user writes "explain", expand your previous answer comprehensively: short headings, examples, assumptions, unknowns. If they ask for short, be short.
4. You have NO access to files, messages, apps or the internet. Never claim to have read or sent anything. For private data return action {"type":"read_data","source","why"}. To send a message or change something externally, draft it and return action {"type":"send_message","to","body"}; the app asks the user to approve.
5. If active projects are listed, scope checking is on, and the message is completely unrelated, return scope "out" with a one-line answer; else "in".
6. Don't invent facts; state uncertainty.
7. A durable preference worth remembering goes in "memory" (user must approve), else null.
Reply ONLY with JSON: {"scope":"in"|"out","answer":string,"followup":string|null,"chips":string[],"action":object|null,"memory":string|null}. Use **bold**, "- " lists and "## " headings only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const { message, history = [], scopeOff = false } = await req.json();
    if (typeof message !== "string" || !message.trim() || message.length > 4000) return json({ error: "bad_request" }, 400);
    // RLS scopes every query to this user.
    const [p, m, t] = await Promise.all([
      sb.from("profiles").select("name,style,goals").maybeSingle(),
      sb.from("memories").select("content").eq("active", true).limit(50),
      sb.from("tasks").select("title,notes").eq("use_as_context", true).eq("done", false).limit(20),
    ]);
    const ctx = `User: ${p.data?.name ?? "unknown"}. Style: ${p.data?.style ?? "balanced"}. Goals: ${p.data?.goals ?? "n/a"}.
Memories: ${(m.data ?? []).map((x) => x.content).join("; ") || "none"}.
Active projects: ${(t.data ?? []).map((x) => x.title + (x.notes ? ` (${x.notes})` : "")).join("; ") || "none"}.
Scope checking: ${scopeOff ? "off" : "on"}.`;
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash"; // verify the current model name
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: [
          ...history.slice(-10).map((h: { role: string; text: string }) => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: String(h.text).slice(0, 4000) }] })),
          { role: "user", parts: [{ text: `${ctx}\n\nUser: ${message}` }] },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
      }),
    });
    if (!r.ok) return json({ error: "upstream" }, 502);
    const j = await r.json();
    return json(JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"));
  } catch { return json({ error: "server" }, 500); }
});
