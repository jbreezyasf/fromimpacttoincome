# From Impact to Income podcast setup

The feature branch includes the episode editor, guest intake, published episode pages, server-rendered podcast pages, sitemap, structured data, and article drafting. It is intentionally not production ready until these steps pass.

1. Provision a dedicated Supabase project. Apply `supabase/migrations/20260929000000_podcast.sql`. Configure Supabase Auth email magic links and allow redirect to `https://fromimpacttoincome.com/podcast/admin`.
2. Create Juanita's auth user by signing in, then grant admin from the SQL editor: `insert into public.podcast_admins(user_id) select id from auth.users where email = '<Juanita's chosen admin email>';` Substitute the real address. Do not add a public admin registration path.
3. Set Vercel environment variables from `.env.example` for this project. `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `RESEND_API_KEY` are server-only. Vite variables are public. Add `SUPABASE_ANON_KEY` server-side too for server-rendered episode pages; it may match `VITE_SUPABASE_ANON_KEY`.
4. Verify `fromimpacttoincome.com` in the email provider, set `EMAIL_FROM` to a verified sender, and create or forward `guest@fromimpacttoincome.com` to Juanita's inbox. Sending from an address does not provision a mailbox.
5. Verify the deployed guest form with a permitted headshot and assert the database row, private image, and received email; sign in as Juanita and confirm other accounts cannot read drafts or submissions. Publish a test episode and inspect its source HTML, JSON-LD, canonical URL, `/sitemap.xml`, video embed, and mobile layout.

A YouTube URL embeds the video. The article generator requires a pasted transcript or detailed notes (100+ characters); it will not claim access to captions it cannot retrieve. Review all AI copy before publishing. Direct media upload uses TUS resumable chunks up to 500 MB; verify the project storage size limit and test a representative large video before launch. The guest URL is unlisted rather than access-controlled; share it privately, and add a token gate if guest-only access is required.
