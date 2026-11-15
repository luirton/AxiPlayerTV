import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { TVSidebar } from '../../src/components/tv/TVSidebar';

export default function TVLayout() {
  return (
    <View style={styles.container}>
      <TVSidebar />
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
