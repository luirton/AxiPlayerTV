import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

export interface PermissionsStatus {
  storage: boolean;
  network: boolean;
}

/**
 * Obtém a versão da API do Android como número inteiro.
 */
function getAndroidApiLevel(): number {
  if (Platform.OS !== 'android') return 0;
  return typeof Platform.Version === 'number'
    ? Platform.Version
    : parseInt(String(Platform.Version), 10) || 0;
}

/**
 * Verifica se as permissões de armazenamento já foram concedidas.
 */
export async function checkStoragePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const apiLevel = getAndroidApiLevel();

    if (apiLevel >= 33) {
      const readImages = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      );
      const readVideo = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO
      );
      const readAudio = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
      );
      return readImages || readVideo || readAudio;
    } else {
      const read = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      return read;
    }
  } catch (err) {
    console.warn('[Permissions] Erro ao verificar permissões de armazenamento:', err);
    return false;
  }
}

/**
 * Solicita as permissões nativas de armazenamento do Android em tempo de execução.
 */
export async function requestStoragePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const apiLevel = getAndroidApiLevel();
    const permissionsToRequest: any[] = [];

    if (apiLevel >= 33) {
      if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
      }
      if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
      }
      if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
      }
    } else {
      if (PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      }
      if (PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
      }
    }

    if (permissionsToRequest.length === 0) {
      return true;
    }

    const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);

    const isGranted = Object.values(results).some(
      (status) => status === PermissionsAndroid.RESULTS.GRANTED
    );

    return isGranted;
  } catch (err) {
    console.warn('[Permissions] Erro ao solicitar permissões de armazenamento:', err);
    return false;
  }
}

/**
 * Checa se o dispositivo possui conectividade básica de rede.
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    // Testa conectividade com um endpoint de DNS confiável e ultrarrápido
    const res = await fetch('https://1.1.1.1', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok || res.status < 500;
  } catch {
    // Caso de timeout ou sem rota externa, ainda pode haver conexão de rede local
    return true;
  }
}

/**
 * Solicitação completa na inicialização do app:
 * Solicita permissões de armazenamento e valida conectividade de rede.
 */
export async function requestInitialPermissions(): Promise<PermissionsStatus> {
  let storageGranted = true;

  if (Platform.OS === 'android') {
    const alreadyGranted = await checkStoragePermissions();
    if (!alreadyGranted) {
      storageGranted = await requestStoragePermissions();
    } else {
      storageGranted = true;
    }
  }

  const networkOk = await checkNetworkConnectivity();

  return {
    storage: storageGranted,
    network: networkOk,
  };
}

/**
 * Abre as configurações do sistema para o usuário conceder manualmente caso tenha negado permanentemente.
 */
export function openAppSettings(): void {
  if (Platform.OS === 'android') {
    Linking.openSettings().catch(() => {
      Alert.alert(
        'Ajustes',
        'Por favor, acesse as Configurações do seu aparelho -> Aplicativos -> Axi Player -> Permissões e conceda acesso ao Armazenamento.'
      );
    });
  }
}
