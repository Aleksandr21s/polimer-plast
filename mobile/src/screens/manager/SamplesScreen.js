import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { api } from '../../api/client';
import { Card, Button, Badge, Loader, EmptyState } from '../../components/ui';
import { colors, spacing, statusColors } from '../../theme';

const SAMPLE_STATUS = { NEW: { bg: '#eef2ff', fg: '#3538cd' }, APPROVED: statusColors.PAID, SHIPPED: statusColors.SHIPPED, REJECTED: statusColors.CANCELLED };

export default function SamplesScreen() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { setSamples(await api.get('/samples')); }, []);
  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const setStatus = async (id, status) => {
    try { await api.patch(`/samples/${id}/status`, { status }); await load(); }
    catch (e) { Alert.alert('Ошибка', e.message); }
  };

  if (loading) return <Loader />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing(4) }}
      data={samples}
      keyExtractor={(s) => String(s.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={<Text style={st.title}>Заявки на образцы</Text>}
      ListEmptyComponent={<EmptyState icon="🎁" title="Заявок нет" />}
      renderItem={({ item }) => {
        const c = SAMPLE_STATUS[item.status] || SAMPLE_STATUS.NEW;
        return (
          <Card>
            <View style={st.head}>
              <Text style={st.product}>{item.product?.name}</Text>
              <Badge text={item.statusLabel} bg={c.bg} fg={c.fg} />
            </View>
            <Text style={st.meta}>{item.weightKg} кг · {item.region}{item.city ? ', ' + item.city : ''}</Text>
            {item.company ? <Text style={st.company}>{item.company.name}</Text> : null}
            <Text style={st.user}>{item.user?.lastName} {item.user?.firstName} · {new Date(item.createdAt).toLocaleDateString('ru-RU')}</Text>
            {item.status === 'NEW' ? (
              <View style={st.actions}>
                <Button title="Одобрить" small variant="success" style={{ flex: 1 }} onPress={() => setStatus(item.id, 'APPROVED')} />
                <Button title="Отклонить" small variant="danger" style={{ flex: 1 }} onPress={() => setStatus(item.id, 'REJECTED')} />
              </View>
            ) : item.status === 'APPROVED' ? (
              <Button title="Отметить «Отправлено»" small style={{ marginTop: spacing(2) }} onPress={() => setStatus(item.id, 'SHIPPED')} />
            ) : null}
          </Card>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: spacing(3) },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  product: { fontWeight: '800', color: colors.text, flex: 1, marginRight: spacing(2) },
  meta: { color: colors.text, marginTop: spacing(2) },
  company: { color: colors.primary, fontWeight: '600', marginTop: spacing(1) },
  user: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1) },
  actions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
});
