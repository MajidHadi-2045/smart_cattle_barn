import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';
import { Beef } from 'lucide-react-native';
import { COLORS } from '../theme';

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Memuat Data...' }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // 1. Animasi Berputar (Rotate Ring)
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 2. Animasi Denyut (Pulse Icon)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.spinnerWrapper}>
        {/* Ring Luar yang Berputar */}
        <Animated.View style={[styles.outerRing, { transform: [{ rotate: spin }] }]}>
          <View style={styles.ringDot} />
        </Animated.View>

        {/* Ring Dalam yang Statis */}
        <View style={styles.innerRing} />

        {/* Icon di Tengah yang Berdenyut */}
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Beef size={24} color={COLORS.primary} />
        </Animated.View>
      </View>
      
      {/* Teks Animasi Memuat */}
      {message && <Text style={styles.loadingText}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  spinnerWrapper: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: COLORS.primary, // Memberikan efek ring berputar dengan bagian atas berwarna
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  ringDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    top: -2,
  },
  innerRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#e2e8f0', // Slate-200 ring background tipis
    opacity: 0.5,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4', // Primary Light BG
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0', // Green-200 border
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b', // Slate-500
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});

export default LoadingSpinner;
