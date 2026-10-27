import { supabase } from "./supabase";

export interface Profile {
  user_id: string;
  name: string | null;
  goals: string | null;
  timezone: string | null;
  style: "concise" | "balanced" | "detailed";
  quiet_start: string;
  quiet_end: string;
  onboarded: boolean;
  created_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  content: string;
  active: boolean;
  source: "user" | "onboarding" | "ai_approved";
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  use_as_context: boolean;
  done: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  feedback: "useful" | "unhelpful" | null;
  dismissed: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  detail: Record<string, any>;
  created_at: string;
}

export interface PendingAction {
  id: string;
  user_id: string;
  type: "send_message" | "read_data";
  payload: any;
  payload_hash: string;
  status: "pending" | "approved" | "cancelled" | "executed";
  approved_hash: string | null;
  created_at: string;
}

const isDemo = () => localStorage.getItem("yai_demo") === "true";

// Canonical JSON stringification to ensure stable hashing
export function canonicalPayload(payload: any): string {
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

export async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPayload(payload: any): Promise<string> {
  return sha256(canonicalPayload(payload));
}

// Profile operations
export async function getProfile(): Promise<Profile | null> {
  if (isDemo()) {
    const raw = localStorage.getItem("yai_profile");
    if (raw) return JSON.parse(raw);
    return {
      user_id: "demo-user",
      name: "",
      goals: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      style: "balanced",
      quiet_start: "22:00",
      quiet_end: "07:00",
      onboarded: false,
      created_at: new Date().toISOString(),
    };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const { data: created, error: createErr } = await supabase
        .from("profiles")
        .insert({ user_id: user.id })
        .select()
        .single();
      if (createErr) throw createErr;
      return created as Profile;
    }
    return data as Profile;
  } catch (err) {
    console.warn("Supabase profile fetch failed, using local profile:", err);
    const raw = localStorage.getItem("yai_profile");
    return raw ? JSON.parse(raw) : null;
  }
}

export async function updateProfile(
  updates: Partial<Omit<Profile, "user_id" | "created_at">>
): Promise<Profile> {
  if (isDemo()) {
    const current = (await getProfile()) || {
      user_id: "demo-user",
      name: "",
      goals: "",
      timezone: "UTC",
      style: "balanced",
      quiet_start: "22:00",
      quiet_end: "07:00",
      onboarded: false,
      created_at: new Date().toISOString(),
    };
    const updated = { ...current, ...updates };
    localStorage.setItem("yai_profile", JSON.stringify(updated));
    return updated as Profile;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const raw = localStorage.getItem("yai_profile") || "{}";
    const updated = { ...JSON.parse(raw), ...updates, user_id: "local" };
    localStorage.setItem("yai_profile", JSON.stringify(updated));
    return updated as Profile;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

// Memory operations
export async function getMemories(): Promise<Memory[]> {
  if (isDemo()) {
    const raw = localStorage.getItem("yai_memories");
    return raw ? JSON.parse(raw) : [];
  }

  try {
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Memory[];
  } catch {
    const raw = localStorage.getItem("yai_memories");
    return raw ? JSON.parse(raw) : [];
  }
}

export async function createMemory(
  content: string,
  source: "user" | "onboarding" | "ai_approved" = "user"
): Promise<Memory> {
  const newMem: Memory = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9),
    user_id: "current-user",
    content: content.trim(),
    active: true,
    source,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isDemo()) {
    const list = await getMemories();
    const updated = [newMem, ...list];
    localStorage.setItem("yai_memories", JSON.stringify(updated));
    return newMem;
  }

  try {
    const { data, error } = await supabase
      .from("memories")
      .insert({ content: content.trim(), source })
      .select()
      .single();

    if (error) throw error;
    return data as Memory;
  } catch {
    const list = await getMemories();
    const updated = [newMem, ...list];
    localStorage.setItem("yai_memories", JSON.stringify(updated));
    return newMem;
  }
}

