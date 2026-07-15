import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileApi } from '../api';
import { useAuth } from './AuthContext';

const SELECTED_KEY = 'nd_delivery_address_id';

const DeliveryContext = createContext(null);

/**
 * The delivery address the whole pharmacy flow is built around.
 *
 * It is deliberately NOT the phone's GPS: someone in Delhi ordering medicine for
 * their family home in Mohali must see Mohali pharmacies. The address decides
 * which pharmacies are shown (backend scopes the catalog to those within 10 km
 * of it, or in a matching city) — so browsing and checkout MUST agree on it.
 * If they disagreed, a user could add a medicine to their cart and then be
 * refused at checkout because that pharmacy doesn't reach the chosen address.
 * Hence one shared selection, here, rather than per-screen state.
 */
export function DeliveryProvider({ children }) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressIdState] = useState(null);
  const [loading, setLoading] = useState(true);

  const setAddressId = useCallback((id) => {
    setAddressIdState(id);
    // Remembered across launches so the user isn't re-picking every session.
    AsyncStorage.setItem(SELECTED_KEY, String(id)).catch(() => {});
  }, []);

  const reload = useCallback(async () => {
    if (!user) { setAddresses([]); setAddressIdState(null); setLoading(false); return; }
    setLoading(true);
    try {
      const list = (await ProfileApi.addresses()) || [];
      setAddresses(list);

      const saved = await AsyncStorage.getItem(SELECTED_KEY);
      // The remembered address may have been deleted since — fall back rather
      // than keeping an id the server will reject.
      const stillExists = list.find((a) => String(a.id) === String(saved));
      const fallback = list.find((a) => a.is_default) || list[0];
      const chosen = stillExists || fallback || null;
      setAddressIdState(chosen ? chosen.id : null);
    } catch (e) {
      // Offline / transient: keep whatever we had rather than blanking the UI.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (payload) => {
    const created = await ProfileApi.addAddress(payload);
    setAddresses((list) => [created, ...list]);
    setAddressId(created.id);
    return created;
  }, [setAddressId]);

  const update = useCallback(async (id, payload) => {
    const updated = await ProfileApi.updateAddress(id, payload);
    setAddresses((list) => list.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await ProfileApi.deleteAddress(id);
    const next = addresses.filter((a) => a.id !== id);
    setAddresses(next);
    // If the deleted address was the selected one, fall back to the default /
    // first remaining address so the catalog isn't left scoped to nothing.
    if (addressId === id) {
      const fallback = next.find((a) => a.is_default) || next[0] || null;
      if (fallback) {
        setAddressId(fallback.id);
      } else {
        setAddressIdState(null);
        AsyncStorage.removeItem(SELECTED_KEY).catch(() => {});
      }
    }
  }, [addresses, addressId, setAddressId]);

  const address = useMemo(
    () => addresses.find((a) => a.id === addressId) || null,
    [addresses, addressId]
  );

  const value = useMemo(
    () => ({ addresses, address, addressId, setAddressId, add, update, remove, reload, loading }),
    [addresses, address, addressId, setAddressId, add, update, remove, reload, loading]
  );

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}

export function useDelivery() {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error('useDelivery must be used inside a DeliveryProvider');
  return ctx;
}
