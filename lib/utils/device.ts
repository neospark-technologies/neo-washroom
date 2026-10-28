export interface DeviceDetails {
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  os: string;
  browser: string;
  summary: string;
}

/**
 * Parses user-agent header into structured device information
 * e.g. { deviceType: 'Mobile', os: 'Android', browser: 'Chrome', summary: 'Mobile (Android • Chrome)' }
 */
export function parseDeviceDetails(userAgent?: string | null): DeviceDetails {
  if (!userAgent || typeof userAgent !== 'string') {
    return {
      deviceType: 'Desktop',
      os: 'Unknown OS',
      browser: 'Web Browser',
      summary: 'Web Visitor',
    };
  }

  const ua = userAgent.toLowerCase();

  // 1. Detect OS & Device Category
  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  let os = 'Device';

  if (ua.includes('iphone')) {
    deviceType = 'Mobile';
    os = 'iPhone (iOS)';
  } else if (ua.includes('ipad')) {
    deviceType = 'Tablet';
    os = 'iPad (iPadOS)';
  } else if (ua.includes('android')) {
    deviceType = ua.includes('mobile') ? 'Mobile' : 'Tablet';
    os = 'Android';
  } else if (ua.includes('windows nt 10.0')) {
    deviceType = 'Desktop';
    os = 'Windows 11/10';
  } else if (ua.includes('windows')) {
    deviceType = 'Desktop';
    os = 'Windows';
  } else if (ua.includes('macintosh') || ua.includes('mac os')) {
    deviceType = 'Desktop';
    os = 'macOS';
  } else if (ua.includes('linux')) {
    deviceType = 'Desktop';
    os = 'Linux';
  }

  // 2. Detect Browser
  let browser = 'Browser';
  if (ua.includes('edg/')) {
    browser = 'Edge';
  } else if (ua.includes('chrome') && !ua.includes('chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('opera') || ua.includes('opr/')) {
    browser = 'Opera';
  }

  return {
    deviceType,
    os,
    browser,
    summary: `${deviceType} (${os} • ${browser})`,
  };
}

/**
 * Parses user-agent header into human-friendly device summary string
 * e.g. "Mobile (Android • Chrome)", "Mobile (iPhone (iOS) • Safari)", "Desktop (Windows 11/10 • Chrome)"
 */
export function parseUserAgentToDeviceInfo(userAgent?: string | null): string {
  return parseDeviceDetails(userAgent).summary;
}
