import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Screen, Surface, Row, Divider, SectionTitle, Loader, Badge } from '../components/ui';
import { colors, spacing } from '../theme';

const SAMPLE_STATUS = {
  NEW: { bg: '#eef2ff', fg: '#3538cd' },
  APPROVED: { bg: colors.successSoft, fg: colors.success },
  SHIPPED: { bg: colors.primarySoft, fg: colors.primary },
  REJECTED: { bg: colors.dangerSoft, fg: colors.danger },
};

// Отслеживание образца строим из текущего статуса (без оплаты — только обработка
// и отгрузка/доставка). У заявки нет истории по шагам, поэтому шаги синтезируем.
function buildSteps(sample) {
  const created = new Date(sample.createdAt).toLocaleString('ru-RU');
  if (sample.status === 'REJECTED') {
    return [
      { label: 'Заявка принята', date: created, done: true },
      { label: 'Заявка отклонена', comment: 'Менеджер отклонил заявку', done: true, danger: true },
    ];
  }
  const flow = ['NEW', 'APPROVED', 'SHIPPED'];
  const idx = flow.indexOf(sample.status);
  return [
    { label: 'Заявка принята', date: created, done: idx >= 0 },
    { label: 'Одобрена менеджером', done: idx >= 1 },
    { label: 'Отгружена и в доставке', done: idx >= 2 },
  ];
}

export default function SampleScreen({ route }) {
  const { id } = route.params;
  const [sample, setSample] = useState(null);

  const load = useCallback(async () => {
    const data = await api.get(`/samples/${id}`);
    setSample(data);
  }, [id]);

  // Перезагружаем при возврате на экран — статус обновится, если менеджер подтвердит заявку.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!sample) return <Loader text="Загрузка заявки…" />;

  const c = SAMPLE_STATUS[sample.status] || SAMPLE_STATUS.NEW;
  const steps = buildSteps(sample);
  const lastDone = steps.reduce((acc, s, i) => (s.done ? i : acc), 0);

  return (
    <Screen>
      <Surface>
        <View>
          <View style={st.headRow}>
            <View style={st.nameRow}>
              <Ionicons name="flask-outline" size={18} color={colors.accent} />
              <Text style={st.name}>{sample.product?.name}</Text>
            </View>
            <Badge text={sample.statusLabel} bg={c.bg} fg={c.fg} />
          </View>
          <Text style={st.meta}>Заявка на бесплатный образец · от {new Date(sample.createdAt).toLocaleDateString('ru-RU')}</Text>
          <Divider />
          <Row label="Навеска образца" value={`${sample.weightKg} кг`} />
          <Row label="Стоимость" value="Бесплатно" valueStyle={{ color: colors.success, fontWeight: '700' }} />
          <Row label="Доставка" value={`${sample.region}${sample.city ? ', ' + sample.city : ''}`} />
          {sample.comment ? <Row label="Комментарий" value={sample.comment} /> : null}
        </View>

        <View>
          <SectionTitle>Отслеживание</SectionTitle>
          {steps.map((s, idx) => (
            <View key={idx} style={st.tl}>
              <View style={st.tlDot}>
                <View
                  style={[
                    st.dot,
                    { backgroundColor: s.done ? (s.danger ? colors.danger : idx === lastDone ? colors.primary : colors.success) : colors.border },
                  ]}
                />
                {idx < steps.length - 1 ? <View style={st.line} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing(3) }}>
                <Text style={[st.tlStatus, !s.done && { color: colors.textMuted }]}>{s.label}</Text>
                {s.comment ? <Text style={st.tlComment}>{s.comment}</Text> : null}
                {s.date ? <Text style={st.tlDate}>{s.date}</Text> : null}
              </View>
            </View>
          ))}
          <Text style={st.note}>Образцы доставляются транспортной компанией. Оплата не требуется.</Text>
        </View>
      </Surface>
    </Screen>
  );
}

const st = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  meta: { color: colors.textMuted, marginTop: spacing(2), fontSize: 13 },
  tl: { flexDirection: 'row' },
  tlDot: { width: 24, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 },
  tlStatus: { fontWeight: '700', color: colors.text },
  tlComment: { color: colors.textMuted, fontSize: 13, marginTop: spacing(1) },
  tlDate: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1) },
  note: { color: colors.textMuted, fontSize: 12, marginTop: spacing(2), fontStyle: 'italic' },
});
