const assert = require("node:assert/strict");
const test = require("node:test");
const { addManifestFallback } = require("../srcdoc-payload-patch");

test("adds a fallback manifest without replacing the helper-generated srcdoc structure", () => {
  const html = '<script type="module">const assetManifestUrl = "https://cdn.example/assets.json";function resolveAssetUrl(value) { return new URL(value, assetManifestUrl).href; }fetch(assetManifestUrl, { cache: "no-cache" }).then((response) => { if (!response.ok) throw new Error("asset manifest " + response.status); return response.json(); }).then((manifest) => manifest)</script>';
  const patched = addManifestFallback(html, "https://raw.example/assets.json");

  assert.match(patched, /const assetManifestUrls = \["https:\/\/cdn\.example\/assets\.json", "https:\/\/raw\.example\/assets\.json"\]/);
  assert.match(patched, /async function loadAssetManifest\(\)/);
  assert.match(patched, /for \(let attempt = 0; attempt < 2; attempt\+\+\)/);
  assert.match(patched, /return new URL\(value, activeAssetManifestUrl\)\.href/);
  assert.match(patched, /loadAssetManifest\(\)/);
});
