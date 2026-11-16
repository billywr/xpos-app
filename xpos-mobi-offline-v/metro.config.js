// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const https = require("https");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      const url = req.url || "";

      if (url.startsWith("/keycloak")) {
        const targetPath = url.replace(/^\/keycloak/, "") || "/";
        const proxyHeaders = { ...req.headers, host: "62.169.22.51:8443" };
        delete proxyHeaders.origin;
        delete proxyHeaders.Origin;
        delete proxyHeaders.referer;
        delete proxyHeaders.Referer;
        delete proxyHeaders["x-forwarded-for"];
        delete proxyHeaders["x-forwarded-proto"];
        delete proxyHeaders["x-forwarded-host"];

        const proxyReq = https.request(
          {
            hostname: "62.169.22.51",
            port: 8443,
            path: targetPath,
            method: req.method,
            headers: proxyHeaders,
            rejectUnauthorized: false,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );

        proxyReq.on("error", (err) => {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Keycloak proxy error", message: err.message }));
        });

        req.pipe(proxyReq, { end: true });
        return;
      }

      if (url.startsWith("/api/")) {
        const proxyHeaders = { ...req.headers, host: "62.169.22.51:9005" };
        delete proxyHeaders.origin;
        delete proxyHeaders.Origin;
        delete proxyHeaders.referer;
        delete proxyHeaders.Referer;
        delete proxyHeaders["x-forwarded-for"];
        delete proxyHeaders["x-forwarded-proto"];
        delete proxyHeaders["x-forwarded-host"];

        const proxyReq = https.request(
          {
            hostname: "62.169.22.51",
            port: 9005,
            path: url,
            method: req.method,
            headers: proxyHeaders,
            rejectUnauthorized: false,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );

        proxyReq.on("error", (err) => {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "API proxy error", message: err.message }));
        });

        req.pipe(proxyReq, { end: true });
        return;
      }

      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;

