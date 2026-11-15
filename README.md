# Ops Manager

A private, phone-friendly operations manager for a busy dad. Three times a day it reads new Yahoo mail (read-only), skips promos and construction bid invites, pulls out bills, declines, account alerts, school items, deliveries, appointments and recruiter mail, updates the trackers, and sends a push notification with a three-part rundown: **Needs you today**, **Coming up**, **FYI**.

**Start here: [SETUP.md](SETUP.md)**

## What's inside

| Part | Where |
|---|---|
| Web app (Next.js, installable on iPhone) | `app/`, `components/` |
| Scheduled mail job (GitHub Actions, 6 AM / 11 AM / 3 PM Central) | `.github/workflows/rundown.yml`, `job/` |
| Database tables | `db/schema.sql` |
| Tests (fake mailbox, no real mail or AI needed) | `test/` |

## Rules the code enforces

- **Read-only.** The inbox is opened with IMAP EXAMINE (read-only). There are no sending credentials and no code that sends email, pays bills or changes accounts.
- **Never "paid" or "missed" from one source.** Bills from email are always saved as *Unconfirmed*. Only a tap on *Verify status* with "I checked the biller's or bank's site" ticked changes it, and a later email never overrides what you verified.
- **Only new mail.** The job stores the last processed message ID and moves it forward only after everything is saved, so a failed run never loses mail.
- **Inbox can't be read → says so.** The rundown and the notification lead with "Couldn't read your inbox" and the reason.
- **Secrets.** The Yahoo app password and AI key live in GitHub encrypted secrets. Logins saved in the app are AES-256-GCM encrypted and never shown again.
- **Low cost.** Skip rules run before any AI call; the AI step batches new mail on a small model (`AI_MODEL`, default `claude-haiku-5-5`).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in
npm run db:migrate
npm run dev
# Run the mail job once against the fake mailbox:
MAIL_SOURCE=fixture EXTRACTOR=fake FORCE=1 npm run rundown
# Tests (needs a throwaway Postgres):
TEST_DATABASE_URL=postgres://... npm test
```