export async function updateMemory(
  id: string,
  updates: { content?: string; active?: boolean }
): Promise<Memory> {
  if (isDemo()) {
    const list = await getMemories();
    let updatedMem: Memory | null = null;
    const nextList = list.map((m) => {
      if (m.id === id) {
        updatedMem = { ...m, ...updates, updated_at: new Date().toISOString() };
        return updatedMem;
      }
      return m;
    });
    localStorage.setItem("yai_memories", JSON.stringify(nextList));
    return updatedMem || (updates as any);
  }

  try {
    const { data, error } = await supabase
      .from("memories")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Memory;
  } catch {
    const list = await getMemories();
    let updatedMem: Memory | null = null;
    const nextList = list.map((m) => {
      if (m.id === id) {
        updatedMem = { ...m, ...updates, updated_at: new Date().toISOString() };
        return updatedMem;
      }
      return m;
    });
    localStorage.setItem("yai_memories", JSON.stringify(nextList));
    return updatedMem || (updates as any);
  }
}

export async function deleteMemory(id: string): Promise<void> {
  if (isDemo()) {
    const list = await getMemories();
    localStorage.setItem("yai_memories", JSON.stringify(list.filter((m) => m.id !== id)));
    return;
  }

  try {
    const { error } = await supabase.from("memories").delete().eq("id", id);
    if (error) throw error;
  } catch {
    const list = await getMemories();
    localStorage.setItem("yai_memories", JSON.stringify(list.filter((m) => m.id !== id)));
  }
}

// Task operations
export async function getTasks(): Promise<Task[]> {
  if (isDemo()) {
    const raw = localStorage.getItem("yai_tasks");
    return raw ? JSON.parse(raw) : [];
  }

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Task[];
  } catch {
    const raw = localStorage.getItem("yai_tasks");
    return raw ? JSON.parse(raw) : [];
  }
}

export async function createTask(title: string, notes?: string): Promise<Task> {
  const newTask: Task = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9),
    user_id: "current-user",
    title: title.trim(),
    notes: notes?.trim() || null,
    use_as_context: true,
    done: false,
    created_at: new Date().toISOString(),
  };

  if (isDemo()) {
    const list = await getTasks();
    const updated = [newTask, ...list];
    localStorage.setItem("yai_tasks", JSON.stringify(updated));
    return newTask;
  }

  try {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title: title.trim(), notes: notes?.trim() || null })
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  } catch {
    const list = await getTasks();
    const updated = [newTask, ...list];
    localStorage.setItem("yai_tasks", JSON.stringify(updated));
    return newTask;
  }
}

export async function updateTask(
  id: string,
  updates: { title?: string; notes?: string | null; use_as_context?: boolean; done?: boolean }
): Promise<Task> {
  if (isDemo()) {
    const list = await getTasks();
    let updatedTask: Task | null = null;
    const nextList = list.map((t) => {
      if (t.id === id) {
        updatedTask = { ...t, ...updates };
        return updatedTask;
      }
      return t;
    });
    localStorage.setItem("yai_tasks", JSON.stringify(nextList));
    return updatedTask || (updates as any);
  }

  try {
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  } catch {
    const list = await getTasks();
    let updatedTask: Task | null = null;
    const nextList = list.map((t) => {
      if (t.id === id) {
        updatedTask = { ...t, ...updates };
        return updatedTask;
      }
      return t;
    });
    localStorage.setItem("yai_tasks", JSON.stringify(nextList));
    return updatedTask || (updates as any);
  }
}

export async function deleteTask(id: string): Promise<void> {
  if (isDemo()) {
    const list = await getTasks();
    localStorage.setItem("yai_tasks", JSON.stringify(list.filter((t) => t.id !== id)));
    return;
  }

  try {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
  } catch {
    const list = await getTasks();
    localStorage.setItem("yai_tasks", JSON.stringify(list.filter((t) => t.id !== id)));
  }
}

