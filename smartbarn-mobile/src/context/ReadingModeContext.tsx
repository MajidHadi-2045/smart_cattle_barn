import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ReadingModeContextType {
  isReadingMode: boolean;
  toggleReadingMode: () => void;
}

const ReadingModeContext = createContext<ReadingModeContextType>({
  isReadingMode: false,
  toggleReadingMode: () => {},
});

export const useReadingMode = () => useContext(ReadingModeContext);

export const ReadingModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReadingMode, setIsReadingMode] = useState(false);

  useEffect(() => {
    const loadState = async () => {
      try {
        const state = await AsyncStorage.getItem('readingMode');
        if (state !== null) {
          setIsReadingMode(JSON.parse(state));
        }
      } catch (err) {
        console.error('Gagal meload readingMode state', err);
      }
    };
    loadState();
  }, []);

  const toggleReadingMode = async () => {
    try {
      const newState = !isReadingMode;
      setIsReadingMode(newState);
      await AsyncStorage.setItem('readingMode', JSON.stringify(newState));
    } catch (err) {
      console.error('Gagal menyimpan readingMode state', err);
    }
  };

  return (
    <ReadingModeContext.Provider value={{ isReadingMode, toggleReadingMode }}>
      <View style={styles.container}>
        {children}
        {isReadingMode && (
          <View 
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255, 175, 100, 0.2)', zIndex: 999999 }]} 
            pointerEvents="none" 
          />
        )}
      </View>
    </ReadingModeContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
