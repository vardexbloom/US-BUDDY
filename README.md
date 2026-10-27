# Your AI

A personal proactive AI: answers first, one optional follow-up, "explain" for depth, explicit access, confirmation before any external action.

## Run it
1. `npm install`
2. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_init.sql` (or `supabase db push`).
3. `cp .env.example .env` and fill in your project URL and anon key (the anon key is public by design; RLS protects the data).
4. Deploy the AI endpoint:
   ```
   supabase login && supabase link --project-ref YOUR_REF
   supabase secrets set GEMINI_API_KEY=your-key
   supabase functions deploy chat
   ```
   Set `GEMINI_MODEL` as a secret if you want a different model (check the current model name in Google's docs).
5. `npm run dev`

## Status
Backend (schema, RLS, chat function) and scaffold are done. UI screens still need to be ported: follow `implementation_plan.md` using `reference/prototype.html`. The `execute-action` function for approved actions is also still to write.

## Security notes
The Gemini key exists only as a Supabase secret. All tables use RLS (`auth.uid() = user_id`); `activity_logs` is append-only.