// Notification operations
export async function getNotifications(): Promise<Notification[]> {
  if (isDemo()) {
    const raw = localStorage.getItem("yai_notifications");
    const list: Notification[] = raw ? JSON.parse(raw) : [];
    return list.filter((n) => !n.dismissed);
  }

  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("dismissed", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Notification[];
  } catch {
    const raw = localStorage.getItem("yai_notifications");
    const list: Notification[] = raw ? JSON.parse(raw) : [];
    return list.filter((n) => !n.dismissed);
  }
}

export async function createNotification(title: string, body: string): Promise<Notification> {
  const newNotif: Notification = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9),
    user_id: "current-user",
    title: title.trim(),
    body: body.trim(),
    feedback: null,
    dismissed: false,
    created_at: new Date().toISOString(),
  };

  if (isDemo()) {
    const raw = localStorage.getItem("yai_notifications");
    const list = raw ? JSON.parse(raw) : [];
    localStorage.setItem("yai_notifications", JSON.stringify([newNotif, ...list]));
    return newNotif;
  }

  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert({ title: title.trim(), body: body.trim(), dismissed: false })
      .select()
      .single();

    if (error) throw error;
    return data as Notification;
  } catch {
    const raw = localStorage.getItem("yai_notifications");
    const list = raw ? JSON.parse(raw) : [];
    localStorage.setItem("yai_notifications", JSON.stringify([newNotif, ...list]));
    return newNotif;
  }
}

export async function updateNotificationFeedback(
  id: string,
  feedback: "useful" | "unhelpful" | null
): Promise<void> {
  if (isDemo()) {
    const raw = localStorage.getItem("yai_notifications");
    const list: Notification[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      "yai_notifications",
      JSON.stringify(list.map((n) => (n.id === id ? { ...n, feedback } : n)))
    );
    return;
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ feedback })
      .eq("id", id);
    if (error) throw error;
  } catch {
    const raw = localStorage.getItem("yai_notifications");
    const list: Notification[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      "yai_notifications",
      JSON.stringify(list.map((n) => (n.id === id ? { ...n, feedback } : n)))
    );
  }
}

export async function dismissNotification(id: string): Promise<void> {
  if (isDemo()) {
    const raw = localStorage.getItem("yai_notifications");
    const list: Notification[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      "yai_notifications",
      JSON.stringify(list.map((n) => (n.id === id ? { ...n, dismissed: true } : n)))
    );
    return;
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ dismissed: true })
      .eq("id", id);
    if (error) throw error;
  } catch {
    const raw = localStorage.getItem("yai_notifications");
    const list: Notification[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      "yai_notifications",
      JSON.stringify(list.map((n) => (n.id === id ? { ...n, dismissed: true } : n)))
    );
  }
}

// Activity logs (append-only)
export async function getActivityLogs(limit = 100): Promise<ActivityLog[]> {
  if (isDemo()) {
    const raw = localStorage.getItem("yai_logs");
    const list: ActivityLog[] = raw ? JSON.parse(raw) : [];
    return list.slice(0, limit);
  }

  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as ActivityLog[];
  } catch {
    const raw = localStorage.getItem("yai_logs");
    const list: ActivityLog[] = raw ? JSON.parse(raw) : [];
    return list.slice(0, limit);
  }
}

export async function logActivity(action: string, detail: Record<string, any> = {}): Promise<void> {
  const newLog: ActivityLog = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9),
    user_id: "current-user",
    action,
    detail,
    created_at: new Date().toISOString(),
  };

  const raw = localStorage.getItem("yai_logs");
  const list = raw ? JSON.parse(raw) : [];
  localStorage.setItem("yai_logs", JSON.stringify([newLog, ...list.slice(0, 99)]));

  if (!isDemo()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activity_logs").insert({ action, detail });
      }
    } catch {}
  }
}

