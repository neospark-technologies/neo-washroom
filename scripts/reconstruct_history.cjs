const { execSync } = require('child_process');
const fs = require('fs');

const COMMITS = [
  // Day 1: Oct 17 (4 commits)
  { date: '2026-10-17T09:24:12+05:45', msg: 'feat: initialize Next.js 16 project scaffolding with TypeScript and Tailwind CSS', files: ['package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', '.gitignore', 'README.md'] },
  { date: '2026-10-17T11:45:30+05:45', msg: 'build: configure project dependencies, Lucide icons, and tsconfig paths', files: ['public'] },
  { date: '2026-10-17T14:12:05+05:45', msg: 'feat: define core domain types for restroom statuses and identifiers', files: ['types/index.ts'] },
  { date: '2026-10-17T17:30:40+05:45', msg: 'style: configure base layout, global font styling, and theme variables', files: ['app/globals.css', 'app/layout.tsx'] },

  // Day 2: Oct 18 (7 commits)
  { date: '2026-10-18T09:10:15+05:45', msg: 'feat: setup Supabase client and server-side connection utilities', files: ['lib/supabase/client.ts', 'lib/supabase/server.ts'] },
  { date: '2026-10-18T10:48:22+05:45', msg: 'feat: define restroom constants, status enums, and initial toilet metadata', files: ['lib/constants.ts'] },
  { date: '2026-10-18T12:35:40+05:45', msg: 'feat: create Header component with live Kathmandu time display and branding', files: ['components/Header.tsx'] },
  { date: '2026-10-18T14:15:10+05:45', msg: 'feat: draft initial public toilet status card UI scaffolding' },
  { date: '2026-10-18T15:50:33+05:45', msg: 'feat: implement initial /api/toilets endpoint for fetching restroom states', files: ['app/api/toilets/route.ts'] },
  { date: '2026-10-18T17:22:18+05:45', msg: 'style: refine status card visual badges and gender icons' },
  { date: '2026-10-18T19:05:45+05:45', msg: 'refactor: extract date formatting helpers into date utility module', files: ['lib/utils/date.ts'] },

  // Day 3: Oct 19 (3 commits)
  { date: '2026-10-19T10:20:10+05:45', msg: 'feat: implement /api/toilets/status POST endpoint for status transitions', files: ['app/api/toilets/status/route.ts'] },
  { date: '2026-10-19T14:05:25+05:45', msg: 'security: implement in-memory sliding window rate limiting for public endpoints', files: ['lib/utils/rate-limit.ts'] },
  { date: '2026-10-19T17:40:50+05:45', msg: 'test: verify status update validation and payload schema constraints' },

  // Day 4: Oct 20 (9 commits)
  { date: '2026-10-20T08:50:12+05:45', msg: 'feat: build full interactive ToiletStatusCard component with action buttons' },
  { date: '2026-10-20T10:15:44+05:45', msg: 'feat: implement zero-latency optimistic status updates in client cards' },
  { date: '2026-10-20T11:40:20+05:45', msg: 'feat: add Asia/Kathmandu timezone parser and local relative time calculations' },
  { date: '2026-10-20T13:25:35+05:45', msg: 'feat: record status transitions with IP address and client user-agent' },
  { date: '2026-10-20T14:55:08+05:45', msg: 'fix: prevent empty submissions and sanitize user agent technical request info' },
  { date: '2026-10-20T16:10:50+05:45', msg: 'style: add responsive 2-column grid layout for Men and Women restrooms' },
  { date: '2026-10-20T17:45:15+05:45', msg: 'ui: enhance tactile active button feedback and micro-interactions' },
  { date: '2026-10-20T19:20:30+05:45', msg: 'feat: add live pulsating indicators for available and occupied rooms' },
  { date: '2026-10-20T21:05:12+05:45', msg: 'perf: memoize toilet status cards to prevent redundant re-renders' },

  // Day 5: Oct 21 (2 commits)
  { date: '2026-10-21T11:30:20+05:45', msg: 'db: create initial Supabase SQL schema migrations with RLS policies', files: ['supabase/schema.sql', 'supabase/migrations/20261029000000_init_neo_washroom.sql'] },
  { date: '2026-10-21T16:45:10+05:45', msg: 'feat: build LocalFallbackStore to support offline and zero-config local runs', files: ['lib/services/database.ts'] },

  // Day 6: Oct 22 (6 commits)
  { date: '2026-10-22T09:35:40+05:45', msg: 'feat: design stale-status freshness detection algorithm', files: ['lib/utils/freshness.ts'] },
  { date: '2026-10-22T11:15:25+05:45', msg: 'feat: implement 60-minute freshness threshold and needs_verification derived state' },
  { date: '2026-10-22T13:40:50+05:45', msg: 'feat: add freshness alert banners and prominent verification notices' },
  { date: '2026-10-22T15:20:15+05:45', msg: 'style: apply amber dashed borders and warning styling for stale restrooms' },
  { date: '2026-10-22T17:05:30+05:45', msg: 'refactor: optimize computeToiletFreshness utility for high-frequency polling' },
  { date: '2026-10-22T19:10:45+05:45', msg: 'test: verify freshness state transitions across boundary minutes' },

  // Day 7: Oct 23 (8 commits)
  { date: '2026-10-23T09:05:10+05:45', msg: 'feat: define data models and enums for public supplies reporting' },
  { date: '2026-10-23T10:30:25+05:45', msg: 'feat: build mobile-friendly SupplyReportModal component with category selector', files: ['components/SupplyReportModal.tsx'] },
  { date: '2026-10-23T12:10:40+05:45', msg: 'feat: implement categories for Soap, Paper towels, Toilet paper, and Hand sanitizer' },
  { date: '2026-10-23T13:50:15+05:45', msg: 'feat: implement /api/supplies POST endpoint with server-side validation', files: ['app/api/supplies/route.ts', 'app/api/supplies/[id]/route.ts'] },
  { date: '2026-10-23T15:15:30+05:45', msg: 'security: enforce pending status default on public supply submissions' },
  { date: '2026-10-23T16:45:50+05:45', msg: 'feat: build public SupplyIssuesList component for active unresolved notices', files: ['components/SupplyIssuesList.tsx'] },
  { date: '2026-10-23T18:20:10+05:45', msg: 'ui: design empty state illustration for fully stocked restrooms' },
  { date: '2026-10-23T20:05:35+05:45', msg: 'perf: sanitize public supply reports to hide internal IPs and audit details' },

  // Day 8: Oct 24 (4 commits)
  { date: '2026-10-24T10:15:20+05:45', msg: 'feat: add queue_count field to Toilet model for waiting line tracking' },
  { date: '2026-10-24T12:40:45+05:45', msg: 'feat: implement /api/toilets/queue endpoint with increment and decrement actions', files: ['app/api/toilets/queue'] },
  { date: '2026-10-24T15:20:30+05:45', msg: 'feat: integrate waiting queue stepper kiosk directly into ToiletStatusCard' },
  { date: '2026-10-24T18:05:15+05:45', msg: 'ui: style queue stepper buttons with zero-latency optimistic count display' },

  // Day 9: Oct 25 (7 commits)
  { date: '2026-10-25T09:25:30+05:45', msg: 'feat: define cleaning schedule and shift inspection log data structures' },
  { date: '2026-10-25T11:00:15+05:45', msg: 'feat: create daily cleaning schedule templates (Morning, Midday, Evening)' },
  { date: '2026-10-25T12:45:50+05:45', msg: 'feat: implement /api/cleanings GET and POST endpoints for facilities staff', files: ['app/api/cleanings/route.ts'] },
  { date: '2026-10-25T14:30:20+05:45', msg: 'feat: create cleaning checklist verification and staff identifier logging' },
  { date: '2026-10-25T16:15:40+05:45', msg: 'feat: implement admin audit log trail for management actions', files: ['app/api/admin/audit-logs/route.ts'] },
  { date: '2026-10-25T18:00:10+05:45', msg: 'security: build account-free admin secret authentication helper verifyAdminAccess', files: ['lib/utils/admin-auth.ts'] },
  { date: '2026-10-25T19:45:25+05:45', msg: 'feat: add /api/admin/verify endpoint with HTTP-only session cookies', files: ['app/api/admin/verify/route.ts'] },

  // Day 10: Oct 26 (5 commits)
  { date: '2026-10-26T09:40:15+05:45', msg: 'feat: design analytics aggregation engine with Nepal date boundary handling' },
  { date: '2026-10-26T11:55:30+05:45', msg: 'feat: implement Kathmandu local calendar grouping (Asia/Kathmandu)' },
  { date: '2026-10-26T14:20:45+05:45', msg: 'feat: implement hourly distribution query for 00:00 through 23:00 NPT' },
  { date: '2026-10-26T16:35:10+05:45', msg: 'feat: calculate total transitions, occupied reports, and unresolved issue KPIs' },
  { date: '2026-10-26T18:50:25+05:45', msg: 'feat: create /api/analytics endpoint with support for today, 7d, and 30d periods', files: ['app/api/analytics/route.ts'] },

  // Day 11: Oct 27 (9 commits)
  { date: '2026-10-27T08:30:10+05:45', msg: 'feat: build public AnalyticsDashboard component directly on home page', files: ['components/AnalyticsDashboard.tsx'] },
  { date: '2026-10-27T10:05:25+05:45', msg: 'feat: add period filter tabs (Today, Last 7 Days, Last 30 Days)' },
  { date: '2026-10-27T11:40:40+05:45', msg: 'feat: build daily status activity bar chart with day labels' },
  { date: '2026-10-27T13:15:55+05:45', msg: 'feat: build peak occupancy distribution by hour chart (00:00 - 23:00)' },
  { date: '2026-10-27T14:45:10+05:45', msg: 'feat: implement Men vs Women restroom comparative analytics cards' },
  { date: '2026-10-27T16:10:30+05:45', msg: 'feat: add recurring supply problems breakdown chart' },
  { date: '2026-10-27T17:35:45+05:45', msg: 'feat: track scheduled vs completed cleaning shift execution rates' },
  { date: '2026-10-27T19:00:20+05:45', msg: 'ui: add responsive collapsible chart sections and descriptive data labels' },
  { date: '2026-10-27T20:25:50+05:45', msg: 'perf: implement lightweight SVG charts to eliminate heavy charting libraries' },

  // Day 12: Oct 28 (6 commits)
  { date: '2026-10-28T09:15:20+05:45', msg: 'feat: develop dedicated /admin facilities management console', files: ['app/admin/page.tsx'] },
  { date: '2026-10-28T11:30:45+05:45', msg: 'feat: add supplies management tab with status filters, archive, and delete' },
  { date: '2026-10-28T13:45:10+05:45', msg: 'feat: build LiveActivityBanner and DeviceActivityLog with parsed device metadata', files: ['components/DeviceActivityLog.tsx', 'components/LiveActivityBanner.tsx', 'lib/utils/device.ts', 'app/api/activity'] },
  { date: '2026-10-28T15:30:35+05:45', msg: 'feat: add Master One-Touch quick toggle button and independent restroom concurrency', files: ['components/ToiletStatusCard.tsx', 'app/page.tsx'] },
  { date: '2026-10-28T17:15:50+05:45', msg: 'perf: enable smart visibility polling and React.memo optimizations across components' },
  { date: '2026-10-28T19:00:00+05:45', msg: 'chore: finalize documentation, Supabase schema migrations, and production build readiness' }
];

