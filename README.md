# NeoSpark Toilet Management System (`toilet.neospark.tech`)

Real-time restroom status tracking, supply replenishment alerts, washroom analytics, and stale-status detection for NeoSpark.

---

## 🚀 Features Added

### 1. Supplies Tracking (Feature A)
- **Public Reporting:** Anyone can report missing or empty washroom supplies without creating an account or logging in.
- **Supported Categories:** Soap, Toilet paper, Paper towels, Hand sanitizer, Other.
- **Restroom Selection:** Men's Toilet or Women's Toilet.
- **Severity Levels:** Normal (Low supply) or Urgent (Empty/Critical).
- **Public Home Page Summary:** Compact **Supply Issues** section showing active unresolved issues (`pending` or `in_progress`), severity badges, restroom names, and relative timestamps with Nepal time (`Asia/Kathmandu`).
- **Privacy Protection:** Client IP addresses, raw user-agent strings, and internal audit details are strictly excluded from public responses.
- **Management Console (`/admin`):**
  - Filter supply reports by restroom, category, severity, status, or archive state.
  - Update report status (Pending → In Progress → Resolved).
  - Add resolution notes (e.g., "Replenished 3 bottles of antibacterial soap").
  - Reopen resolved tickets if needed.
  - Archive or permanently delete records with confirmation safeguards.
  - All management modifications are recorded in `admin_audit_logs`.

### 2. Analytics Dashboard on Home Page (Feature B)
- Directly integrated into the main landing page (`/`) below the restroom cards.
- **Time Filters:** `Today`, `Last 7 days`, `Last 30 days`.
- **Nepal Standard Time:** Fully grouped and calculated in `Asia/Kathmandu` (UTC+05:45), correctly handling midnight day boundaries and 00:00–23:00 hourly buckets.
- **5 Real-time Metric Cards:**
  1. **Total status changes:** Count of genuine status change events in the selected period.
  2. **Occupied reports:** Number of times a restroom transitioned into the `occupied` state during the period.
  3. **Maintenance reports:** Number of transitions into `maintenance`.
  4. **Unresolved supply issues:** Current count of active unresolved reports (`pending` or `in_progress`) — independent of the date filter.
  5. **Cleaning completion:** Percentage of scheduled daily cleaning tasks completed.
- **Interactive & Accessible Charts:**
  - **Daily status activity:** Daily breakdown of total status changes vs occupied transitions.
  - **Occupied reports by hour:** Distribution of transitions to occupied from 00:00 to 23:00 NPT.
  - **Restroom comparison:** Men's vs Women's restrooms status updates and occupied events.
  - **Recurring supply problems:** Breakdown by supply category and restroom.
  - **Maintenance frequency:** Frequency of maintenance reports over time.
- **Transparency Notice:** Clearly labeled: *“Based on reported status changes, not verified toilet usage.”*

### 3. Stale-Status Detection (Feature C)
- Automatically derives a **Needs verification** display state when a restroom's status has not been updated within a configurable threshold.
- **Configurable Freshness Threshold:** Configured via `STATUS_FRESHNESS_MINUTES` (defaults to `60` minutes).
- **Safe State Derivation:**
  - Old occupied or available states display a distinct dashed amber visual indicator with the explanation: *"No status update recently; please verify before use."*
  - **Never** automatically alters database records or marks occupied toilets as available.
  - Maintenance status remains visible as maintenance with a freshness notice.
  - Submitting an observed status update immediately refreshes the freshness timer.
- **Admin Filter:** Facilities staff can filter toilets on `/admin` to see restrooms currently requiring verification.

---

## 🗄️ Database Migrations

The database migration is located at:
- `supabase/migrations/20261029000000_init_neo_washroom.sql`
- `supabase/schema.sql` (single-file script ready for copy-pasting into Supabase SQL Editor)

### How to Apply:
1. Open your project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** -> **New Query**.
3. Copy the contents of `supabase/schema.sql` and click **Run**.

