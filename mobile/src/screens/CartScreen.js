import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { api } from '../api/client';
import { Screen, Card, Button, TextField, AutocompleteField, Row, Divider, SectionTitle, EmptyState, formatMoney } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { REGIONS, CITIES } from '../data/geo';
import { colors, spacing, radius } from '../theme';

export default function CartScreen({ navigation }) {
  const { items, updateWeight, removeItem, clear, subtotal, totalWeightKg } = useCart();
  const { user } = useAuth();
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const discountPercent = user?.company?.discountPercent || 0;
  const discountAmount = (subtotal * discountPercent) / 100;
  const base = subtotal - discountAmount;
  const vat = base * 0.22;
  const total = base + vat;

  const submit = async () => {
    if (!region.trim()) return Alert.alert('Ошибка', 'Укажите регион доставки');
    setLoading(true);
    try {
      // 1) создаём заказ
      const order = await api.post('/orders', {
        deliveryRegion: region.trim(),
        deliveryCity: city.trim(),
        comment: comment.trim(),
        items: items.map((i) => ({ productId: i.productId, weightKg: i.weightKg })),
      });
      // 2) сразу формируем КП/счёт (PDF)
      await api.post(`/orders/${order.id}/issue-invoice`);
      clear();
      // 3) переходим к заказу — экран сам откроет PDF
      navigation.navigate('Заказы', { screen: 'Order', params: { id: order.id, openInvoice: true } });
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <Screen>
        <SectionTitle>Оформление заказа</SectionTitle>
        <EmptyState icon="🧺" title="Заказ пуст" subtitle="Добавьте марки из каталога, указав нужный объём в кг"
          action={<Button title="В каталог" style={{ marginTop: spacing(4) }} onPress={() => navigation.navigate('Каталог')} />} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>Оформление заказа</SectionTitle>

      {items.map((i) => (
        <Card key={i.productId}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[st.swatch, { backgroundColor: i.colorHex || '#ccc' }]} />
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{i.name}</Text>
              <Text style={st.price}>{formatMoney(i.pricePerTon)} ₽/т</Text>
            </View>
            <Pressable onPress={() => removeItem(i.productId)} hitSlop={10}><Text style={st.remove}>✕</Text></Pressable>
          </View>
          <View style={st.qtyRow}>
            <TextField label="Объём, кг" value={String(i.weightKg)} keyboardType="numeric" style={{ width: 140 }}
              onChangeText={(v) => updateWeight(i.productId, Number(String(v).replace(',', '.')) || 0)} />
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={st.lineLabel}>Сумма позиции</Text>
              <Text style={st.lineTotal}>{formatMoney((i.weightKg / 1000) * i.pricePerTon)} ₽</Text>
            </View>
          </View>
        </Card>
      ))}

      {/* Обёртка с zIndex поднимает карточку (и выпадашки автоподстановки) над блоком «Итого».
          Обычный View, а не Card — у Card функциональный style, zIndex до него не доходит. */}
      <View style={{ zIndex: 20 }}>
        <Card>
          <SectionTitle>Доставка</SectionTitle>
          <AutocompleteField label="Регион *" value={region} onChangeText={setRegion} placeholder="Начните вводить регион…" options={REGIONS} />
          <AutocompleteField label="Город" value={city} onChangeText={setCity} placeholder="Начните вводить город…" options={CITIES} />
          <TextField label="Комментарий" value={comment} onChangeText={setComment} multiline placeholder="Доп. условия поставки" />
        </Card>
      </View>

      <Card>
        <SectionTitle>Итого</SectionTitle>
        <Row label={`Объём (${items.length} поз.)`} value={`${(totalWeightKg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 })} т`} />
        <Row label="Сумма без скидки" value={`${formatMoney(subtotal)} ₽`} />
        {discountPercent > 0 ? <Row label={`Скидка по лояльности (${discountPercent}%)`} value={`−${formatMoney(discountAmount)} ₽`} valueStyle={{ color: colors.success }} /> : null}
        <Row label="НДС 22%" value={`${formatMoney(vat)} ₽`} />
        <Divider />
        <Row label="К оплате" value={`${formatMoney(total)} ₽`} bold />
      </Card>

      <Button title="Сформировать КП / счёт (PDF)" icon="document-text-outline" onPress={submit} loading={loading} />
      <Button title="Очистить" variant="ghost" onPress={clear} style={{ marginTop: spacing(2) }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  swatch: { width: 40, height: 40, borderRadius: 10, marginRight: spacing(3), borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  price: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  remove: { fontSize: 18, color: colors.danger, paddingHorizontal: spacing(2) },
  qtyRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing(2) },
  lineLabel: { color: colors.textMuted, fontSize: 12 },
  lineTotal: { fontSize: 16, fontWeight: '800', color: colors.text },
});
