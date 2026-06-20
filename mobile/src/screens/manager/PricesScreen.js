import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Alert } from 'react-native';
import { api } from '../../api/client';
import { TextField, Card, Button, Loader, formatMoney } from '../../components/ui';
import { colors, spacing, radius } from '../../theme';

export default function PricesScreen() {
  const [prices, setPrices] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null); // { productId, name, value }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await api.get('/prices/current');
    setPrices(data);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const save = async () => {
    const val = Number(String(editing.value).replace(/\s/g, '').replace(',', '.'));
    if (!val || val <= 0) return Alert.alert('Ошибка', 'Введите корректную цену');
    setSaving(true);
    try {
      await api.put(`/prices/product/${editing.productId}`, { pricePerTon: val });
      setEditing(null);
      await load();
    } catch (e) { Alert.alert('Ошибка', e.message); } finally { setSaving(false); }
  };

  const filtered = q ? prices.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : prices;
  if (loading) return <Loader text="Загрузка прайс-листа…" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing(4), paddingBottom: 0 }}>
        <Text style={st.title}>Обновление цен</Text>
        <Text style={st.subtitle}>Прайс-лист обновляется раз в 2 недели. Нажмите на марку, чтобы изменить цену.</Text>
        <TextField placeholder="🔍 Поиск марки…" value={q} onChangeText={setQ} autoCapitalize="none" />
      </View>

      {editing ? (
        <Card style={{ marginHorizontal: spacing(4) }}>
          <Text style={st.editName}>{editing.name}</Text>
          <TextField label="Новая цена, ₽/тонна" value={String(editing.value)} onChangeText={(v) => setEditing((e) => ({ ...e, value: v }))} keyboardType="numeric" autoFocus />
          <View style={{ flexDirection: 'row', gap: spacing(2) }}>
            <Button title="Сохранить" small style={{ flex: 1 }} onPress={save} loading={saving} />
            <Button title="Отмена" variant="ghost" small style={{ flex: 1 }} onPress={() => setEditing(null)} />
          </View>
        </Card>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.productId)}
        contentContainerStyle={{ padding: spacing(4), paddingTop: spacing(2) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Pressable style={st.row} onPress={() => setEditing({ productId: item.productId, name: item.name, value: String(item.pricePerTon) })}>
            <Text style={st.name} numberOfLines={1}>{item.name}</Text>
            <Text style={st.price}>{formatMoney(item.pricePerTon)} ₽/т</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { color: colors.textMuted, marginVertical: spacing(2) },
  editName: { fontWeight: '800', color: colors.text, marginBottom: spacing(2) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: radius.md, padding: spacing(3.5), marginBottom: spacing(2), borderWidth: 1, borderColor: colors.border },
  name: { flex: 1, color: colors.text, fontWeight: '600', marginRight: spacing(3) },
  price: { fontWeight: '800', color: colors.primary },
});
