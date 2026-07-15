const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("keeps assets relative so a pinned fallback manifest can load the same revision", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets.json"), "utf8"));
  const srcdocManifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "srcdoc-manifest.json"), "utf8"));

  assert.ok(manifest.css.concat(manifest.js).every((asset) => asset.startsWith("./")));
  assert.match(srcdocManifest.assetManifestUrl, /@fed4ec83a041dfca6250193a65f4f667b27718b2\/assets\.json$/);
  assert.match(srcdocManifest.assetManifestFallbackUrl, /\/fed4ec83a041dfca6250193a65f4f667b27718b2\/assets\.json$/);
  assert.match(srcdocManifest.assetManifestFallbackUrl, /^https:\/\/raw\.githubusercontent\.com\/a18361272323\/salary_print\/[0-9a-f]+\/assets\.json$/);
});
