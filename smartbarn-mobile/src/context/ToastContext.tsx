import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Animated, 
  TouchableOpacity 
} from 'react-native';
import { COLORS, SHADOWS } from '../theme';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');
  const [visible, setVisible] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-100)).current;

  const showToast = useCallback((msg: string, t: ToastType = 'success') => {
    setMessage(msg);
    setType(t);
    setVisible(true);

    // Animasi Masuk
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 20, useNativeDriver: true, friction: 5 })
    ]).start();

    // Otomatis Tutup setelah 3 detik
    setTimeout(hideToast, 3500);
  }, []);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true })
    ]).start(() => setVisible(false));
  }, []);

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 size={20} color={COLORS.success} />;
      case 'error': return <AlertCircle size={20} color={COLORS.danger} />;
      default: return <Info size={20} color={COLORS.primary} />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success': return COLORS.success;
      case 'error': return COLORS.danger;
      default: return COLORS.primary;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View 
          style={[
            styles.toastContainer, 
            { 
              opacity: fadeAnim, 
              transform: [{ translateY }],
              borderLeftColor: getBorderColor() 
            }
          ]}
        >
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>
          <Text style={styles.messageText}>{message}</Text>
          <TouchableOpacity onPress={hideToast} style={styles.closeBtn}>
            <X size={16} color={COLORS.textLight} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 5,
    ...SHADOWS.md,
    zIndex: 9999,
  },
  iconContainer: {
    marginRight: 12,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  closeBtn: {
    marginLeft: 12,
    padding: 4,
  },
});
