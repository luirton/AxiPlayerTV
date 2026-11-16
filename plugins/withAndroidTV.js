const { withAndroidManifest } = require('expo/config-plugins');

const withAndroidTV = (config) => {
  return withAndroidManifest(config, async (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;

    // 1. Garantir que uses-feature não exija touchscreen e declare suporte leanback
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    // Touchscreen opcional (permite TV boxes sem touch)
    manifest['uses-feature'].push({
      $: {
        'android:name': 'android.hardware.touchscreen',
        'android:required': 'false',
      },
    });

    // Leanback habilitado
    manifest['uses-feature'].push({
      $: {
        'android:name': 'android.software.leanback',
        'android:required': 'false',
      },
    });

    // 2. Adicionar LEANBACK_LAUNCHER na MainActivity
    const application = manifest.application[0];
    const mainActivity = application.activity && application.activity[0];

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // Adiciona intent filter para Leanback Launcher da Android TV / Google TV
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } }],
      });
    }

    return manifestConfig;
  });
};

module.exports = withAndroidTV;
