import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FocusableButton } from '../../src/components/tv/FocusableButton';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';

export default function TVSettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const active = await storage.getActiveProfile();
    setProfile(active);
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Limpar Cache',
      'Deseja limpar os dados temporários de EPG e imagens?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Sucesso', 'Cache temporário esvaziado.');
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza que deseja desconectar este perfil de TV?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            await storage.clearActiveProfile();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Configurações do Axi Player TV</Text>
      <Text style={styles.headerSubtitle}>Gerenciamento de conta, reprodução e sistema</Text>

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👤 PERFIL ATIVO</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nome:</Text>
          <Text style={styles.infoValue}>{profile?.name || 'Servidor TV'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Servidor:</Text>
          <Text style={styles.infoValue}>{profile?.serverUrl || 'Não informado'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, { color: '#4CD964' }]}>Conectado e Autorizado</Text>
        </View>
      </View>

      {/* Playback Settings Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ PREFERÊNCIAS DE TRANSMISSÃO</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Formato Padrão:</Text>
          <Text style={styles.infoValue}>MPEG-TS (.ts) de Alta Resolução</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Motor de Vídeo:</Text>
          <Text style={styles.infoValue}>ExoPlayer Nativo (Hardware Decoding Ativo)</Text>
        </View>
      </View>

      {/* Developer & Version Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⭐ AUTORIA & DESENVOLVIMENTO</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Desenvolvedor Oficial:</Text>
          <Text style={[styles.infoValue, { color: colors.primary }]}>Luirton Gurgel</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Repositório:</Text>
          <Text style={styles.infoValue}>github.com/luirton</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Versão:</Text>
          <Text style={styles.infoValue}>v1.0.0 (Google TV & Android TV)</Text>
        </View>
      </View>

      {/* System Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛠️ AÇÕES DO APLICATIVO</Text>
        <View style={styles.actionButtons}>
          <FocusableButton
            label="Limpar Cache do EPG"
            icon="trash-bin-outline"
            variant="secondary"
            onPress={handleClearCache}
            style={styles.btnSpacing}
          />
          <FocusableButton
            label="Desconectar Servidor"
            icon="log-out-outline"
            variant="danger"
            onPress={handleLogout}
            style={styles.btnSpacing}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#9AA4BC',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#0E1322',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1B2338',
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1B2338',
  },
  infoLabel: {
    color: '#9AA4BC',
    fontSize: 13,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  btnSpacing: {
    marginRight: 16,
  },
});
