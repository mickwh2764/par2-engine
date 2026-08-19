const SESSION_KEY = 'par2_session_id';
const LANDING_REF_KEY = 'par2_landing_referrer';
const VALIDATED_KEY = 'par2_session_validated';

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getLandingReferrer(): string | null {
  let cached = sessionStorage.getItem(LANDING_REF_KEY);
  if (cached) return cached;

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const rawReferrer = document.referrer || null;

  const hasUtm = utmSource || utmMedium || utmCampaign;

  if (!rawReferrer && !hasUtm) return null;

  const referrerData: Record<string, string> = {};
  if (rawReferrer) referrerData.url = rawReferrer;
  if (utmSource) referrerData.utm_source = utmSource;
  if (utmMedium) referrerData.utm_medium = utmMedium;
  if (utmCampaign) referrerData.utm_campaign = utmCampaign;

  try {
    if (rawReferrer) {
      const u = new URL(rawReferrer);
      referrerData.domain = u.hostname;
    }
  } catch {}

  const encoded = JSON.stringify(referrerData);
  sessionStorage.setItem(LANDING_REF_KEY, encoded);
  return encoded;
}

function normalizePage(page: string): string {
  return page.toLowerCase().replace(/\/+$/, '') || '/';
}

function isSessionValidated(): boolean {
  return sessionStorage.getItem(VALIDATED_KEY) === 'true';
}

function markSessionValidated(): void {
  if (isSessionValidated()) return;
  sessionStorage.setItem(VALIDATED_KEY, 'true');
  sendTrack('session_validated', normalizePage(window.location.pathname), true);
}

function sendTrack(eventType: string, page: string, validated?: boolean) {
  const payload: Record<string, any> = {
    eventType,
    page,
    sessionId: getSessionId(),
  };
  if (validated !== undefined) payload.validated = validated;
  // sendBeacon fires reliably even when the page is unloading
  if (navigator.sendBeacon) {
    try {
      navigator.sendBeacon(
        '/api/app/event',
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      );
      return Promise.resolve();
    } catch {}
  }
  return fetch('/api/app/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

let interactionListenersAttached = false;

function attachInteractionListeners(): void {
  if (interactionListenersAttached) return;
  interactionListenersAttached = true;

  const onInteraction = () => {
    markSessionValidated();
    window.removeEventListener('scroll', onInteraction);
    window.removeEventListener('click', onInteraction);
    window.removeEventListener('keydown', onInteraction);
  };

  window.addEventListener('scroll', onInteraction, { once: true, passive: true });
  window.addEventListener('click', onInteraction, { once: true });
  window.addEventListener('keydown', onInteraction, { once: true });
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(): void {
  if (heartbeatInterval !== null) return;

  const sendHeartbeat = () => {
    if (document.visibilityState === 'visible') {
      sendTrack('heartbeat', normalizePage(window.location.pathname));
    }
  };

  heartbeatInterval = setInterval(sendHeartbeat, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  });
}

export function trackPageView(page: string) {
  try {
    const normalizedPage = normalizePage(page);

    let timezone: string | null = null;
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
    let language: string | null = null;
    try { language = navigator.language || null; } catch {}

    const pvPayload = JSON.stringify({
      eventType: 'page_view',
      page: normalizedPage,
      sessionId: getSessionId(),
      referrer: getLandingReferrer(),
      timezone,
      language,
      validated: isSessionValidated(),
    });
    // sendBeacon is reliable on page unload; fall back to fetch
    if (navigator.sendBeacon) {
      try {
        navigator.sendBeacon(
          '/api/app/event',
          new Blob([pvPayload], { type: 'application/json' })
        );
      } catch {
        fetch('/api/app/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: pvPayload,
        }).catch(() => {});
      }
    } else {
      fetch('/api/app/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: pvPayload,
      }).catch(() => {});
    }

    attachInteractionListeners();
    startHeartbeat();
  } catch {
  }
}

export function trackEvent(eventType: string, page?: string) {
  try {
    markSessionValidated();
    sendTrack(eventType, normalizePage(page || window.location.pathname), true);
  } catch {
  }
}

export function trackDownload(fileName: string) {
  trackEvent('file_download', window.location.pathname);
}

export function trackShare(shareId: string) {
  trackEvent('share_link', window.location.pathname);
}
