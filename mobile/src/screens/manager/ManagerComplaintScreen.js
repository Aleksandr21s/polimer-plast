import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { api } from '../../api/client';
import { Screen, Surface, Button, Row, Badge, SectionTitle } from '../../components/ui';
import { colors, spacing } from '../../theme';

const STATUS_COLORS = {
  NEW: { bg: colors.warningSoft, fg: colors.warning },
  IN_REVIEW: { bg: '#e7f2ff', fg: '#1f6f8b' },
  RESOLVED: { bg: colors.successSoft, fg: colors.success },
  REJECTED: { bg: colors.dangerSoft, fg: colors.danger },
};

// Детальная карточка рекламации для менеджера + смена статуса.
// Объект рекламации приходит из списка (route.params), отдельного GET /complaints/:id нет.
export default function ManagerComplaintScreen({ route }) {
  const [complaint, setComplaint] = useState(route.params.complaint);
  const [busy, setBusy] = useState(false);

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const updated = await api.patch(`/complaints/${complaint.id}/status`, { status });
      setComplaint(updated); // список обновится сам при возврате (useFocusEffect в ChatInbox)
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setBusy(false);
    }
  };

  const name = complaint.user
    ? (`${complaint.user.lastName || ''} ${complaint.user.firstName || ''}`.trim() || 'Клиент')
    : 'Клиент';
  const sc = STATUS_COLORS[complaint.status] || STATUS_COLORS.NEW;
  const isFinal = complaint.status === 'RESOLVED' || complaint.status === 'REJECTED';

  return (
    <Screen>
      <Surface>
        <View>
          <View style={st.head}>
            <Text style={st.subject}>{complaint.subject}</Text>
            <Badge text={complaint.statusLabel} bg={sc.bg} fg={sc.fg} />
          </View>
          <Text style={st.meta}>от {new Date(complaint.createdAt).toLocaleString('ru-RU')}</Text>
          <Row label="Клиент" value={name} />
          {complaint.order ? <Row label="Заказ" value={`№ ${complaint.order.number}`} /> : null}
        </View>

        <View>
          <SectionTitle>Описание проблемы</SectionTitle>
          <Text style={st.text}>{complaint.text}</Text>
        </View>
      </Surface>

      <View style={{ height: spacing(3) }} />

      {complaint.status === 'NEW' ? (
        <Button title="Взять на рассмотрение" icon="time-outline" onPress={() => setStatus('IN_REVIEW')} loading={busy} />
      ) : null}

      {!isFinal ? (
        <>
          <Button title="Отметить решённой" variant="success" icon="checkmark-circle-outline" style={{ marginTop: spacing(2) }} onPress={() => setStatus('RESOLVED')} loading={busy} />
          <Button title="Отклонить" variant="danger" icon="close-circle-outline" style={{ marginTop: spacing(2) }} onPress={() => setStatus('REJECTED')} loading={busy} />
        </>
      ) : (
        <Button title="Вернуть в работу" variant="outline" icon="refresh-outline" onPress={() => setStatus('IN_REVIEW')} loading={busy} />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing(2) },
  subject: { fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 },
  meta: { color: colors.textMuted, marginTop: spacing(2), marginBottom: spacing(2), fontSize: 13 },
  text: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
