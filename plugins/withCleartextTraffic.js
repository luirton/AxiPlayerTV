const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withCleartextTraffic = (config) => {
  // 1. Modifica o AndroidManifest.xml para habilitar cleartext e apontar para o networkSecurityConfig
  config = withAndroidManifest(config, async (manifestConfig) => {
    const mainApplication = manifestConfig.modResults.manifest.application[0];
    mainApplication.$['android:usesCleartextTraffic'] = 'true';
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return manifestConfig;
  });

  // 2. Cria res/xml/network_security_config.xml permitindo conexões HTTP para todos os domínios e portas
  config = withDangerousMod(config, [
    'android',
    async (dangerousConfig) => {
      const resXmlDir = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );

      fs.mkdirSync(resXmlDir, { recursive: true });

      const networkSecurityConfigContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

      fs.writeFileSync(
        path.join(resXmlDir, 'network_security_config.xml'),
        networkSecurityConfigContent.trim()
      );

      return dangerousConfig;
    },
  ]);

  return config;
};

module.exports = withCleartextTraffic;
