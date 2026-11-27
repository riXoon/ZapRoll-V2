import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Animated, 
  Dimensions,
  Platform
} from 'react-native';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Info, 
  HelpCircle 
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

interface FeedbackModalProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'confirm';
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const FeedbackModal = ({ 
  visible, 
  title, 
  message, 
  type, 
  onClose, 
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel'
}: FeedbackModalProps) => {
  const [showModal, setShowModal] = React.useState(visible);
  const [animation] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.spring(animation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7
      }).start();
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) {
          setShowModal(false);
        }
      });
    }
  }, [visible]);

  if (!showModal) return null;

  const getIcon = () => {
    const size = 48;
    switch (type) {
      case 'success':
        return <CheckCircle2 color="#10b981" size={size} />;
      case 'error':
        return <XCircle color="#ef4444" size={size} />;
      case 'info':
        return <Info color="#3b82f6" size={size} />;
      case 'confirm':
        return <HelpCircle color="#f59e0b" size={size} />;
      default:
        return <Info color="#3b82f6" size={size} />;
    }
  };

  const getIconContainerStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: 'rgba(16, 185, 129, 0.1)' };
      case 'error':
        return { backgroundColor: 'rgba(239, 68, 68, 0.1)' };
      case 'info':
        return { backgroundColor: 'rgba(59, 130, 246, 0.1)' };
      case 'confirm':
        return { backgroundColor: 'rgba(245, 158, 11, 0.1)' };
      default:
        return { backgroundColor: 'rgba(59, 130, 246, 0.1)' };
    }
  };

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0]
  });

  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.backdropClickable} 
            onPress={type !== 'confirm' ? onClose : undefined}
          />
        </Animated.View>
        
        <Animated.View style={[styles.contentContainer, { transform: [{ translateY }] }]}>
          <BlurView intensity={80} tint="dark" style={styles.blurCard}>
            <View style={[styles.iconContainer, getIconContainerStyle()]}>
              {getIcon()}
            </View>
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            <View style={styles.buttonContainer}>
              {type === 'confirm' ? (
                <>
                  <TouchableOpacity 
                    style={[styles.button, styles.cancelButton]} 
                    onPress={onClose}
                  >
                    <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.button, styles.confirmButton]} 
                    onPress={() => {
                      onConfirm?.();
                      onClose();
                    }}
                  >
                    <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  style={[styles.button, styles.primaryButton, { backgroundColor: type === 'error' ? '#ef4444' : '#3b82f6' }]} 
                  onPress={onClose}
                >
                  <Text style={styles.primaryButtonText}>Dismiss</Text>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backdropClickable: {
    flex: 1,
  },
  contentContainer: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  blurCard: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
});
