import React, { useEffect, useState } from 'react';
import { Image, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY } from '../api/client';
import { API_BASE_URL } from '../config';
import { colors, font } from '../theme';

/**
 * Shows the user's uploaded profile picture and falls back to their initials
 * when there is no image. Profile files are private, so the access token is
 * appended as a query param (an <Image> can't send auth headers) — the same
 * approach used for prescriptions.
 */
export default function ProfileAvatar({ path, name, size = 48, color = colors.primary, ring = false, style }) {
  const [token, setToken] = useState(null);
  useEffect(() => { AsyncStorage.getItem(TOKEN_KEY).then(setToken).catch(() => {}); }, []);

  const initials = (name || 'U').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const uri = path && token ? `${API_BASE_URL}/files/${path}?token=${token}` : null;

  const base = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...(ring ? { borderWidth: 2, borderColor: colors.white } : {}),
  };

  if (uri) {
    return <Image source={{ uri }} style={[base, { backgroundColor: colors.border }, style]} />;
  }
  return (
    <View style={[base, { backgroundColor: color }, style]}>
      <Text style={{ color: colors.white, fontWeight: font.bold, fontSize: size * 0.36 }}>{initials || 'U'}</Text>
    </View>
  );
}
