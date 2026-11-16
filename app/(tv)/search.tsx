import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FocusableCard } from '../../src/components/tv/FocusableCard';
import { xtreamClient } from '../../src/services/xtreamClient';
import { colors } from '../../src/theme/colors';

const KEYBOARD_KEYS = [
  ['A', 'B', 'C', 'D', 'E', 'F', '1', '2', '3'],
  ['G', 'H', 'I', 'J', 'K', 'L', '4', '5', '6'],
  ['M', 'N', 'O', 'P', 'Q', 'R', '7', '8', '9'],
  ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0'],
  ['ESPAÇO', 'APAGAR', 'LIMPAR'],
];

export default function TVSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleKeyPress = (char: string) => {
    if (char === 'ESPAÇO') {
      setQuery((prev) => prev + ' ');
    } else if (char === 'APAGAR') {
      setQuery((prev) => prev.slice(0, -1));
    } else if (char === 'LIMPAR') {
      setQuery('');
      setResults([]);
    } else {
      const nextQuery = query + char;
      setQuery(nextQuery);
      performSearch(nextQuery);
    }
  };

  const performSearch = async (searchTerm: string) => {
    if (searchTerm.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const [liveList, vodList] = await Promise.all([
        xtreamClient.getLiveStreams().catch(() => []),
        xtreamClient.getVodStreams().catch(() => []),
      ]);

      const lower = searchTerm.toLowerCase();
      const filteredLive = (liveList as any[])
        .filter((item: any) => item.name?.toLowerCase().includes(lower))
        .map((item: any) => ({ ...item, type: 'live' }));

      const filteredVod = (vodList as any[])
        .filter((item: any) => item.name?.toLowerCase().includes(lower))
        .map((item: any) => ({ ...item, type: 'movie' }));

      setResults([...filteredLive, ...filteredVod]);
    } catch (err) {
      console.error('Error during search:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenItem = (item: any) => {
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(item.stream_id),
        type: item.type,
        name: item.name,
      },
    });
  };

  return (
    <View style={styles.container}>
      {/* Left Column: TV On-Screen D-Pad Keyboard */}
      <View style={styles.keyboardColumn}>
        <View style={styles.inputBox}>
          <Ionicons name="search" size={18} color={colors.primary} style={styles.searchIcon} />
          <Text style={styles.inputText}>
            {query || 'Digite com o controle remoto...'}
          </Text>
        </View>

        <View style={styles.keyboardGrid}>
          {KEYBOARD_KEYS.map((row, rIdx) => (
            <View key={rIdx} style={styles.keyRow}>
              {row.map((char) => (
                <TVKey
                  key={char}
                  char={char}
                  onPress={() => handleKeyPress(char)}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Right Column: Search Results */}
      <View style={styles.resultsColumn}>
        <Text style={styles.resultsHeader}>
          Resultados ({results.length}) {isSearching && '...'}
        </Text>

        <FlatList
          data={results}
          numColumns={3}
          keyExtractor={(item, index) => `${item.stream_id}_${index}`}
          contentContainerStyle={styles.resultsGrid}
          renderItem={({ item }) => (
            <FocusableCard
              title={item.name}
              imageUrl={item.stream_icon}
              badge={item.type === 'live' ? 'Ao Vivo' : 'Filme'}
              width={130}
              aspectRatio={item.type === 'live' ? 16 / 9 : 2 / 3}
              onPress={() => handleOpenItem(item)}
              style={styles.cardSpacing}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>
                {query.length > 0 ? 'Nenhum resultado encontrado' : 'Busque canais, filmes ou séries'}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

function TVKey({ char, onPress }: { char: string; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);
  const isSpecial = char.length > 1;

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={[
        styles.keyButton,
        isSpecial && styles.specialKey,
        isFocused && styles.keyFocused,
      ]}
    >
      <Text style={[styles.keyText, isFocused && styles.keyTextFocused]}>
        {char}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#050505',
    padding: 16,
  },
  keyboardColumn: {
    width: 380,
    backgroundColor: '#0E0E12',
    borderRadius: 10,
    padding: 16,
    marginRight: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222228',
  },
  searchIcon: {
    marginRight: 8,
  },
  inputText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  keyboardGrid: {
    flex: 1,
    justifyContent: 'center',
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  keyButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#1A1A22',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  specialKey: {
    aspectRatio: undefined,
    paddingVertical: 10,
  },
  keyFocused: {
    borderColor: colors.focusRing,
    backgroundColor: 'rgba(255, 160, 0, 0.3)',
  },
  keyText: {
    color: '#D0D0D5',
    fontSize: 14,
    fontWeight: 'bold',
  },
  keyTextFocused: {
    color: '#FFFFFF',
  },
  resultsColumn: {
    flex: 1,
    backgroundColor: '#0E0E12',
    borderRadius: 10,
    padding: 16,
  },
  resultsHeader: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  resultsGrid: {
    paddingBottom: 24,
  },
  cardSpacing: {
    marginRight: 10,
    marginBottom: 14,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#55555B',
    marginTop: 12,
    fontSize: 13,
  },
});