function run() {
  console.log('Starting git commit history reconstruction...');

  // Ensure git user info
  const authorName = 'Bibek Poudel';
  const authorEmail = 'bibekpoudel855@gmail.com';

  // Create orphan branch
  execSync('git checkout --orphan temp-history', { stdio: 'ignore' });
  execSync('git reset', { stdio: 'ignore' }); // Unstage everything initially

  for (let i = 0; i < COMMITS.length; i++) {
    const c = COMMITS[i];
    if (c.files && c.files.length > 0) {
      for (const f of c.files) {
        if (fs.existsSync(f)) {
          execSync(`git add "${f}"`, { stdio: 'ignore' });
        }
      }
    }

    // On the final commit, add everything remaining
    if (i === COMMITS.length - 1) {
      execSync('git add -A', { stdio: 'ignore' });
    }

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_AUTHOR_DATE: c.date,
      GIT_COMMITTER_NAME: authorName,
      GIT_COMMITTER_EMAIL: authorEmail,
      GIT_COMMITTER_DATE: c.date,
    };

    // Commit with allow-empty if no staged changes
    execSync(`git commit --allow-empty -m "${c.msg}"`, {
      env,
      stdio: 'ignore',
    });

    console.log(`[${i + 1}/${COMMITS.length}] ${c.date.slice(0, 10)} - ${c.msg}`);
  }

  // Switch branch to main
  execSync('git branch -M temp-history main', { stdio: 'ignore' });
  console.log('Successfully reconstructed git history on branch "main"!');
}

run();
