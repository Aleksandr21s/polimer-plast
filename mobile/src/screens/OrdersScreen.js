import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Card, StatusBadge, Badge, Loader, EmptyState, formatMoney } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

const SAMPLE_STATUS = {
  NEW: { bg: '#eef2ff', fg: '#3538cd' },
  APPROVED: { bg: colors.successSoft, fg: colors.success },
  SHIPPED: { bg: colors.primarySoft, fg: colors.primary },
  REJECTED: { bg: colors.dangerSoft, fg: colors.danger },
};

export default function OrdersScreen({ navigation }) {
  const { isManager } = useAuth();
  const [orders, setOrders] = useState([]);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([
      api.get('/orders'),
      isManager ? Promise.resolve([]) : api.get('/samples').catch(() => []),
    ]);
    setOrders(o);
    setSamples(s);
  }, [isManager]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <Loader text="Загрузка заказов…" />;

  const header = (
    <View>
      {!isManager && samples.length ? (
        <>
          <Text style={st.sectionTitle}>Заявки на образцы</Text>
          {samples.map((s) => {
            const c = SAMPLE_STATUS[s.status] || SAMPLE_STATUS.NEW;
            return (
              <Card key={'s' + s.id}>
                <View style={st.headRow}>
                  <View style={st.sampleNameRow}>
                    <Ionicons name="flask-outline" size={16} color={colors.accent} />
                    <Text style={st.sampleName} numberOfLines={1}>{s.product?.name}</Text>
                  </View>
                  <Badge text={s.statusLabel} bg={c.bg} fg={c.fg} />
                </View>
                <Text style={st.meta}>Бесплатный образец · {s.weightKg} кг · {new Date(s.createdAt).toLocaleDateString('ru-RU')}</Text>
              </Card>
            );
          })}
        </>
      ) : null}
      <Text style={st.title}>{isManager ? 'Все заказы' : 'Мои заказы'}</Text>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(10) }}
      data={orders}
      keyExtractor={(o) => String(o.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        samples.length
          ? <Text style={st.empty}>Заказов пока нет — сформируйте заказ из каталога.</Text>
          : <EmptyState icon="📦" title="Заказов пока нет" subtitle={isManager ? 'Заявки клиентов появятся здесь' : 'Сформируйте заказ из каталога'} />
      }
      renderItem={({ item }) => (
        <Card onPress={() => navigation.navigate('Order', { id: item.id })}>
          <View style={st.headRow}>
            <Text style={st.number}>№ {item.number}</Text>
            <StatusBadge status={item.status} label={item.statusLabel} />
          </View>
          {isManager && item.company ? <Text style={st.company}>{item.company.name}</Text> : null}
          <View style={st.metaRow}>
            <Text style={st.meta}>{new Date(item.createdAt).toLocaleDateString('ru-RU')} · {item.deliveryRegion}</Text>
            <Text style={st.total}>{formatMoney(item.total)} ₽</Text>
          </View>
          <Text style={st.weight}>{(item.totalWeightKg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 })} т · {item.items.length} поз.</Text>
          {item.remainingHours != null ? (
            <Text style={[st.timer, item.remainingHours < 24 && { color: colors.danger }]}>⏳ до автоотмены: {Math.floor(item.remainingHours)} ч</Text>
          ) : null}
        </Card>
      )}
    />
  );
}

const st = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: spacing(3) },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing(3) },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2) },
  sampleNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), flex: 1 },
  sampleName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  number: { fontSize: 16, fontWeight: '800', color: colors.text },
  company: { color: colors.primary, fontWeight: '600', marginTop: spacing(1) },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing(2) },
  meta: { color: colors.textMuted, fontSize: 13, flex: 1, marginTop: spacing(1) },
  total: { fontSize: 16, fontWeight: '900', color: colors.text },
  weight: { color: colors.textMuted, fontSize: 13, marginTop: spacing(1) },
  timer: { color: colors.warning, fontSize: 13, fontWeight: '600', marginTop: spacing(2) },
  empty: { color: colors.textMuted, marginBottom: spacing(4) },
});
