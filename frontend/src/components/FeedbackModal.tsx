import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Animated, 
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { 
  CheckCircle2, 
  XCircle, 
  Info, 
  HelpCircle 
} from 'lucide-react-native';
import { eventLayout } from './eventLayout';
import { eventPalette as palette } from './eventPalette';

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
  const { height, fontScale } = useWindowDimensions();
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
    const size = 28;
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
        
        <Animated.View accessibilityViewIsModal style={[styles.contentContainer, { transform: [{ translateY }] }]}>
          <ScrollView bounces={false} contentContainerStyle={styles.cardContent}>
            <View style={[styles.iconContainer, getIconContainerStyle()]}>
              {getIcon()}
            </View>
            
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            <View style={[styles.buttonContainer, fontScale > 1.3 && styles.stackedButtons]}>
              {type === 'confirm' ? (
                <>
                  <TouchableOpacity 
                    accessibilityRole="button"
                    style={[styles.button, styles.cancelButton]} 
                    onPress={onClose}
                  >
                    <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    accessibilityRole="button"
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
                  accessibilityRole="button" style={[styles.button, styles.confirmButton]}
                  onPress={onClose}
                >
                  <Text style={styles.confirmButtonText}>Dismiss</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
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
    ...eventLayout.panel,
    width: '90%',
    maxWidth: 400,
    maxHeight: '86%',
    overflow: 'hidden',
  },
  cardContent: {
    padding: 20,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    ...eventLayout.detailTitle,
    marginBottom: 8,
  },
  message: {
    ...eventLayout.body,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  stackedButtons: { flexDirection: 'column' },
  button: {
    flexGrow: 1,
    minHeight: 50,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: palette.primary,
  },
  confirmButtonText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: palette.edge,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    color: palette.secondary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