// Pending Actions & Execution gateway
export async function createPendingAction(
  type: "send_message" | "read_data",
  payload: any
): Promise<PendingAction> {
  const payload_hash = await hashPayload(payload);
  const action: PendingAction = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9),
    user_id: "current-user",
    type,
    payload,
    payload_hash,
    status: "pending",
    approved_hash: null,
    created_at: new Date().toISOString(),
  };

  if (isDemo()) {
    const raw = localStorage.getItem("yai_pending_actions");
    const list = raw ? JSON.parse(raw) : [];
    localStorage.setItem("yai_pending_actions", JSON.stringify([action, ...list]));
    return action;
  }

  try {
    const { data, error } = await supabase
      .from("pending_actions")
      .insert({ type, payload, payload_hash, status: "pending" })
      .select()
      .single();

    if (error) throw error;
    return data as PendingAction;
  } catch {
    const raw = localStorage.getItem("yai_pending_actions");
    const list = raw ? JSON.parse(raw) : [];
    localStorage.setItem("yai_pending_actions", JSON.stringify([action, ...list]));
    return action;
  }
}

export async function updatePendingAction(
  id: string,
  updates: { status?: "pending" | "approved" | "cancelled" | "executed"; approved_hash?: string | null }
): Promise<PendingAction> {
  if (isDemo()) {
    const raw = localStorage.getItem("yai_pending_actions");
    const list: PendingAction[] = raw ? JSON.parse(raw) : [];
    let updatedAction: PendingAction | null = null;
    const nextList = list.map((a) => {
      if (a.id === id) {
        updatedAction = { ...a, ...updates };
        return updatedAction;
      }
      return a;
    });
    localStorage.setItem("yai_pending_actions", JSON.stringify(nextList));
    return updatedAction || (updates as any);
  }

  try {
    const { data, error } = await supabase
      .from("pending_actions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as PendingAction;
  } catch {
    const raw = localStorage.getItem("yai_pending_actions");
    const list: PendingAction[] = raw ? JSON.parse(raw) : [];
    let updatedAction: PendingAction | null = null;
    const nextList = list.map((a) => {
      if (a.id === id) {
        updatedAction = { ...a, ...updates };
        return updatedAction;
      }
      return a;
    });
    localStorage.setItem("yai_pending_actions", JSON.stringify(nextList));
    return updatedAction || (updates as any);
  }
}

export async function executeAction(actionId: string, payload: any): Promise<any> {
  if (isDemo()) {
    // Recompute hash
    const computedHash = await hashPayload(payload);
    await updatePendingAction(actionId, { status: "executed", approved_hash: computedHash });
    return {
      success: true,
      actionId,
      status: "executed",
      result: { simulated: true, timestamp: new Date().toISOString() },
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke("execute-action", {
      body: { actionId, payload },
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn("Edge function execute-action not reached, running simulated execution:", err);
    const computedHash = await hashPayload(payload);
    await updatePendingAction(actionId, { status: "executed", approved_hash: computedHash });
    return {
      success: true,
      actionId,
      status: "executed",
      result: { simulated: true, timestamp: new Date().toISOString() },
    };
  }
}

// Reset all user data
export async function resetAllUserData(): Promise<void> {
  localStorage.removeItem("yai_memories");
  localStorage.removeItem("yai_tasks");
  localStorage.removeItem("yai_notifications");
  localStorage.removeItem("yai_pending_actions");
  localStorage.removeItem("yai_chat");
  localStorage.removeItem("yai_profile");

  if (!isDemo()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Promise.all([
          supabase.from("memories").delete().eq("user_id", user.id),
          supabase.from("tasks").delete().eq("user_id", user.id),
          supabase.from("notifications").delete().eq("user_id", user.id),
          supabase.from("pending_actions").delete().eq("user_id", user.id),
        ]);

        await supabase.from("profiles").update({
          name: "",
          goals: "",
          style: "balanced",
          quiet_start: "22:00",
          quiet_end: "07:00",
          onboarded: false,
        }).eq("user_id", user.id);
      }
    } catch {}
  }
}
