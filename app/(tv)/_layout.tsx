import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import { TVSidebar } from '../../src/components/tv/TVSidebar';

export default function TVLayout() {
  const pathname = usePathname();
  const isLive = pathname?.includes('/live');

  return (
    <View style={styles.container}>
      {!isLive && <TVSidebar />}
      <View style={styles.mainContent}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#050505',
  },
  mainContent: {
    flex: 1,
    height: '100%',
  },
});