### Tables Created:
- `toilets`: Stores current status, name, and `last_status_update`.
- `toilet_status_history`: Audit trail of every status transition with timestamps, IP address, and user agent.
- `supply_reports`: Tracks supply requests, category, severity, status (`pending`, `in_progress`, `resolved`), and resolution notes.
- `cleaning_schedules`: Defined expected daily cleaning shifts per restroom (Morning 09:00, Midday 13:00, Evening 17:00).
- `cleaning_logs`: Logged cleaning shifts with checklists and staff tags.
- `admin_audit_logs`: Administrative action logs (updates, deletions, status changes).
- `update_toilet_status(...)`: Atomic PL/pgSQL function preventing duplicate consecutive status events.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Description | Default / Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key for server-side queries | *(Optional in dev, recommended in prod)* |
| `STATUS_FRESHNESS_MINUTES` | Inactivity threshold before showing "Needs verification" | `60` |
| `ADMIN_SECRET` | Server-side secret for account-free admin route protection | `neospark-admin-2026` |
| `NEXT_PUBLIC_APP_TIMEZONE` | Timezone for reports and date boundaries | `Asia/Kathmandu` |

---

## 🔐 Account-Free Admin Route Protection

The application operates without employee accounts or registration:
1. Privileged management operations (`PATCH /api/supplies/[id]`, `DELETE /api/supplies/[id]`, etc.) require an admin secret.
2. The client provides the secret via the `x-admin-secret` header or an HTTP-only secure cookie set by `/api/admin/verify`.
3. The server compares the secret using `crypto.timingSafeEqual` against the server-side environment variable `ADMIN_SECRET`.
4. The secret is **never** bundled into browser JavaScript or exposed via `NEXT_PUBLIC_` variables.

### Limitations:
- An admin secret operates as a shared passcode for on-duty facility staff. If staff changes occur, update `ADMIN_SECRET` on your server.
- Optional office network restrictions (e.g. Cloudflare Access or IP whitelisting) can be layered on top in production.

---

## 🧹 Cleaning Completion Calculation

Cleaning completion is calculated using a defined schedule denominator:
- **Expected Shifts:** Each restroom has 3 scheduled cleaning shifts daily (09:00, 13:00, 17:00), totaling 6 scheduled shifts per day.
- **Formula:**
  $$\text{Completion Rate} = \min\left(100\%, \frac{\text{Completed Cleanings in Period}}{\text{Scheduled Cleanings in Period}} \times 100\right)$$
- If cleaning schedules are deleted or not configured, the dashboard displays an explicit **"Not configured"** state rather than fabricating data.

---

## 📊 Analytics Definitions & Limitations

- **Total Status Changes:** The count of status changes recorded during the selected window.
- **Occupied Reports:** Count of transitions to `occupied` during the period.
  > *Limitation:* Based on user-reported status changes, not automated sensor-verified toilet usage or pedestrian counts.
- **Maintenance Reports:** Count of transitions to `maintenance`.
- **Unresolved Supply Issues:** Current count of pending or in-progress supply reports. This count is current and persistent across all date filter selections.

---

## 🧪 Testing

Run the automated test suite covering all 15 core verification scenarios:

```bash
npm test
```

### Scenarios Verified:
1. Valid supply report creation without authentication.
2. Rejection of invalid supply categories.
3. Handling of empty or excessively long (>500 chars) descriptions.
4. Prevention of status manipulation by public callers (always defaults to `pending`).
5. Rejection of unauthorized administrative write operations.
6. Verification of aggregate analytics calculations.
7. Local hour grouping in `Asia/Kathmandu` (00:00–23:00).
8. Nepal calendar date boundary handling (UTC+05:45).
9. Independence of unresolved supply counts from the analytics date filter.
10. Automatic display of `Needs verification` when a toilet exceeds the freshness threshold.
11. Ensuring stale occupied toilets are never automatically converted to available.
12. Maintenance state remains visible when stale.
13. Prevention of duplicate history records for unchanged statuses.
14. Graceful handling of empty datasets.
15. End-to-end status transitions and `/admin` operability.

---

## 🛠️ Local Development & Production Build

### Install dependencies:
```bash
npm install
```

### Run development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Run linter:
```bash
npm run lint
```

### Production build:
```bash
npm run build
npm start
```
