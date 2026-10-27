// Supabase Edge Function: execute-action
// Recomputes sha256 of payload and verifies against approved_hash and payload_hash.
// Refuses execution if hash mismatches or status is not 'approved'.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function canonicalPayload(payload: any): string {
  if (payload === null || typeof payload !== "object") {
    return JSON.stringify(payload);
  }
  if (Array.isArray(payload)) {
    return "[" + payload.map(canonicalPayload).join(",") + "]";
  }
  const keys = Object.keys(payload).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalPayload(payload[k])}`);
  return "{" + pairs.join(",") + "}";
}

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await sb.auth.getUser();

    if (userErr || !user) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json();
    const { actionId, payload } = body;

    if (!actionId || payload === undefined) {
      return json({ error: "bad_request", message: "Missing actionId or payload" }, 400);
    }

    // 1. Fetch pending action by ID scoped to current user
    const { data: action, error: fetchErr } = await sb
      .from("pending_actions")
      .select("*")
      .eq("id", actionId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !action) {
      return json({ error: "not_found", message: "Action not found" }, 404);
    }

    // 2. Action status check: must be 'approved'
    if (action.status !== "approved") {
      return json(
        {
          error: "forbidden",
          message: `Action status is '${action.status}', must be 'approved' to execute`,
        },
        400
      );
    }

    // 3. Recompute hash of the received payload
    const canonicalStr = canonicalPayload(payload);
    const computedHash = await sha256(canonicalStr);

    // 4. Verify recomputed hash matches approved_hash and payload_hash
    if (computedHash !== action.approved_hash || computedHash !== action.payload_hash) {
      // Log tampering attempt or payload discrepancy
      await sb.from("activity_logs").insert({
        user_id: user.id,
        action: `Execution rejected: hash mismatch for ${action.type}`,
        detail: {
          actionId,
          type: action.type,
          computedHash,
          approved_hash: action.approved_hash,
          payload_hash: action.payload_hash,
        },
      });

      return json(
        {
          error: "tampered_payload",
          message: "Payload hash does not match approved hash. Execution refused.",
        },
        400
      );
    }

    // 5. Execute action (simulate external dispatch or connector read)
    let executionResult: any = null;
    if (action.type === "send_message") {
      executionResult = {
        sent: true,
        to: payload.to,
        body: payload.body,
        simulated: true,
        timestamp: new Date().toISOString(),
      };
    } else if (action.type === "read_data") {
      executionResult = {
        read: true,
        source: payload.source,
        why: payload.why,
        simulated: true,
        timestamp: new Date().toISOString(),
      };
    }

    // 6. Update action status to 'executed'
    const { error: updateErr } = await sb
      .from("pending_actions")
      .update({ status: "executed" })
      .eq("id", actionId);

    if (updateErr) throw updateErr;

    // 7. Append audit log entry
    await sb.from("activity_logs").insert({
      user_id: user.id,
      action:
        action.type === "send_message"
          ? `Executed message to ${payload.to} (version ${computedHash.slice(0, 8)})`
          : `Executed access to ${payload.source}`,
      detail: {
        actionId,
        type: action.type,
        payload,
        result: executionResult,
      },
    });

    return json({
      success: true,
      actionId,
      status: "executed",
      result: executionResult,
    });
  } catch (err: any) {
    return json({ error: "server", message: err?.message ?? "Execution failed" }, 500);
  }
});
