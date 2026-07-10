import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import ProfileAvatar from './ProfileAvatar';
import { spacing, font } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const PREVIEW_SIZE = Math.min(SCREEN_W * 0.72, 300);

/**
 * Instagram-style profile picture preview: the photo springs open into a circle
 * in the middle of the screen over a real blurred backdrop; tap anywhere to close.
 */
export default function ProfilePreviewModal({ visible, onClose, path, name }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 70 }).start();
  }, [visible, anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="dark"
          blurAmount={18}
          reducedTransparencyFallbackColor="black"
          overlayColor="transparent"
        />
        <Animated.View style={{ opacity: anim, transform: [{ scale }], alignItems: 'center' }}>
          <View style={styles.ring}>
            <ProfileAvatar path={path} name={name} size={PREVIEW_SIZE} />
          </View>
          {name ? <Text style={styles.name}>{name}</Text> : null}
          <Text style={styles.hint}>Tap anywhere to close</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  ring: { padding: 5, borderRadius: (PREVIEW_SIZE + 10) / 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  name: { color: '#4B5563', fontSize: font.h2, fontWeight: font.bold, marginTop: spacing.xl },
  hint: { color: '#6B7280', fontSize: font.small, marginTop: spacing.sm },
});
