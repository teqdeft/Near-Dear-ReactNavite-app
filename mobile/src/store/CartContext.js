import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

const CartContext = createContext(null);

/**
 * Simple in-memory cart. A cart can only contain items from ONE pharmacy
 * (each pharmacy fulfils & delivers its own orders — blueprint MVP rule).
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { pharmacy_medicine_id, name, price, quantity, prescription_required }
  const [pharmacyId, setPharmacyId] = useState(null);
  const [pharmacyName, setPharmacyName] = useState(null);

  const clear = useCallback(() => {
    setItems([]);
    setPharmacyId(null);
    setPharmacyName(null);
  }, []);

  // Replace the whole cart in one shot (used by "Order again"). Doing this via
  // addItem in a loop is unsafe — the pharmacyId state is stale within the loop,
  // so a pharmacy switch would wipe earlier items.
  const replaceCart = useCallback((newItems, pId, pName) => {
    setItems(newItems.map((i) => ({ ...i, quantity: Math.max(1, i.quantity || 1) })));
    setPharmacyId(pId);
    setPharmacyName(pName);
  }, []);

  const addItem = useCallback((listing) => {
    // Compute this synchronously from the current pharmacyId — deriving it
    // inside the setItems updater would return a stale value to the caller
    // (the updater runs after this function has already returned).
    const switched = !!pharmacyId && pharmacyId !== listing.pharmacy_id;
    setItems((prev) => {
      // Different pharmacy -> reset cart to the new pharmacy.
      if (switched) {
        return [{ ...listing, quantity: 1 }];
      }
      const existing = prev.find((i) => i.pharmacy_medicine_id === listing.pharmacy_medicine_id);
      if (existing) {
        return prev.map((i) =>
          i.pharmacy_medicine_id === listing.pharmacy_medicine_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...listing, quantity: 1 }];
    });
    setPharmacyId(listing.pharmacy_id);
    setPharmacyName(listing.pharmacy_name);
    return switched;
  }, [pharmacyId]);

  const setQuantity = useCallback((id, quantity) => {
    setItems((prev) =>
      prev
        .map((i) => (i.pharmacy_medicine_id === id ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.pharmacy_medicine_id !== id));
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
    [items]
  );
  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const needsPrescription = useMemo(() => items.some((i) => i.prescription_required), [items]);

  const value = {
    items, pharmacyId, pharmacyName, subtotal, count, needsPrescription,
    addItem, setQuantity, removeItem, clear, replaceCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export default CartContext;
