import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FocusableButton } from '../src/components/tv/FocusableButton';
import { colors } from '../src/theme/colors';
import { xtreamClient } from '../src/services/xtreamClient';
import { storage } from '../src/services/storage';

export default function LoginScreen() {
  const router = useRouter();
  const [profileName, setProfileName] = useState('Meu Servidor');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!serverUrl || !username || !password) {
      Alert.alert('Campos Obrigatórios', 'Por favor, preencha URL do Servidor, Usuário e Senha.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanUrl = serverUrl.trim().replace(/\/$/, '');
      xtreamClient.setCredentials(cleanUrl, username.trim(), password.trim());
      const authData = await xtreamClient.authenticate();

      const newProfile = {
        id: `${username.trim()}@${cleanUrl}`,
        name: profileName.trim() || 'Meu Servidor',
        serverUrl: cleanUrl,
        username: username.trim(),
        password: password.trim(),
        createdAt: Date.now(),
        lastLogin: Date.now(),
      };

      await storage.saveProfile(newProfile);
      await storage.setActiveProfile(newProfile);

      router.replace('/(tv)/home');
    } catch (err: any) {
      Alert.alert('Erro ao Conectar', err.message || 'Verifique seus dados e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(255, 106, 0, 0.08)', 'transparent', '#050505']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.contentRow}>
        {/* Left Side: Brand & Instructions */}
        <View style={styles.leftCol}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoLetter}>A</Text>
          </View>
          <Text style={styles.appTitle}>AXI PLAYER TV</Text>
          <Text style={styles.appSubtitle}>Conecte sua lista Xtream Codes ou M3U</Text>

          <View style={styles.instructionBox}>
            <Text style={styles.instructionTitle}>💡 Dica de Navegação:</Text>
            <Text style={styles.instructionText}>
              Utilize o direcional (D-Pad) do controle remoto para alternar entre os campos e aperte OK no controle para digitar.
            </Text>
          </View>
        </View>

        {/* Right Side: Form Inputs */}
        <View style={styles.rightCol}>
          <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Nome do Perfil</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'profile' && styles.inputFocused,
              ]}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Ex: Minha TV"
              placeholderTextColor="#555555"
              onFocus={() => setFocusedInput('profile')}
              onBlur={() => setFocusedInput(null)}
            />

            <Text style={styles.fieldLabel}>URL do Servidor (com porta se houver)</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'url' && styles.inputFocused,
              ]}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://dns.exemplo.com:8080"
              placeholderTextColor="#555555"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedInput('url')}
              onBlur={() => setFocusedInput(null)}
            />

            <Text style={styles.fieldLabel}>Usuário</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'user' && styles.inputFocused,
              ]}
              value={username}
              onChangeText={setUsername}
              placeholder="Seu usuário"
              placeholderTextColor="#555555"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedInput('user')}
              onBlur={() => setFocusedInput(null)}
            />

            <Text style={styles.fieldLabel}>Senha</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'pass' && styles.inputFocused,
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha"
              placeholderTextColor="#555555"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedInput('pass')}
              onBlur={() => setFocusedInput(null)}
            />

            <View style={styles.buttonWrapper}>
              {isLoading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <FocusableButton
                  label="CONECTAR E ENTRAR"
                  icon="log-in-outline"
                  onPress={handleLogin}
                  hasTVPreferredFocus={true}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    padding: 32,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  leftCol: {
    flex: 1,
    paddingRight: 40,
    justifyContent: 'center',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoLetter: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  appSubtitle: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 24,
  },
  instructionBox: {
    backgroundColor: '#141416',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  instructionTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  instructionText: {
    color: '#A0A0A5',
    fontSize: 12,
    lineHeight: 18,
  },
  rightCol: {
    flex: 1.2,
    backgroundColor: '#0E0E12',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1C1C22',
  },
  formContainer: {
    paddingBottom: 16,
  },
  fieldLabel: {
    color: '#C0C0C5',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#16161A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: colors.focusRing,
    backgroundColor: '#1E1E24',
    transform: [{ scale: Platform.isTV ? 1.02 : 1 }],
  },
  buttonWrapper: {
    marginTop: 24,
  },
});
