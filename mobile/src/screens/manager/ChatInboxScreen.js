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

// Список обращений клиентов, переданных менеджеру (эскалации чат-бота).
export default function ChatInboxScreen({ navigation }) {
  const { refresh } = useChat();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setSessions(await api.get('/chat/manager/escalations'));
    refresh(); // синхронизировать бейдж
  }, [refresh]);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <Loader text="Загрузка обращений…" />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing(4) }}
      data={sessions}
      keyExtractor={(s) => s.sessionId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={<Text style={st.title}>Обращения к менеджеру</Text>}
      ListEmptyComponent={<EmptyState icon="💬" title="Обращений нет" subtitle="Здесь появятся диалоги, переданные клиентами менеджеру" />}
      renderItem={({ item }) => {
        const name = item.user ? (`${item.user.lastName || ''} ${item.user.firstName || ''}`.trim() || item.user.email) : 'Клиент';
        const last = item.lastMessage;
        const who = last ? (last.role === 'MANAGER' ? 'Вы: ' : last.role === 'BOT' ? 'Бот: ' : '') : '';
        return (
          <Pressable onPress={() => navigation.navigate('ChatSession', { sessionId: item.sessionId, title: name })} style={st.card}>
            <View style={st.head}>
              <Text style={st.name} numberOfLines={1}>{name}</Text>
              <Badge {...(() => { const s = STATUS[item.status] || STATUS.pending; return { text: s.t, bg: s.bg, fg: s.fg }; })()} />
            </View>
            {item.user?.company?.name ? <Text style={st.company} numberOfLines={1}>{item.user.company.name}</Text> : null}
            {last ? <Text style={st.last} numberOfLines={2}>{who}{last.text}</Text> : null}
            {last ? <Text style={st.time}>{new Date(last.createdAt).toLocaleString('ru-RU')}</Text> : null}
          </Pressable>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: spacing(3) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing(4), marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2) },
  name: { fontWeight: '800', color: colors.text, flex: 1, fontSize: 15 },
  company: { color: colors.primary, fontWeight: '600', marginTop: spacing(1), fontSize: 13 },
  last: { color: colors.textMuted, marginTop: spacing(2), fontSize: 13, lineHeight: 18 },
  time: { color: colors.textMuted, fontSize: 11, marginTop: spacing(2) },
});
