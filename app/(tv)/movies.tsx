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
import { FocusableButton } from '../../src/components/tv/FocusableButton';
import { xtreamClient } from '../../src/services/xtreamClient';
import { storage } from '../../src/services/storage';
import { colors } from '../../src/theme/colors';
import { Category, VodStream } from '../../src/types/iptv';

export default function TVMoviesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [focusedMovie, setFocusedMovie] = useState<VodStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMovieCategories();
  }, []);

  const loadMovieCategories = async () => {
    try {
      setIsLoading(true);
      const profile = await storage.getActiveProfile();
      if (!profile) return;
      xtreamClient.setCredentials(profile.serverUrl, profile.username, profile.password);

      const cats = await xtreamClient.getVodCategories();
      setCategories(cats);

      if (cats.length > 0) {
        setSelectedCategory(cats[0]);
        loadMovies(cats[0].category_id);
      }
    } catch (err) {
      console.error('Error loading movie categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovies = async (categoryId: string) => {
    try {
      const list = await xtreamClient.getVodStreams(categoryId);
      setMovies(list);
      if (list.length > 0) {
        setFocusedMovie(list[0]);
      }
    } catch (err) {
      console.error('Error loading movies:', err);
    }
  };

  const handlePlayMovie = (movie: VodStream) => {
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(movie.stream_id),
        type: 'movie',
        name: movie.name,
        container: movie.container_extension || 'mp4',
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Catálogo de Filmes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Half: Dynamic Preview of Focused Movie */}
      <View style={styles.previewHeader}>
        {focusedMovie?.stream_icon ? (
          <Image
            source={{ uri: focusedMovie.stream_icon }}
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
            {selectedCategory?.category_name.toUpperCase() || 'FILMES'}
          </Text>
          <Text style={styles.previewTitle} numberOfLines={2}>
            {focusedMovie?.name || 'Selecione um título'}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.badgeHD}>
              <Text style={styles.badgeHDText}>Full HD</Text>
            </View>
            <Text style={styles.ratingText}>
              ⭐ {focusedMovie?.rating_5based ? (Number(focusedMovie.rating_5based) * 2).toFixed(1) : '8.0'}
            </Text>
            <Text style={styles.yearText}>VOD</Text>
          </View>

          <Text style={styles.synopsisText} numberOfLines={2}>
            Navegue pelo controle remoto para ver detalhes, capas e sinopses em tempo real. Pressione OK para reproduzir.
          </Text>

          {focusedMovie && (
            <View style={styles.actionRow}>
              <FocusableButton
                label="ASSISTIR FILME"
                icon="play"
                onPress={() => handlePlayMovie(focusedMovie)}
              />
            </View>
          )}
        </View>
      </View>

      {/* Horizontal Categories Bar */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((cat) => {
            const isSelected = selectedCategory?.category_id === cat.category_id;
            return (
              <CategoryPill
                key={cat.category_id}
                title={cat.category_name}
                isSelected={isSelected}
                onPress={() => {
                  setSelectedCategory(cat);
                  loadMovies(cat.category_id);
                }}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Horizontal Row of Movie Cards */}
      <View style={styles.moviesGrid}>
        <FlatList
          horizontal
          data={movies}
          keyExtractor={(item) => String(item.stream_id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moviesScroll}
          renderItem={({ item }) => (
            <FocusableCard
              title={item.name}
              imageUrl={item.stream_icon}
              rating={item.rating_5based ? (Number(item.rating_5based) * 2).toFixed(1) : undefined}
              width={140}
              aspectRatio={2 / 3}
              onFocus={() => setFocusedMovie(item)}
              onPress={() => handlePlayMovie(item)}
            />
          )}
        />
      </View>
    </View>
  );
}

function CategoryPill({
  title,
  isSelected,
  onPress,
}: {
  title: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.pillContainer,
        isSelected && styles.pillSelected,
        isFocused && styles.pillFocused,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          isSelected && styles.pillTextSelected,
          isFocused && styles.pillTextFocused,
        ]}
        onPress={onPress}
      >
        {title}
      </Text>
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
    position: 'relative',
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
  actionRow: {
    flexDirection: 'row',
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
  pillFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(255, 160, 0, 0.25)',
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
  pillTextFocused: {
    color: '#FFFFFF',
  },
  moviesGrid: {
    flex: 1,
    paddingVertical: 12,
  },
  moviesScroll: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
});
