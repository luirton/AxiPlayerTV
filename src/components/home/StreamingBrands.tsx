import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FocusableItem } from '../common/FocusableItem';

const { width } = Dimensions.get('window');

export interface StreamingBrand {
  id: string;
  name: string;
  keywords: string[];
  gradient: [string, string];
  borderColor: string;
  textColor: string;
  customText?: string;
  subText?: string;
}

export const STREAMING_BRANDS: StreamingBrand[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    keywords: ['netflix'],
    gradient: ['#1c1c1c', '#080808'],
    borderColor: '#E50914',
    textColor: '#E50914',
    customText: 'NETFLIX',
  },
  {
    id: 'prime',
    name: 'Prime Video',
    keywords: ['prime', 'amazon'],
    gradient: ['#001f3f', '#000c1a'],
    borderColor: '#00A8E1',
    textColor: '#00A8E1',
    customText: 'prime video',
  },
  {
    id: 'disney',
    name: 'Disney+',
    keywords: ['disney', 'disney+'],
    gradient: ['#0f2b5c', '#040d21'],
    borderColor: '#3FA9F5',
    textColor: '#FFFFFF',
    customText: 'Disney+',
  },
  {
    id: 'max',
    name: 'Max (HBO)',
    keywords: ['max', 'hbo'],
    gradient: ['#002288', '#000c3b'],
    borderColor: '#1F6FFF',
    textColor: '#FFFFFF',
    customText: 'max',
  },
  {
    id: 'globoplay',
    name: 'Globoplay',
    keywords: ['globo', 'globoplay'],
    gradient: ['#3b0a16', '#140007'],
    borderColor: '#FF2E63',
    textColor: '#FF3366',
    customText: 'globoplay',
  },
  {
    id: 'apple',
    name: 'Apple TV+',
    keywords: ['apple', 'apple tv'],
    gradient: ['#2a2a2e', '#111114'],
    borderColor: '#777785',
    textColor: '#FFFFFF',
    customText: 'tv+',
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    keywords: ['paramount', 'paramount+'],
    gradient: ['#0038a8', '#001347'],
    borderColor: '#0066FF',
    textColor: '#FFFFFF',
    customText: 'Paramount+',
  },
];

interface Props {
  onSelectBrand: (brand: StreamingBrand) => void;
}

export const StreamingBrandsRow: React.FC<Props> = ({ onSelectBrand }) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Plataformas de Streaming</Text>
        <Text style={styles.sectionSubtitle}>Filmes & Séries Exclusivos</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {STREAMING_BRANDS.map((brand) => (
          <FocusableItem
            key={brand.id}
            style={styles.cardWrapper}
            onPress={() => onSelectBrand(brand)}
          >
            <LinearGradient
              colors={brand.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.brandCard, { borderColor: brand.borderColor }]}
            >
              <Text style={[styles.brandText, { color: brand.textColor }]}>
                {brand.customText || brand.name}
              </Text>
            </LinearGradient>
          </FocusableItem>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  titleRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  scrollList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  cardWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  brandCard: {
    width: 136,
    height: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  brandText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
