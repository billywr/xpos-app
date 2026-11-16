const {
  withAndroidManifest,
  withDangerousMod,
  createRunOncePlugin,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PKG_NAME = "withNetworkSecurityConfig";

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Trust self-signed certificate for production server 62.169.22.51 -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">62.169.22.51</domain>
        <trust-anchors>
            <certificates src="@raw/server_cert" />
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

/**
 * Adds android:networkSecurityConfig attribute to AndroidManifest.xml
 */
function setNetworkSecurityConfigManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication) {
      if (!mainApplication.$) {
        mainApplication.$ = {};
      }
      mainApplication.$["android:networkSecurityConfig"] =
        "@xml/network_security_config";
      mainApplication.$["android:usesCleartextTraffic"] = "true";
    }
    return config;
  });
}

/**
 * Copies server certificate into res/raw and creates res/xml/network_security_config.xml
 */
function setNetworkSecurityConfigFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res"
      );
      const xmlDir = path.join(resDir, "xml");
      const rawDir = path.join(resDir, "raw");

      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(rawDir, { recursive: true });

      // 1. Write network_security_config.xml
      const xmlPath = path.join(xmlDir, "network_security_config.xml");
      fs.writeFileSync(xmlPath, NETWORK_SECURITY_CONFIG_XML, "utf8");

      // 2. Copy cert file into res/raw/server_cert.pem
      const sourceCert = path.join(
        config.modRequest.projectRoot,
        "assets",
        "certs",
        "server_cert.pem"
      );
      const destCert = path.join(rawDir, "server_cert.pem");

      if (fs.existsSync(sourceCert)) {
        fs.copyFileSync(sourceCert, destCert);
      }

      return config;
    },
  ]);
}

const withNetworkSecurityConfig = (config) => {
  config = setNetworkSecurityConfigManifest(config);
  config = setNetworkSecurityConfigFiles(config);
  return config;
};

module.exports = createRunOncePlugin(
  withNetworkSecurityConfig,
  PKG_NAME,
  "1.0.0"
);
