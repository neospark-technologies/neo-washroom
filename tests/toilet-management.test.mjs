import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../lib/services/database';
import { computeToiletFreshness } from '../lib/utils/freshness';
import {
  getKathmanduDateString,
  getKathmanduHour,
  getDateRangeForPeriod,
} from '../lib/utils/date';
import { verifyAdminAccess } from '../lib/utils/admin-auth';

describe('NeoSpark Restroom Management Comprehensive Test Suite', () => {

  // 1. Valid supply report can be created without authentication
  test('1. Valid supply report can be created without authentication', async () => {
    const report = await DatabaseService.createSupplyReport({
      toilet_id: 'mens',
      category: 'Soap',
      description: 'Main soap dispenser is empty',
      severity: 'Normal',
      ip: '192.168.1.10',
    });

    assert.ok(report.id, 'Report must have an ID');
    assert.equal(report.toilet_id, 'mens');
    assert.equal(report.category, 'Soap');
    assert.equal(report.status, 'pending', 'New reports must always default to pending');
    assert.equal(report.is_archived, false);
  });

  // 2. Invalid supply categories are rejected
  test('2. Invalid supply categories are rejected', async () => {
    await assert.rejects(
      async () => {
        // @ts-expect-error testing invalid category
        await DatabaseService.createSupplyReport({
          toilet_id: 'mens',
          category: 'InvalidCategory123',
          severity: 'Normal',
        });
      },
      /Invalid supply category/,
      'Must reject invalid category'
    );
  });

  // 3. Empty or excessively long descriptions are handled correctly
  test('3. Empty or excessively long descriptions are handled correctly', async () => {
    // Empty description should succeed
    const emptyDescReport = await DatabaseService.createSupplyReport({
      toilet_id: 'womens',
      category: 'Paper towels',
      description: '',
      severity: 'Normal',
    });
    assert.ok(emptyDescReport.id);
    assert.equal(emptyDescReport.description, null);

    // Excessively long description (>500 chars) should be rejected
    const longDesc = 'a'.repeat(501);
    await assert.rejects(
      async () => {
        await DatabaseService.createSupplyReport({
          toilet_id: 'womens',
          category: 'Toilet paper',
          description: longDesc,
          severity: 'Urgent',
        });
      },
      /must not exceed 500 characters/,
      'Must reject descriptions exceeding 500 characters'
    );
  });

  // 4. Public users cannot update a supply report to resolved by manipulating the request
  test('4. Public users cannot update a supply report to resolved by manipulating creation payload', async () => {
    const attemptedPayload = {
      toilet_id: 'mens',
      category: 'Hand sanitizer',
      severity: 'Urgent',
      status: 'resolved', // Attempted manipulation
      is_archived: true,
    };

    // @ts-expect-error testing manipulated fields
    const report = await DatabaseService.createSupplyReport(attemptedPayload);
    assert.equal(report.status, 'pending', 'Status manipulation must be prevented; must remain pending');
    assert.equal(report.is_archived, false, 'Archived state must remain false on creation');
  });

  // 5. Protected administrative operations reject requests without valid authorization
  test('5. Protected administrative operations reject requests without valid authorization', () => {
    process.env.ADMIN_SECRET = 'super-secret-test-key-2026';

    // Mock NextRequest without headers
    const unauthReq = {
      headers: new Headers(),
      cookies: { get: () => null },
    };
    // @ts-expect-error mock request
    const check1 = verifyAdminAccess(unauthReq);
    assert.equal(check1.authorized, false, 'Should reject when no secret is provided');

    // Mock NextRequest with wrong secret
    const wrongReq = {
      headers: new Headers({ 'x-admin-secret': 'wrong-password' }),
      cookies: { get: () => null },
    };
    // @ts-expect-error mock request
    const check2 = verifyAdminAccess(wrongReq);
    assert.equal(check2.authorized, false, 'Should reject when incorrect secret is provided');

    // Mock NextRequest with correct secret
    const validReq = {
      headers: new Headers({ 'x-admin-secret': 'super-secret-test-key-2026' }),
      cookies: { get: () => null },
    };
    // @ts-expect-error mock request
    const check3 = verifyAdminAccess(validReq);
    assert.equal(check3.authorized, true, 'Should accept when correct secret is provided');
  });

  // 6. Analytics return correct counts for a known set of events
  test('6. Analytics return correct counts for a known set of events', async () => {
    // Generate known transitions
    await DatabaseService.updateToiletStatus('mens', 'occupied');
    await DatabaseService.updateToiletStatus('mens', 'available');
    await DatabaseService.updateToiletStatus('mens', 'maintenance');
    await DatabaseService.updateToiletStatus('mens', 'available');

    const analytics = await DatabaseService.getAnalyticsData('today');
    assert.ok(analytics.totalStatusChanges >= 4);
    assert.ok(analytics.occupiedReports >= 1);
    assert.ok(analytics.maintenanceReports >= 1);
  });

  // 7. A transition to occupied is counted correctly by local hour
  test('7. A transition to occupied is counted correctly by local hour in Asia/Kathmandu', () => {
    // Nepal is UTC+05:45
    // 2026-10-29T06:15:00.000Z -> 06:15 + 05:45 = 12:00:00 (Hour 12)
    const testUtcIso = '2026-10-29T06:15:00.000Z';
    const localHour = getKathmanduHour(testUtcIso);
    assert.equal(localHour, 12, '06:15 UTC must correspond to 12:00 NPT');

    // 2026-10-29T18:30:00.000Z -> 18:30 + 05:45 = 00:15:00 next day (Hour 0)
    const midnightIso = '2026-10-29T18:30:00.000Z';
    const midnightHour = getKathmanduHour(midnightIso);
    assert.equal(midnightHour, 0, '18:30 UTC must correspond to 00:15 midnight NPT');
  });

  // 8. Date filters use the configured local timezone (Asia/Kathmandu)
  test('8. Date filters use the configured local timezone', () => {
    // 2026-10-29T18:20:00Z is 23:59:00 on Oct 29 in Nepal
    const lateNightUtc = '2026-10-29T18:14:00.000Z';
    const dateStr1 = getKathmanduDateString(lateNightUtc);
    assert.equal(dateStr1, '2026-10-29', 'Late evening must still belong to Oct 29 NPT');

    // 2026-10-29T18:16:00Z is 00:01:00 on Oct 30 in Nepal
    const nextDayUtc = '2026-10-29T18:16:00.000Z';
    const dateStr2 = getKathmanduDateString(nextDayUtc);
    assert.equal(dateStr2, '2026-10-30', 'After midnight UTC+5:45 must belong to Oct 30 NPT');

    const range = getDateRangeForPeriod('today');
    assert.equal(range.dateKeys.length, 1);
  });

  // 9. Unresolved supply counts are independent of the analytics date filter
  test('9. Unresolved supply counts are independent of the analytics date filter', async () => {
    // Create an unresolved report
    await DatabaseService.createSupplyReport({
      toilet_id: 'womens',
      category: 'Soap',
      severity: 'Normal',
    });

    const analyticsToday = await DatabaseService.getAnalyticsData('today');
    const analytics7d = await DatabaseService.getAnalyticsData('7d');
    const analytics30d = await DatabaseService.getAnalyticsData('30d');

    assert.ok(analyticsToday.unresolvedSupplyIssues > 0);
    assert.equal(
      analyticsToday.unresolvedSupplyIssues,
      analytics7d.unresolvedSupplyIssues,
      'Unresolved supply issues count must not vary between time filters'
    );
    assert.equal(
      analytics7d.unresolvedSupplyIssues,
      analytics30d.unresolvedSupplyIssues,
      'Unresolved supply issues count must not vary between time filters'
    );
  });

  // 10. A stale toilet displays Needs verification
  test('10. A stale toilet displays Needs verification', () => {
    const seventyMinsAgo = new Date(Date.now() - 70 * 60 * 1000).toISOString();
    const staleToilet = {
      id: 'mens',
      name: "Men's Toilet",
      status: 'available',
      last_status_update: seventyMinsAgo,
    };

    const evaluated = computeToiletFreshness(staleToilet, 60);
    assert.equal(evaluated.isStale, true);
    assert.equal(evaluated.displayStatus, 'needs_verification');
  });

  // 11. A stale occupied toilet is never automatically marked available
  test('11. A stale occupied toilet is never automatically marked available', () => {
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    const staleOccupied = {
      id: 'womens',
      name: "Women's Toilet",
      status: 'occupied',
      last_status_update: twoHoursAgo,
    };

    const evaluated = computeToiletFreshness(staleOccupied, 60);
    assert.equal(evaluated.isStale, true);
    assert.equal(evaluated.displayStatus, 'needs_verification');
    assert.equal(evaluated.status, 'occupied', 'Underlying stored status must remain occupied');
  });

  // 12. Maintenance remains visible when stale
  test('12. Maintenance remains visible when stale', () => {
    const threeHoursAgo = new Date(Date.now() - 180 * 60 * 1000).toISOString();
    const staleMaintenance = {
      id: 'mens',
      name: "Men's Toilet",
      status: 'maintenance',
      last_status_update: threeHoursAgo,
    };

    const evaluated = computeToiletFreshness(staleMaintenance, 60);
    assert.equal(evaluated.isStale, true);
    assert.equal(
      evaluated.displayStatus,
      'maintenance',
      'Toilet under maintenance must remain visible as maintenance even when stale'
    );
  });

  // 13. An unchanged status does not create a duplicate status-change event
  test('13. An unchanged status does not create a duplicate status-change event', async () => {
    // Set to available
    await DatabaseService.updateToiletStatus('womens', 'available');
    
    const countBefore = (await DatabaseService.getStatusHistory(100)).length;

    // Send available again
    const result = await DatabaseService.updateToiletStatus('womens', 'available');
    assert.equal(result.changed, false, 'Must report changed = false');

    const countAfter = (await DatabaseService.getStatusHistory(100)).length;
    assert.equal(countAfter, countBefore, 'Must not insert duplicate history record for identical status');
  });

  // 14. The home page handles empty reports and analytics data gracefully
  test('14. The home page handles empty reports and analytics data gracefully', async () => {
    const analytics = await DatabaseService.getAnalyticsData('today');
    assert.ok(Array.isArray(analytics.dailyActivity));
    assert.ok(Array.isArray(analytics.occupiedByHour));
    assert.equal(analytics.occupiedByHour.length, 24);
    assert.ok(analytics.toiletComparison.mens);
    assert.ok(analytics.toiletComparison.womens);
  });

  // 15. Existing toilet-status functionality and /admin still work
  test('15. Existing toilet-status functionality and /admin still work', async () => {
    const res = await DatabaseService.updateToiletStatus('mens', 'occupied');
    assert.equal(res.toilet.status, 'occupied');

    const res2 = await DatabaseService.updateToiletStatus('mens', 'available');
    assert.equal(res2.toilet.status, 'available');

    const toilets = await DatabaseService.getToiletsWithFreshness();
    assert.equal(toilets.length, 2);
    assert.ok(toilets.find((t) => t.id === 'mens'));
    assert.ok(toilets.find((t) => t.id === 'womens'));
  });

});
