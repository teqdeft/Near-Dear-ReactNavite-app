import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDelivery } from '../store/DeliveryContext';
import { errMessage } from '../api/client';
import { Card, Pill, Muted, Row, AppButton, TextField, SectionTitle } from './UI';
import LocationPicker from './LocationPicker';
import CityPicker from './CityPicker';
import Icon from './Icon';
import { cityCoords } from '../constants/cities';
import { colors, spacing, font, radius } from '../theme';

const EMPTY = { name: 'Home', address_line_1: '', city: '', pincode: '', latitude: null, longitude: null };

/**
 * "Deliver to <address>" bar for the pharmacy screens.
 *
 * The catalog is scoped to whichever address is selected here — pharmacies
 * within 10 km of it, or in a matching city. That is why this is prominent
 * rather than buried in checkout: change the address and the whole shop changes,
 * which is exactly what someone ordering for their parents in another city needs.
 */
export default function DeliverToBar() {
  const { address, addresses, setAddressId, add } = useDelivery();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setOpen(true)} style={styles.bar}>
        <Icon name="location" size={17} color={colors.pharmacy} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.barLabel}>Deliver to</Text>
          <Text style={styles.barValue} numberOfLines={1}>
            {address
              ? `${address.name || address.address_type} — ${address.city}`
              : 'Add a delivery address'}
          </Text>
        </View>
        <Icon name="next" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <AddressSheet
          addresses={addresses}
          selectedId={address?.id}
          onSelect={(id) => { setAddressId(id); setOpen(false); }}
          onAdd={add}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

// The picker sheet: choose an existing address, or pin a new one.
function AddressSheet({ addresses, selectedId, onSelect, onAdd, onClose }) {
  const [adding, setAdding] = useState(addresses.length === 0);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Changing the city invalidates any pin already dropped — a house in Mohali
  // saved under the label "Kharar" would put the address kilometres from where
  // the user thinks it is. Clear it and let them re-pin in the new city.
  const setCity = (city) => setForm((f) => ({ ...f, city, latitude: null, longitude: null }));

  // We only have coordinates for the cities we ship. For anywhere else the map
  // has nowhere to jump to, so we don't show it: the pin stays null and the
  // pharmacies are matched on the city NAME instead of distance.
  const cityCentre = cityCoords(form.city);

  const save = async () => {
    if (!form.address_line_1.trim() || !form.city.trim()) {
      return Alert.alert('Address', 'Please enter the address and city.');
    }
    setSaving(true);
    try {
      const created = await onAdd({
        ...form,
        address_type: 'home',
        is_default: addresses.length === 0,
      });
      onSelect(created.id);
    } catch (e) {
      Alert.alert('Could not save', errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <Row style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>Delivery address</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </Row>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Muted style={{ marginBottom: spacing.md }}>
          We show you pharmacies near this address — not near where your phone is right now.
        </Muted>

        {addresses.map((a) => (
          <Card key={a.id} onPress={() => onSelect(a.id)}
            style={[styles.opt, a.id === selectedId && styles.optActive]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.optTitle}>{a.name || a.address_type}</Text>
              {a.id === selectedId ? <Pill label="Selected" color={colors.pharmacy} /> : null}
            </Row>
            <Muted style={{ marginTop: 2 }}>{a.address_line_1}, {a.city} {a.pincode}</Muted>
            {a.latitude == null ? (
              // An unpinned address can only be matched by city name, so it
              // misses a pharmacy one town over. Say so, don't hide it.
              <Muted style={{ marginTop: 4, color: colors.warning }}>
                Not pinned on the map — you may be missing nearby pharmacies.
              </Muted>
            ) : null}
          </Card>
        ))}

        {adding ? (
          <Card style={{ marginTop: spacing.sm }}>
            <SectionTitle style={{ marginBottom: spacing.sm }}>New address</SectionTitle>
            <TextField label="Label" value={form.name} onChangeText={(v) => set('name', v)} />
            <TextField label="Address *" value={form.address_line_1} onChangeText={(v) => set('address_line_1', v)} multiline />
            <CityPicker
              label="City *"
              value={form.city}
              onChange={setCity}
              color={colors.pharmacy}
              hint="Pick your city and the map below jumps there."
            />
            <TextField label="Pincode" keyboardType="number-pad" maxLength={6}
              value={form.pincode} onChangeText={(v) => set('pincode', v)} />

            {cityCentre ? (
              <>
                {/* autoLocate off, city-centred instead: the address being saved is
                    often somewhere the user is NOT (ordering for family in another
                    city), so pinning the phone's position under their label would
                    hide every pharmacy actually near that home. */}
                <LocationPicker
                  autoLocate={false}
                  center={cityCentre}
                  label="Move the map so the pin is on the delivery point"
                  value={form.latitude != null ? { latitude: form.latitude, longitude: form.longitude } : null}
                  onChange={(c) => setForm((f) => ({ ...f, latitude: c.latitude, longitude: c.longitude }))}
                />
                <Muted style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
                  The map starts at the centre of your city — drag it onto the actual house.
                  Tap “My location” only if you are standing there right now. This pin is what
                  finds pharmacies within 10 km, including ones in the next town.
                </Muted>
              </>
            ) : form.city.trim() ? (
              <Muted style={{ marginBottom: spacing.md }}>
                We don’t have {form.city.trim()} on our map yet, so there’s nothing to pin.
                Your address still works — we’ll find pharmacies in {form.city.trim()} by name
                instead of by distance.
              </Muted>
            ) : null}

            <AppButton title="Save address" color={colors.pharmacy} loading={saving} onPress={save} />
            {addresses.length > 0 ? (
              <AppButton title="Cancel" variant="ghost" color={colors.textMuted}
                onPress={() => { setForm(EMPTY); setAdding(false); }} style={{ marginTop: spacing.sm }} />
            ) : null}
          </Card>
        ) : (
          <AppButton title="Add a new address" icon="plus" variant="outline" color={colors.pharmacy}
            onPress={() => setAdding(true)} style={{ marginTop: spacing.sm }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  barLabel: { fontSize: font.tiny, color: colors.textMuted },
  barValue: { fontSize: font.small, fontWeight: font.semibold, color: colors.text },

  sheetHead: {
    justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  sheetTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },

  opt: { marginBottom: spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  optActive: { borderColor: colors.pharmacy, backgroundColor: colors.pharmacyLight },
  optTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
});
