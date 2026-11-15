# Setup guide

About 30 minutes, once. Everything here is free except the AI key (a few dollars a month at most).
**Never paste passwords or keys into a chat.** They only go into the private settings pages below.

You'll create these values along the way. Keep a note open (Apple Notes locked note or a password manager):

| Name | Where it comes from |
|---|---|
| `DATABASE_URL` | Step 1 (Supabase) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SESSION_SECRET`, `ENCRYPTION_KEY` | Step 2 (generated for you) |
| `APP_PASSWORD` | You make it up: the password you'll use to open the app |
| `YAHOO_EMAIL`, `YAHOO_APP_PASSWORD` | Step 3 (Yahoo) |
| `ANTHROPIC_API_KEY` | Step 4 |

---

## 1. Database (Supabase, free)

1. Go to **supabase.com** → Start your project → sign in with GitHub.
2. **New project**. Name it `ops-manager`, make up a database password (save it), pick a US Central/East region → Create.
3. When it's ready: left menu **SQL Editor** → New query. Open [`db/schema.sql`](db/schema.sql) in this repo, copy all of it, paste, click **Run**. You should see "Success".
4. Top of the page click **Connect** → **Transaction pooler** → copy the URI. Replace `[YOUR-PASSWORD]` in it with your database password. That's your `DATABASE_URL`.

## 2. Generate keys

1. In this GitHub repo → **Actions** tab → if asked, click "I understand my workflows, enable them".
2. Left side: **Generate keys (one time)** → **Run workflow** → Run.
3. Open the run → open the `keys` job → expand the last step. Copy the four lines (`VAPID_PUBLIC_KEY=…`, `VAPID_PRIVATE_KEY=…`, `SESSION_SECRET=…`, `ENCRYPTION_KEY=…`) into your note.
4. Back on the run page: **…** (top right) → **Delete workflow run**.

## 3. Yahoo app password

1. Go to **login.yahoo.com/account/security** (Yahoo → Account Info → Account Security).
2. Click **Generate app password** (or "Generate and manage app passwords").
3. Name it `Ops Manager` → Generate. Copy the 16-letter password. That's `YAHOO_APP_PASSWORD`. Your normal Yahoo address is `YAHOO_EMAIL`.

This password only works for mail access, not your Yahoo account settings. The app opens your inbox **read-only** and has no way to send. You can revoke it on the same page anytime, and the next rundown will say it couldn't read your inbox.

## 4. AI key (Anthropic)

1. Go to **console.anthropic.com** → sign up → **Billing**: add a card and buy $5 of credit (that should last months).
2. **Settings → Limits**: set a monthly spend limit, for example $10.
3. **API Keys → Create Key** → name it `ops-manager` → copy it. That's `ANTHROPIC_API_KEY`.

## 5. GitHub Secrets (for the 3x-a-day mail check)

In this repo → **Settings** → **Secrets and variables** → **Actions**.

**Secrets** tab → **New repository secret**, one at a time:

- `DATABASE_URL`
- `YAHOO_EMAIL`
- `YAHOO_APP_PASSWORD`
- `ANTHROPIC_API_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

(You'll add `APP_URL` under the **Variables** tab after step 6.)

## 6. Host the app (Vercel, free)

1. Go to **vercel.com** → sign up with GitHub.
2. **Add New → Project** → import **Ops-Manager**.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `DATABASE_URL`
   - `APP_PASSWORD` (the one you made up)
   - `SESSION_SECRET`
   - `ENCRYPTION_KEY`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - Optional, only if you want the **Check mail now** button: `YAHOO_EMAIL`, `YAHOO_APP_PASSWORD`, `ANTHROPIC_API_KEY`
4. **Deploy**. Copy the site address it gives you (like `https://ops-manager-xyz.vercel.app`).
5. Back in GitHub → Settings → Secrets and variables → Actions → **Variables** tab → New variable: `APP_URL` = that address.

## 7. Put it on your iPhone and turn on notifications

1. Open the site address in **Safari** → sign in with `APP_PASSWORD`.
2. Tap **Share** → **Add to Home Screen** → Add.
3. Open **Ops** from the home screen icon (this matters on iPhone) → **Settings** tab → **Turn on notifications** → Allow → **Send a test**.

## 8. First run

GitHub → **Actions** → **Rundown** → **Run workflow**. In a minute or two you should get a notification, and the rundown shows on the Today tab. The first run looks back 24 hours; after that each run covers only mail since the last one.

From then on it runs by itself at **6 AM, 11 AM and 3 PM Central**, every day.

---

### If something goes wrong

- **"Couldn't read your inbox"**: the Yahoo app password was revoked or mistyped. Make a new one (step 3) and update the `YAHOO_APP_PASSWORD` secret.
- **No notification**: open the app from the home screen icon → Settings → Turn on notifications again → Send a test. Rundowns are still saved under History.
- **A sender keeps showing up that shouldn't**: Settings → Skip list → add the domain.
- **Costs**: Supabase, Vercel and GitHub Actions are free at this size. The AI step reads only new, non-skipped mail on a small, cheap model, typically well under $5/month.
