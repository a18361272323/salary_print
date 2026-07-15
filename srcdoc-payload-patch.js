const fs = require("node:fs");

function addManifestFallback(html, fallbackUrl) {
  const source = String(html || "");
  const fallback = String(fallbackUrl || "");
  const declaration = /const assetManifestUrl = "([^"]+)";/;
  const match = source.match(declaration);
  if (!match || !fallback) throw new Error("Missing manifest URL or fallback URL.");

  const loader = 'const assetManifestUrls = [' + JSON.stringify(match[1]) + ', ' + JSON.stringify(fallback) + '];\n      let activeAssetManifestUrl = assetManifestUrls[0];\n\n      async function loadAssetManifest() {\n        let lastError;\n        for (let attempt = 0; attempt < 2; attempt++) {\n          for (const url of assetManifestUrls) {\n            try {\n              const response = await fetch(url, { cache: "no-cache" });\n              if (!response.ok) throw new Error("asset manifest " + response.status);\n              activeAssetManifestUrl = url;\n              return response.json();\n            } catch (error) {\n              lastError = error;\n            }\n          }\n        }\n        throw lastError || new Error("asset manifest unavailable");\n      }';
  const fetchBlock = /fetch\(assetManifestUrl, \{ cache: "no-cache" \}\)\s*\.then\(\(response\) => \{\s*if \(!response\.ok\) throw new Error\("asset manifest " \+ response\.status\);\s*return response\.json\(\);\s*\}\)/;
  if (!fetchBlock.test(source)) throw new Error("Unsupported helper-generated manifest loader.");

  return source
    .replace(declaration, loader)
    .replace("return new URL(value, assetManifestUrl).href;", "return new URL(value, activeAssetManifestUrl).href;")
    .replace(fetchBlock, "loadAssetManifest()");
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  const fallbackUrl = process.argv[4];
  if (!inputPath || !outputPath || !fallbackUrl) throw new Error("Usage: node srcdoc-payload-patch.js <input-html> <output-html> <fallback-url>");
  fs.writeFileSync(outputPath, addManifestFallback(fs.readFileSync(inputPath, "utf8"), fallbackUrl), "utf8");
}

module.exports = { addManifestFallback };
