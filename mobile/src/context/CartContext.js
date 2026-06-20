import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const CartContext = createContext(null);

// Корзина: позиции заказа { productId, name, pricePerTon, colorHex, weightKg }
export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  const addItem = useCallback((product, weightKg) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], weightKg: copy[idx].weightKg + weightKg };
        return copy;
      }
      return [...prev, { productId: product.id, name: product.name, article: product.article, imageUrl: product.imageUrl, pricePerTon: product.pricePerTon, pricePerKg: product.pricePerKg, colorHex: product.colorHex, weightKg }];
    });
  }, []);

  const updateWeight = useCallback((productId, weightKg) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, weightKg } : i)));
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (i.weightKg / 1000) * (i.pricePerTon || 0), 0),
    [items]
  );
  const totalWeightKg = useMemo(() => items.reduce((s, i) => s + i.weightKg, 0), [items]);

  return (
    <CartContext.Provider value={{ items, addItem, updateWeight, removeItem, clear, subtotal, totalWeightKg, count: items.length }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
