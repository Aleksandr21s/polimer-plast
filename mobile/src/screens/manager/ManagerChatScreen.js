import { useState, useRef, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { Loader } from '../../components/ui';
import { useChat } from '../../context/ChatContext';
import { colors, spacing, radius } from '../../theme';

const ROLE_LABEL = { USER: 'Клиент', BOT: 'Бот', MANAGER: 'Вы' };

// Закрыто, если последнее сообщение-эскалация помечено meta.resolved
function computeClosed(messages) {
  let latest = null;
  for (const m of messages) if (m.role === 'USER' && m.escalated) latest = m;
  return !!(latest && latest.meta && latest.meta.resolved);
}

// Диалог менеджера с клиентом: вся переписка (клиент/бот/менеджер) + ответ.
export default function ManagerChatScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const { refresh } = useChat();
  const [messages, setMessages] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    try { setMessages(await api.get(`/chat/${sessionId}`)); } catch {}
  }, [sessionId]);

  // Подгружаем историю и опрашиваем каждые 5 с — увидеть новые сообщения клиента
  useFocusEffect(useCallback(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]));

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      await api.post(`/chat/manager/${sessionId}/reply`, { message: text });
      await load();
      refresh(); // обновить бейдж (обращение стало «отвечено»)
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const closeChat = async () => {
    if (closing) return;
    setClosing(true);
    try {
      await api.post(`/chat/manager/${sessionId}/close`);
      refresh(); // обновить бейдж
      navigation.goBack(); // вернуться к списку обращений (он обновится сам)
    } catch {
      setClosing(false);
    }
  };

  if (!messages) return <Loader text="Загрузка диалога…" />;

  const closed = computeClosed(messages);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={st.toolbar}>
        {closed ? (
          <View style={st.closedTag}>
            <Ionicons name="checkmark-done-outline" size={15} color={colors.textMuted} />
            <Text style={st.closedText}>Обращение закрыто</Text>
          </View>
        ) : (
          <Pressable style={st.closeBtn} onPress={closeChat} disabled={closing}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={st.closeBtnText}>{closing ? 'Закрываю…' : 'Закрыть обращение'}</Text>
          </Pressable>
        )}
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing(4) }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map((m, i) => {
          const mine = m.role === 'MANAGER';
          return (
            <View key={m.id ?? i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: spacing(2) }}>
              <Text style={[st.role, mine && { textAlign: 'right' }]}>{ROLE_LABEL[m.role] || m.role}</Text>
              <View style={[st.bubble, mine ? st.mine : m.role === 'BOT' ? st.bot : st.client]}>
                <Text style={[st.text, mine && { color: '#fff' }]}>{m.text}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={st.inputBar}>
        <TextInput style={st.input} value={input} onChangeText={setInput} placeholder="Ответ клиенту…" placeholderTextColor={colors.textMuted} onSubmitEditing={send} returnKeyType="send" />
        <Pressable style={st.sendBtn} onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={st.sendText}>➤</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing(4), paddingVertical: spacing(2.5), backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.success, backgroundColor: colors.successSoft },
  closeBtnText: { color: colors.success, fontWeight: '700', fontSize: 13 },
  closedTag: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  closedText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  role: { fontSize: 11, color: colors.textMuted, marginBottom: 2, marginHorizontal: spacing(1) },
  bubble: { padding: spacing(3), borderRadius: radius.lg },
  client: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bot: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  inputBar: { flexDirection: 'row', padding: spacing(3), backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: spacing(4), paddingVertical: spacing(3), fontSize: 15, color: colors.text },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginLeft: spacing(2) },
  sendText: { color: '#fff', fontSize: 18 },
});
