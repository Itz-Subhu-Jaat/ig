// Railway-compatible wrapper for Next.js standalone server
// Fixes "DNS address not found" by setting HOSTNAME=0.0.0.0
//
// This file runs BEFORE the Next.js standalone server.
// It sets the required environment variables and then loads
// the Next.js generated server.js from the standalone output.

// Force Railway-compatible binding
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

const fs = require('fs');
const path = require('path');

// The Next.js standalone output generates its own server.js
// We need to find and load it
const standaloneServerPath = path.join(__dirname, 'server.js');

if (fs.existsSync(standaloneServerPath)) {
  console.log(`[railway-server] HOSTNAME=${process.env.HOSTNAME}, PORT=${process.env.PORT || '3000'}`);
  console.log('[railway-server] Loading Next.js standalone server...');

  // Clear require cache to avoid issues
  delete require.cache[require.resolve(standaloneServerPath)];

  // Load the Next.js standalone server
  require(standaloneServerPath);
} else {
  console.error('[railway-server] ERROR: server.js not found in', __dirname);
  console.error('[railway-server] Make sure the build was run with `output: "standalone"` in next.config.ts');
  process.exit(1);
}
