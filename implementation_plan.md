# Implementation plan: Your AI

**Already done:** database schema + RLS (`supabase/migrations/0001_init.sql`), the server-side AI endpoint (`supabase/functions/chat`), Vite/React/Tailwind scaffold with design tokens, Supabase client and `askAi()`.
**Reference UI:** `reference/prototype.html` is a working single-file prototype of every screen and behavior. Port it; keep its behavior exactly.

## File structure (target)
```
src/
  lib/{supabase.ts, ai.ts, data.ts}      # data.ts: typed CRUD for each table + logActivity()
  components/{AppShell, Sidebar, Composer, Message, ConfirmModal, PermissionModal}.tsx
  pages/{Auth, Onboarding, Chat, Memory, Tasks, Inbox, Profile}.tsx
supabase/{migrations, functions/chat}
```

## Steps
1. **Auth.** Email sign-in with Supabase Auth; gate the app on a session. New users get a `profiles` row via trigger; send them to Onboarding until `onboarded = true`.
2. **Onboarding.** Save name, style, goals, timezone, quiet hours to `profiles`; add `onboarding` memories for style and goals.
3. **Chat.** Port message rendering, chips, the Explain button, "Out of context" notice (New topic / Continue project), and error + retry. Call `askAi()` only; the browser never sees the Gemini key. Persisting chat history is optional for v1.
4. **Memory Center.** CRUD on `memories`; toggle `active`; AI-suggested memories are saved only when the user clicks Save (`source = 'ai_approved'`).
5. **Tasks.** CRUD on `tasks`; `use_as_context` and `done` drive the chat scope.
6. **Inbox.** Briefings in `notifications` (created on request, respect quiet hours), Useful / Unhelpful writes `feedback`; Activity tab reads `activity_logs`.
7. **Confirmation gateway.** When `askAi()` returns an `action`: insert a `pending_actions` row with `payload_hash = sha256(payload)`, show the modal, and on Approve set `approved_hash` and `status = 'approved'`. Execution (new Edge Function `execute-action`) must recompute the hash and refuse on mismatch. Editing the draft creates a new pending row. Log every step to `activity_logs`.
8. **Polish.** Responsive drawer, light/dark toggle (`dark` class), focus states, `aria-live` loading text, reduced motion.

## Edge cases to test
- User A cannot read or write user B's rows (try with two accounts).
- "explain" expands the previous answer; "make it short" shortens it.
- Unrelated question with an active project shows "Out of context"; "New topic" re-asks it.
- Editing a draft after approval forces a new approval; a tampered payload is rejected server-side.
- Revoking or denying access leaves a log entry and nothing is read.
- Failed AI request keeps the user's message and offers retry.
