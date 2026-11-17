import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FocusableButton } from '../../src/components/tv/FocusableButton';
import { storage } from '../../src/services/storage';
import { xtreamClient, XtreamClient } from '../../src/services/xtreamClient';
import { colors } from '../../src/theme/colors';

export default function TVSettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isReloadingList, setIsReloadingList] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [active, currentSettings] = await Promise.all([
      storage.getActiveProfile(),
      storage.getSettings(),
    ]);
    setProfile(active);
    setSettings(currentSettings);
  };

  const handleSelectReloadDays = async (days: number) => {
    const updated = await storage.saveSettings({ playlistReloadDays: days });
    setSettings(updated);
  };

  const handleForceReloadPlaylist = async () => {
    if (!profile) {
      Alert.alert('Conta não encontrada', 'Faça login novamente.');
      return;
    }
    setIsReloadingList(true);
    try {
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);
      XtreamClient.clearCache();

      await Promise.all([
        xtreamClient.getLiveCategories(),
        xtreamClient.getVodCategories(),
        xtreamClient.getSeriesCategories(),
      ]);

      await storage.markPlaylistReloaded();
      const updated = await storage.getSettings();
      setSettings(updated);
      Alert.alert(
        'Lista Atualizada',
        'Canais, filmes e séries foram sincronizados com sucesso junto ao servidor IPTV!'
      );
    } catch (e: any) {
      Alert.alert('Erro ao Atualizar', e?.message || 'Falha ao conectar ao servidor IPTV.');
    } finally {
      setIsReloadingList(false);
    }
  };

  const getLastReloadText = () => {
    const last = settings?.lastPlaylistReloadTimestamp;
    if (!last) return 'Nunca sincronizado';
    const diffHours = Math.floor((Date.now() - last) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Atualizado há poucos minutos';
    if (diffHours < 24) return `Atualizado há ${diffHours} horas`;
    const diffDays = Math.floor(diffHours / 24);
    return `Atualizado há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Limpar Cache',
      'Deseja limpar os dados temporários de EPG, capas e memória?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () => {
            XtreamClient.clearCache();
            Alert.alert('Sucesso', 'Cache temporário de TV esvaziado.');
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

  const currentReloadDays = settings?.playlistReloadDays || 3;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Configurações do Axi Player TV</Text>
      <Text style={styles.headerSubtitle}>Gerenciamento de conta, sincronização e sistema</Text>

      {/* Sincronização & Intervalo de Recarga (3 a 5 dias) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 SINCRONIZAÇÃO DA LISTA IPTV</Text>
        <Text style={styles.sectionSubtitle}>
          Defina o intervalo em dias para recarregar canais e filmes automaticamente ao ligar a TV:
        </Text>

        <View style={styles.reloadDaysRow}>
          {[3, 4, 5].map((days) => {
            const isSelected = currentReloadDays === days;
            return (
              <Pressable
                key={days}
                focusable={true}
                onPress={() => handleSelectReloadDays(days)}
                style={({ focused }: any) => [
                  styles.reloadDayPill,
                  isSelected && styles.reloadDayPillSelected,
                  focused && styles.reloadDayPillFocused,
                ]}
              >
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={isSelected ? colors.primary : '#6E7687'}
                />
                <Text
                  style={[
                    styles.reloadDayText,
                    isSelected && styles.reloadDayTextSelected,
                  ]}
                >
                  {days} Dias {days === 5 ? '(Recomendado)' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.reloadStatusRow}>
          <View>
            <Text style={styles.statusLabel}>Última Atualização:</Text>
            <Text style={styles.statusValue}>{getLastReloadText()}</Text>
          </View>

          <FocusableButton
            label={isReloadingList ? 'Sincronizando...' : 'Atualizar Lista Agora'}
            icon="sync"
            variant="primary"
            onPress={handleForceReloadPlaylist}
          />
        </View>
      </View>

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
            label="Limpar Cache do EPG & Capas"
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
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#1B2338',
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#9AA4BC',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  reloadDaysRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  reloadDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#151C30',
    borderWidth: 1.5,
    borderColor: '#1B2338',
  },
  reloadDayPillSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  reloadDayPillFocused: {
    borderColor: colors.focusRing,
    transform: [{ scale: 1.05 }],
  },
  reloadDayText: {
    color: '#C5C9D6',
    fontSize: 13,
    fontWeight: '700',
  },
  reloadDayTextSelected: {
    color: colors.primary,
  },
  reloadStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1B2338',
  },
  statusLabel: {
    color: '#6E7687',
    fontSize: 11,
    fontWeight: '600',
  },
  statusValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
