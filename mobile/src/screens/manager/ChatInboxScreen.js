import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { api } from '../../api/client';
import { Badge, Loader, EmptyState } from '../../components/ui';
import { useChat } from '../../context/ChatContext';
import { colors, spacing, radius } from '../../theme';

const STATUS = {
  pending: { t: 'Новое', bg: colors.warningSoft, fg: colors.warning },
  answered: { t: 'Отвечено', bg: colors.successSoft, fg: colors.success },
  closed: { t: 'Закрыто', bg: colors.bg, fg: colors.textMuted },
};

const COMPLAINT_STATUS = {
  NEW: { bg: colors.warningSoft, fg: colors.warning },
  IN_REVIEW: { bg: '#e7f2ff', fg: '#1f6f8b' },
  RESOLVED: { bg: colors.successSoft, fg: colors.success },
  REJECTED: { bg: colors.dangerSoft, fg: colors.danger },
};

// Вкладка менеджера «Обращения» с двумя подразделами:
//  — Чат-обращения: эскалации чат-бота (диалоги, переданные клиентами);
//  — Рекламации: жалобы по заказам (GET /complaints, для менеджера — все).
export default function ChatInboxScreen({ navigation }) {
  const { refresh } = useChat();
  const [tab, setTab] = useState('chat');
  const [sessions, setSessions] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      api.get('/chat/manager/escalations').catch(() => []),
      api.get('/complaints').catch(() => []),
    ]);
    setSessions(s);
    setComplaints(c);
    refresh(); // синхронизировать бейдж чат-обращений
  }, [refresh]);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <Loader text="Загрузка обращений…" />;

  const newComplaints = complaints.filter((c) => c.status === 'NEW').length;

  const header = (
    <View style={st.header}>
      <Text style={st.title}>Обращения</Text>
      <View style={st.segment}>
        <Pressable style={[st.segBtn, tab === 'chat' && st.segActive]} onPress={() => setTab('chat')}>
          <Text style={[st.segText, tab === 'chat' && st.segTextActive]}>Чат-обращения</Text>
        </Pressable>
        <Pressable style={[st.segBtn, tab === 'complaints' && st.segActive]} onPress={() => setTab('complaints')}>
          <Text style={[st.segText, tab === 'complaints' && st.segTextActive]}>
            Рекламации{newComplaints ? ` (${newComplaints})` : ''}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderChat = ({ item }) => {
    const name = item.user ? (`${item.user.lastName || ''} ${item.user.firstName || ''}`.trim() || item.user.email) : 'Клиент';
    const last = item.lastMessage;
    const who = last ? (last.role === 'MANAGER' ? 'Вы: ' : last.role === 'BOT' ? 'Бот: ' : '') : '';
    const s = STATUS[item.status] || STATUS.pending;
    return (
      <Pressable onPress={() => navigation.navigate('ChatSession', { sessionId: item.sessionId, title: name })} style={st.card}>
        <View style={st.cardHead}>
          <Text style={st.name} numberOfLines={1}>{name}</Text>
          <Badge text={s.t} bg={s.bg} fg={s.fg} />
        </View>
        {item.user?.company?.name ? <Text style={st.company} numberOfLines={1}>{item.user.company.name}</Text> : null}
        {last ? <Text style={st.sub} numberOfLines={2}>{who}{last.text}</Text> : null}
        {last ? <Text style={st.time}>{new Date(last.createdAt).toLocaleString('ru-RU')}</Text> : null}
      </Pressable>
    );
  };

  const renderComplaint = ({ item }) => {
    const name = item.user ? (`${item.user.lastName || ''} ${item.user.firstName || ''}`.trim() || 'Клиент') : 'Клиент';
    const s = COMPLAINT_STATUS[item.status] || COMPLAINT_STATUS.NEW;
    return (
      <Pressable onPress={() => navigation.navigate('ManagerComplaint', { complaint: item })} style={st.card}>
        <View style={st.cardHead}>
          <Text style={st.name} numberOfLines={1}>{item.subject}</Text>
          <Badge text={item.statusLabel} bg={s.bg} fg={s.fg} />
        </View>
        <Text style={st.company} numberOfLines={1}>{name}{item.order ? ` · заказ № ${item.order.number}` : ''}</Text>
        <Text style={st.sub} numberOfLines={2}>{item.text}</Text>
        <Text style={st.time}>{new Date(item.createdAt).toLocaleString('ru-RU')}</Text>
      </Pressable>
    );
  };

  const isChat = tab === 'chat';

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing(4) }}
      data={isChat ? sessions : complaints}
      keyExtractor={(item) => (isChat ? item.sessionId : `c${item.id}`)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        isChat
          ? <EmptyState icon="💬" title="Обращений нет" subtitle="Здесь появятся диалоги, переданные клиентами менеджеру" />
          : <EmptyState icon="📛" title="Рекламаций нет" subtitle="Здесь появятся жалобы клиентов по заказам" />
      }
      renderItem={isChat ? renderChat : renderComplaint}
    />
  );
}

const st = StyleSheet.create({
  header: { marginBottom: spacing(3) },
  title: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: spacing(3) },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 3 },
  segBtn: { flex: 1, paddingVertical: spacing(2), borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.card },
  segText: { fontWeight: '700', color: colors.textMuted, fontSize: 13 },
  segTextActive: { color: colors.primary },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing(4), marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2) },
  name: { fontWeight: '800', color: colors.text, flex: 1, fontSize: 15 },
  company: { color: colors.primary, fontWeight: '600', marginTop: spacing(1), fontSize: 13 },
  sub: { color: colors.textMuted, marginTop: spacing(2), fontSize: 13, lineHeight: 18 },
  time: { color: colors.textMuted, fontSize: 11, marginTop: spacing(2) },
});
