import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import { Category, SeriesStream } from '../../src/types/iptv';

export default function TVSeriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [seriesList, setSeriesList] = useState<SeriesStream[]>([]);
  const [focusedSeries, setFocusedSeries] = useState<SeriesStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSeriesCategories();
  }, []);

  const loadSeriesCategories = async () => {
    try {
      setIsLoading(true);
      const profile = await storage.getActiveProfile();
      if (!profile) return;
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

      const cats = await xtreamClient.getSeriesCategories();
      setCategories(cats);

      if (cats.length > 0) {
        setSelectedCategory(cats[0]);
        loadSeries(cats[0].category_id);
      }
    } catch (err) {
      console.error('Error loading series categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSeries = async (categoryId: string) => {
    try {
      const list = await xtreamClient.getSeries(categoryId);
      setSeriesList(list);
      if (list.length > 0) {
        setFocusedSeries(list[0]);
      }
    } catch (err) {
      console.error('Error loading series:', err);
    }
  };

  const handleOpenSeriesDetails = (series: SeriesStream) => {
    // Navigate to player or episodes modal
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(series.series_id),
        type: 'series',
        name: series.name,
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Séries...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Half: Dynamic Preview of Focused Series */}
      <View style={styles.previewHeader}>
        {focusedSeries?.cover ? (
          <Image
            source={{ uri: focusedSeries.cover }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        ) : null}

        <LinearGradient
          colors={['transparent', 'rgba(5, 5, 5, 0.85)', '#050505']}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['rgba(5, 5, 5, 0.95)', 'rgba(5, 5, 5, 0.5)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.previewContent}>
          <Text style={styles.categoryBadge}>
            {selectedCategory?.category_name.toUpperCase() || 'SÉRIES'}
          </Text>
          <Text style={styles.previewTitle} numberOfLines={2}>
            {focusedSeries?.name || 'Selecione uma série'}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.badgeHD}>
              <Text style={styles.badgeHDText}>Série Completa</Text>
            </View>
            <Text style={styles.ratingText}>
              ⭐ {focusedSeries?.rating_5based ? (Number(focusedSeries.rating_5based) * 2).toFixed(1) : '8.6'}
            </Text>
            <Text style={styles.yearText}>Temporadas e Episódios</Text>
          </View>

          <Text style={styles.synopsisText} numberOfLines={2}>
            Selecione uma temporada para assistir a todos os episódios em ordem, com continuação automática de reprodução.
          </Text>
        </View>
      </View>

      {/* Categories Bar */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((cat) => {
            const isSelected = selectedCategory?.category_id === cat.category_id;
            return (
              <View
                key={cat.category_id}
                style={[styles.pillContainer, isSelected && styles.pillSelected]}
              >
                <Text
                  style={[styles.pillText, isSelected && styles.pillTextSelected]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    loadSeries(cat.category_id);
                  }}
                >
                  {cat.category_name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Series Cards Row */}
      <View style={styles.seriesGrid}>
        <FlatList
          horizontal
          data={seriesList}
          keyExtractor={(item) => String(item.series_id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.seriesScroll}
          renderItem={({ item }) => (
            <FocusableCard
              title={item.name}
              imageUrl={item.cover}
              rating={item.rating_5based ? (Number(item.rating_5based) * 2).toFixed(1) : undefined}
              width={140}
              aspectRatio={2 / 3}
              onFocus={() => setFocusedSeries(item)}
              onPress={() => handleOpenSeriesDetails(item)}
            />
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 16,
    fontSize: 14,
  },
  previewHeader: {
    height: 220,
    backgroundColor: '#0E0E14',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  previewContent: {
    maxWidth: '65%',
  },
  categoryBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeHD: {
    backgroundColor: colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeHDText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  yearText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  synopsisText: {
    color: '#A0A0A5',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  categoryBar: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#16161C',
    justifyContent: 'center',
  },
  categoryScroll: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  pillContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#16161C',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillSelected: {
    backgroundColor: 'rgba(255, 106, 0, 0.15)',
    borderColor: colors.primary,
  },
  pillText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  seriesGrid: {
    flex: 1,
    paddingVertical: 12,
  },
  seriesScroll: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
});
