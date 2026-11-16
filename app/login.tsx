import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme/colors';
import { XtreamClient, xtreamClient } from '../src/services/xtreamClient';
import { storage } from '../src/services/storage';
import { SavedAccount } from '../src/types/iptv';
import { FocusableButton } from '../src/components/tv/FocusableButton';
import { parseIptvLink, ParsedIptvLink } from '../src/services/linkParser';
import { fetchAndParseM3u } from '../src/services/m3uParser';

export default function TVLoginScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'link' | 'xtream'>('link');

  // Xtream Form Fields
  const [profileName, setProfileName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Link Form Fields (M3U, HLS, Link Curto, SSIPTV)
  const [linkInput, setLinkInput] = useState('');
  const [parsedLink, setParsedLink] = useState<ParsedIptvLink | null>(null);

  // Focus Tracker for Inputs
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [focusedAccount, setFocusedAccount] = useState<string | null>(null);
  const [focusedDelete, setFocusedDelete] = useState<string | null>(null);

  // Saved Accounts List
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const list = await storage.getAccounts();
      setSavedAccounts(list);
    } catch (e) {
      console.warn('Erro ao carregar contas salvas:', e);
    }
  };

  // Monitor link input changes to extract credentials in real-time
  const handleLinkInputChange = (text: string) => {
    setLinkInput(text);
    if (text.trim().length > 10) {
      const parsed = parseIptvLink(text);
      setParsedLink(parsed);
    } else {
      setParsedLink(null);
    }
  };

  // Auto-fill in manual tab if user pastes a full link in serverUrl field
  const handleServerUrlChange = (text: string) => {
    let clean = text.trim();
    if (clean.includes('get.php') || clean.includes('/p/') || clean.includes('username=')) {
      const parsed = parseIptvLink(clean);
      if (parsed.serverUrl) setServerUrl(parsed.serverUrl);
      if (parsed.username) setUsername(parsed.username);
      if (parsed.password) setPassword(parsed.password);
      return;
    }
    // Converte automaticamente caso usuário digite https na porta 80
    if (clean.startsWith('https://') && (clean.includes(':80/') || clean.endsWith(':80'))) {
      clean = clean.replace('https://', 'http://');
    }
    setServerUrl(clean);
  };

  const handleLinkLogin = async () => {
    if (!linkInput.trim()) {
      Alert.alert('Link Obrigatório', 'Por favor, cole ou digite o link da sua lista (M3U, HLS, SSIPTV ou Link Curto).');
      return;
    }

    const parsed = parseIptvLink(linkInput);
    setLoading(true);

    try {
      // 1. Se identificamos credenciais Xtream no link
      if (parsed.username && parsed.password && parsed.serverUrl) {
        let authSuccess = false;
        let lastErrorMsg = '';

        // Tentativa A: URL original extraída
        try {
          const client = new XtreamClient(parsed.serverUrl, parsed.username, parsed.password);
          const auth = await client.authenticate();

          const account: SavedAccount = {
            id: `${parsed.username}@${parsed.serverUrl}`,
            name: profileName.trim() || auth.user_info.username || 'Minha Lista TV',
            serverUrl: parsed.serverUrl,
            username: parsed.username,
            password: parsed.password,
            createdAt: Date.now(),
            lastLogin: Date.now(),
          };

          await storage.saveAccount(account);
          await storage.setActiveAccount(account);
          authSuccess = true;
          router.replace('/(tv)/home');
          return;
        } catch (apiErr: any) {
          lastErrorMsg = apiErr?.message || '';
          console.warn('Tentativa 1 com URL original falhou:', apiErr);
        }

        // Tentativa B: Fallback removendo ou ajustando porta comum (ex: :80 ou sem porta)
        if (!authSuccess && parsed.serverUrl.includes(':80')) {
          try {
            const altServer = parsed.serverUrl.replace(':80', '');
            const clientAlt = new XtreamClient(altServer, parsed.username, parsed.password);
            const authAlt = await clientAlt.authenticate();

            const account: SavedAccount = {
              id: `${parsed.username}@${altServer}`,
              name: profileName.trim() || authAlt.user_info.username || 'Minha Lista TV',
              serverUrl: altServer,
              username: parsed.username,
              password: parsed.password,
              createdAt: Date.now(),
              lastLogin: Date.now(),
            };

            await storage.saveAccount(account);
            await storage.setActiveAccount(account);
            authSuccess = true;
            router.replace('/(tv)/home');
            return;
          } catch (altErr: any) {
            lastErrorMsg = altErr?.message || lastErrorMsg;
          }
        }

        // Tentativa C: Testar download direto do link M3U caso a API Xtream esteja bloqueada
        if (!authSuccess) {
          try {
            const m3uResult = await fetchAndParseM3u(linkInput.trim(), 15000);
            if (m3uResult.channels.length > 0) {
              const account: SavedAccount = {
                id: `${parsed.username}@${parsed.serverUrl}`,
                name: profileName.trim() || 'Lista M3U TV',
                serverUrl: parsed.serverUrl,
                username: parsed.username,
                password: parsed.password,
                createdAt: Date.now(),
                lastLogin: Date.now(),
              };
              await storage.saveAccount(account);
              await storage.setActiveAccount(account);
              router.replace('/(tv)/home');
              return;
            }
          } catch (m3uErr) {
            console.warn('Tentativa M3U direto também falhou:', m3uErr);
          }

          throw new Error(lastErrorMsg || 'Não foi possível validar o link com o servidor IPTV.');
        }
      }

      // 2. Link M3U genérico
      const m3uDirect = await fetchAndParseM3u(linkInput.trim(), 20000);
      if (m3uDirect.channels.length === 0) {
        throw new Error('Nenhum canal foi encontrado no link da lista fornecido.');
      }

      const accUsername = parsed.username || 'usuario_m3u';
      const accPassword = parsed.password || '';
      const accServer = parsed.serverUrl || linkInput.trim();

      const account: SavedAccount = {
        id: `${accUsername}@${accServer}`,
        name: profileName.trim() || 'Lista IPTV TV',
        serverUrl: accServer,
        username: accUsername,
        password: accPassword,
        createdAt: Date.now(),
        lastLogin: Date.now(),
      };

      await storage.saveAccount(account);
      await storage.setActiveAccount(account);
      router.replace('/(tv)/home');
    } catch (err: any) {
      Alert.alert(
        'Falha ao Conectar',
        (err?.message || 'Verifique se o link está correto, ativo e com conexão à internet.') +
          '\n\nDica: Se a sua lista usa usuário e senha, você também pode usar a aba "Servidor / Usuário".'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleXtreamLogin = async () => {
    if (!serverUrl || !username || !password) {
      Alert.alert('Campos Obrigatórios', 'Por favor, preencha URL do Servidor, Usuário e Senha.');
      return;
    }

    setLoading(true);
    try {
      let cleanUrl = serverUrl.trim();
      if (cleanUrl.startsWith('https://') && (cleanUrl.includes(':80/') || cleanUrl.endsWith(':80'))) {
        cleanUrl = cleanUrl.replace('https://', 'http://');
      }

      let client = new XtreamClient(cleanUrl, username, password);
      let auth;

      try {
        auth = await client.authenticate();
      } catch (firstErr: any) {
        // Se tiver :80, tenta sem a porta
        if (cleanUrl.includes(':80')) {
          const altServer = cleanUrl.replace(':80', '');
          client = new XtreamClient(altServer, username, password);
          auth = await client.authenticate();
        } else {
          throw firstErr;
        }
      }

      const finalServerUrl = client.getServerUrl();
      const account: SavedAccount = {
        id: `${username}@${finalServerUrl}`,
        name: profileName.trim() || auth.user_info.username || 'Minha Lista TV',
        serverUrl: finalServerUrl,
        username: username.trim(),
        password: password.trim(),
        createdAt: Date.now(),
        lastLogin: Date.now(),
      };

      await storage.saveAccount(account);
      await storage.setActiveAccount(account);

      router.replace('/(tv)/home');
    } catch (err: any) {
      Alert.alert(
        'Erro ao Conectar',
        (err?.message || 'Verifique os dados de acesso e a conexão com a internet.') +
          '\n\nCertifique-se de que a URL inclui http:// e a porta correta fornecida pelo seu provedor.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSavedAccount = async (account: SavedAccount) => {
    setLoading(true);
    try {
      let fixedServer = account.serverUrl;
      if (fixedServer.startsWith('https://') && (fixedServer.includes(':80/') || fixedServer.endsWith(':80'))) {
        fixedServer = fixedServer.replace('https://', 'http://');
      }
      const fixedAccount = {
        ...account,
        serverUrl: fixedServer,
        id: `${account.username}@${fixedServer}`,
      };
      await storage.saveAccount(fixedAccount);
      await storage.setActiveAccount(fixedAccount);
      router.replace('/(tv)/home');
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível carregar a conta selecionada.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccount = async (id: string) => {
    await storage.removeAccount(id);
    loadAccounts();
  };

  const getFormatBadgeLabel = (type?: string) => {
    switch (type) {
      case 'm3u':
        return 'M3U / Link Curto';
      case 'hls':
        return 'HLS Stream';
      case 'ssiptv':
        return 'SSIPTV';
      default:
        return 'Lista IPTV';
    }
  };

  return (
    <View style={styles.container}>
      {/* Background with Ambient Glow */}
      <LinearGradient
        colors={['rgba(0, 229, 255, 0.09)', 'rgba(168, 85, 247, 0.05)', '#070A12', '#05070D']}
        style={StyleSheet.absoluteFill}
      />

      {/* Split Screen 2 Columns Container */}
      <View style={styles.splitLayout}>
        {/* LEFT COLUMN: Brand, Navigation Guidance, and Author Attribution */}
        <View style={styles.leftCol}>
          <View style={styles.brandBox}>
            <Image
              source={require('../assets/emblem_transparent.png')}
              style={styles.brandEmblem}
              contentFit="contain"
            />
            <Text style={styles.brandTitle}>
              AxiPlayer<Text style={styles.brandTv}>TV</Text>
            </Text>
            <Text style={styles.brandSubtitle}>Streaming IPTV & VOD • Sem Trava</Text>
          </View>

          <View style={styles.instructionCard}>
            <View style={styles.instructionHeader}>
              <Ionicons name="game-controller-outline" size={18} color={colors.primary} />
              <Text style={styles.instructionTitle}>Navegação no Controle Remoto</Text>
            </View>
            <Text style={styles.instructionText}>
              • Use as setas do D-Pad para navegar entre as abas e os campos.
            </Text>
            <Text style={styles.instructionText}>
              • Pressione <Text style={styles.keyBadge}>OK</Text> para abrir o teclado na tela ou confirmar a conexão.
            </Text>
          </View>

          {/* Developer Attribution Link */}
          <Pressable
            focusable={true}
            style={({ focused }: any) => [
              styles.authorBox,
              focused && styles.authorBoxFocused,
            ]}
            onPress={() => Linking.openURL('https://github.com/luirton')}
          >
            <Ionicons name="logo-github" size={16} color={colors.primary} />
            <Text style={styles.authorText}>Created by Luirton Gurgel</Text>
          </Pressable>
        </View>

        {/* RIGHT COLUMN: Tabs, Forms, and Saved Accounts */}
        <View style={styles.rightCol}>
          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <Pressable
              focusable={true}
              onPress={() => setActiveTab('link')}
              style={({ focused }: any) => [
                styles.tabBtn,
                activeTab === 'link' && styles.tabBtnActive,
                focused && styles.tabBtnFocused,
              ]}
            >
              <Ionicons
                name="link-outline"
                size={18}
                color={activeTab === 'link' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'link' && styles.tabBtnTextActive,
                ]}
              >
                Link da Lista (M3U / HLS / Curto)
              </Text>
            </Pressable>

            <Pressable
              focusable={true}
              onPress={() => setActiveTab('xtream')}
              style={({ focused }: any) => [
                styles.tabBtn,
                activeTab === 'xtream' && styles.tabBtnActive,
                focused && styles.tabBtnFocused,
              ]}
            >
              <Ionicons
                name="server-outline"
                size={18}
                color={activeTab === 'xtream' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'xtream' && styles.tabBtnTextActive,
                ]}
              >
                Servidor / Usuário
              </Text>
            </Pressable>
          </View>

          {/* Form Scroll Area */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'link' ? (
              <View style={styles.formBody}>
                <Text style={styles.label}>Nome do Perfil (opcional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'link_profile' && styles.inputFocused,
                  ]}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="Ex: Minha Lista TV"
                  placeholderTextColor="#5E6982"
                  onFocus={() => setFocusedInput('link_profile')}
                  onBlur={() => setFocusedInput(null)}
                />

                <Text style={styles.label}>Link da Lista IPTV (Cole ou Digite)</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputMultiline,
                    focusedInput === 'link_url' && styles.inputFocused,
                  ]}
                  value={linkInput}
                  onChangeText={handleLinkInputChange}
                  placeholder="http://servidor.com/get.php?username=... ou link curto /p/.../m3u"
                  placeholderTextColor="#5E6982"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  numberOfLines={2}
                  onFocus={() => setFocusedInput('link_url')}
                  onBlur={() => setFocusedInput(null)}
                />

                {/* Detected Credentials Card */}
                {parsedLink && parsedLink.username ? (
                  <View style={styles.detectedCard}>
                    <View style={styles.detectedHeader}>
                      <Ionicons name="checkmark-circle" size={18} color="#00E676" />
                      <Text style={styles.detectedTitle}>Credenciais Identificadas</Text>
                      <View style={styles.formatBadge}>
                        <Text style={styles.formatBadgeText}>{getFormatBadgeLabel(parsedLink.type)}</Text>
                      </View>
                    </View>

                    <View style={styles.detectedRow}>
                      <Text style={styles.detectedLabel}>Servidor:</Text>
                      <Text style={styles.detectedValue} numberOfLines={1}>
                        {parsedLink.serverUrl}
                      </Text>
                    </View>

                    <View style={styles.detectedRow}>
                      <Text style={styles.detectedLabel}>Usuário:</Text>
                      <Text style={styles.detectedValue}>{parsedLink.username}</Text>
                    </View>

                    <View style={styles.detectedRow}>
                      <Text style={styles.detectedLabel}>Senha:</Text>
                      <Text style={styles.detectedValue}>••••••••••••</Text>
                    </View>
                  </View>
                ) : null}

                <FocusableButton
                  label={loading ? 'Conectando...' : 'Entrar com este Link'}
                  icon="flash-outline"
                  onPress={handleLinkLogin}
                  style={styles.submitBtn}
                />
              </View>
            ) : (
              <View style={styles.formBody}>
                <Text style={styles.label}>Nome do Perfil (opcional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'xtream_profile' && styles.inputFocused,
                  ]}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="Ex: Minha Sala TV"
                  placeholderTextColor="#5E6982"
                  onFocus={() => setFocusedInput('xtream_profile')}
                  onBlur={() => setFocusedInput(null)}
                />

                <Text style={styles.label}>URL do Servidor / DNS</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'xtream_server' && styles.inputFocused,
                  ]}
                  value={serverUrl}
                  onChangeText={handleServerUrlChange}
                  placeholder="http://servidor.com:8080"
                  placeholderTextColor="#5E6982"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedInput('xtream_server')}
                  onBlur={() => setFocusedInput(null)}
                />

                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>Usuário</Text>
                    <TextInput
                      style={[
                        styles.input,
                        focusedInput === 'xtream_user' && styles.inputFocused,
                      ]}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Seu usuário"
                      placeholderTextColor="#5E6982"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setFocusedInput('xtream_user')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>

                  <View style={styles.halfInput}>
                    <Text style={styles.label}>Senha</Text>
                    <TextInput
                      style={[
                        styles.input,
                        focusedInput === 'xtream_pass' && styles.inputFocused,
                      ]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Sua senha"
                      placeholderTextColor="#5E6982"
                      secureTextEntry
                      onFocus={() => setFocusedInput('xtream_pass')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                <FocusableButton
                  label={loading ? 'Conectando...' : 'Entrar no Axi Player TV'}
                  icon="log-in-outline"
                  onPress={handleXtreamLogin}
                  style={styles.submitBtn}
                />
              </View>
            )}

            {/* Saved Accounts Section */}
            {savedAccounts.length > 0 && (
              <View style={styles.savedSection}>
                <View style={styles.savedHeader}>
                  <Ionicons name="list" size={18} color={colors.primary} />
                  <Text style={styles.savedSectionTitle}>Listas Conectadas Anteriormente</Text>
                </View>

                {savedAccounts.map((item) => {
                  const isItemFocused = focusedAccount === item.id;
                  const isDelFocused = focusedDelete === item.id;

                  return (
                    <View key={item.id} style={styles.savedRow}>
                      <Pressable
                        focusable={true}
                        onFocus={() => setFocusedAccount(item.id)}
                        onBlur={() => setFocusedAccount(null)}
                        onPress={() => handleSelectSavedAccount(item)}
                        style={[
                          styles.savedCard,
                          isItemFocused && styles.savedCardFocused,
                        ]}
                      >
                        <Ionicons
                          name="tv"
                          size={22}
                          color={isItemFocused ? colors.primary : colors.textSecondary}
                        />
                        <View style={styles.savedTextWrapper}>
                          <Text style={[styles.savedName, isItemFocused && styles.savedNameFocused]}>
                            {item.name}
                          </Text>
                          <Text style={styles.savedDetails} numberOfLines={1}>
                            {item.username} • {item.serverUrl}
                          </Text>
                        </View>
                        <View style={styles.quickConnectBadge}>
                          <Text style={styles.quickConnectText}>Conectar ▶</Text>
                        </View>
                      </Pressable>

                      <Pressable
                        focusable={true}
                        onFocus={() => setFocusedDelete(item.id)}
                        onBlur={() => setFocusedDelete(null)}
                        onPress={() => handleRemoveAccount(item.id)}
                        style={[
                          styles.deleteBtn,
                          isDelFocused && styles.deleteBtnFocused,
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={isDelFocused ? '#FFFFFF' : '#FF453A'}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 28,
    paddingVertical: 20,
    gap: 24,
  },

  /* Left Column */
  leftCol: {
    width: '35%',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  brandBox: {
    alignItems: 'flex-start',
  },
  brandEmblem: {
    width: 64,
    height: 64,
    marginBottom: 10,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  brandTv: {
    color: colors.primaryAmber,
    fontWeight: '900',
  },
  brandSubtitle: {
    color: '#9AA4BC',
    fontSize: 13,
    marginTop: 4,
  },
  instructionCard: {
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#1B2338',
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  instructionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  instructionText: {
    color: '#9AA4BC',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  keyBadge: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  authorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    alignSelf: 'flex-start',
  },
  authorBoxFocused: {
    borderColor: colors.primary,
    backgroundColor: '#0E1322',
  },
  authorText: {
    color: '#8A92A6',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Right Column */
  rightCol: {
    flex: 1,
    backgroundColor: '#0E1322',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1B2338',
    overflow: 'hidden',
    padding: 18,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#101628',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#151C30',
    borderColor: colors.primary,
  },
  tabBtnFocused: {
    borderColor: colors.primary,
    transform: [{ scale: 1.02 }],
    backgroundColor: '#1E2845',
  },
  tabBtnText: {
    color: '#9AA4BC',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  /* Form Elements */
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    paddingBottom: 20,
  },
  formBody: {
    gap: 10,
  },
  label: {
    color: '#C8D0E0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#101628',
    borderWidth: 1.5,
    borderColor: '#1B2338',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 52,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: '#0B2238',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
    gap: 4,
  },
  submitBtn: {
    marginTop: 6,
    height: 44,
  },

  /* Detected Card */
  detectedCard: {
    backgroundColor: '#10192A',
    borderWidth: 1,
    borderColor: '#00E5FF33',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  detectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  detectedTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  formatBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  formatBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  detectedLabel: {
    color: '#8A92A6',
    fontSize: 12,
    width: 65,
  },
  detectedValue: {
    color: '#E0E6F0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  /* Saved Accounts */
  savedSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1B2338',
    paddingTop: 16,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  savedSectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  savedCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#101628',
    borderWidth: 1.5,
    borderColor: '#1B2338',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  savedCardFocused: {
    borderColor: colors.primary,
    backgroundColor: '#0B2238',
    transform: [{ scale: 1.02 }],
  },
  savedTextWrapper: {
    flex: 1,
  },
  savedName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  savedNameFocused: {
    color: colors.primary,
  },
  savedDetails: {
    color: '#8A92A6',
    fontSize: 11,
    marginTop: 2,
  },
  quickConnectBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  quickConnectText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1A141A',
    borderWidth: 1.5,
    borderColor: '#3A1E20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnFocused: {
    borderColor: '#FF453A',
    backgroundColor: '#880000',
    transform: [{ scale: 1.08 }],
  },
});
