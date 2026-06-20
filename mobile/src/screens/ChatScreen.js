import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { colors, spacing, radius } from '../theme';

const GREETING = {
  role: 'BOT',
  text: 'Здравствуйте! Я помощник по подбору пластиката. Опишите задачу — например: «изоляция кабеля», «морозостойкий шланг», «кислотостойкий материал». Также отвечу про образцы, доставку, цены и объясню характеристики (Шор, ПТР, температуру хрупкости).',
};

const SUGGESTIONS = ['Изоляция кабеля', 'Морозостойкий пластикат', 'Кислотостойкий (КЩС)', 'Что такое Шор?', 'Как заказать образцы?'];

const SESSION_STATUS = {
  pending: { t: 'Ожидает ответа', fg: colors.warning, bg: colors.warningSoft },
  answered: { t: 'Отвечено', fg: colors.success, bg: colors.successSoft },
  closed: { t: 'Закрыто', fg: colors.textMuted, bg: colors.bg },
};
// Сообщение из истории сервера → формат локального стейта
const mapServerMsg = (m) => ({ role: m.role, text: m.text, id: m.id, recommendations: m.meta?.recommendations, engineUsed: m.meta?.engineUsed });

export default function ChatScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 1024;
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  // Стек снимков диалога — для возможности «вернуться назад» к состоянию до последнего сообщения
  const [undoStack, setUndoStack] = useState([]);
  // История обращений клиента (эскалированные диалоги)
  const [sessions, setSessions] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Движок бота: 'ollama' (ИИ) | 'rules' (правила). Статус — для подсказки доступности.
  const [engine, setEngine] = useState('rules');
  const [engineStatus, setEngineStatus] = useState(null);
  const scrollRef = useRef(null);
  // Уже показанные сообщения менеджера — чтобы опрос не дублировал их
  const seenManagerIds = useRef(new Set());

  const loadSessions = useCallback(async () => {
    try { setSessions(await api.get('/chat/my/sessions')); } catch {}
  }, []);
  // Обновляем историю при заходе на экран
  useFocusEffect(useCallback(() => { loadSessions(); }, [loadSessions]));

  // Узнаём, доступна ли локальная LLM, и по умолчанию включаем «ИИ», если она поднята
  useEffect(() => {
    api.get('/chat/engine-status')
      .then((s) => { setEngineStatus(s); setEngine(s.ollamaAvailable ? 'ollama' : 'rules'); })
      .catch(() => {});
  }, []);

  // Загрузить существующее обращение из истории в окно чата
  const openSession = async (sid) => {
    if (sid === sessionId) { if (!isWide) setHistoryOpen(false); return; }
    try {
      const hist = await api.get(`/chat/${sid}`);
      seenManagerIds.current = new Set(hist.filter((m) => m.role === 'MANAGER').map((m) => m.id));
      setMessages(hist.length ? hist.map(mapServerMsg) : [GREETING]);
      setSessionId(sid);
      setUndoStack([]);
      setInput('');
      if (!isWide) setHistoryOpen(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {}
  };

  // Опрашиваем сервер: если менеджер ответил на эскалацию — показываем его сообщения
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const history = await api.get(`/chat/${sessionId}`);
        if (cancelled) return;
        const fresh = history.filter((m) => m.role === 'MANAGER' && !seenManagerIds.current.has(m.id));
        if (fresh.length) {
          fresh.forEach((m) => seenManagerIds.current.add(m.id));
          setMessages((cur) => [...cur, ...fresh.map((m) => ({ role: 'MANAGER', text: m.text, id: m.id }))]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
          loadSessions(); // статус обращения мог измениться
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [sessionId, loadSessions]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    // Запоминаем состояние ДО отправки, чтобы к нему можно было вернуться
    setUndoStack((s) => [...s, { messages, sessionId }]);
    setInput('');
    setMessages((m) => [...m, { role: 'USER', text: msg }]);
    setLoading(true);
    try {
      const res = await api.post('/chat', { message: msg, engine, ...(sessionId ? { sessionId } : {}) });
      setSessionId(res.sessionId);
      setMessages((m) => [...m, { role: 'BOT', text: res.reply, recommendations: res.recommendations, escalate: res.escalate, engineUsed: res.engineUsed, fellBack: res.fellBack }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'BOT', text: 'Ошибка связи: ' + e.message }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Откатить последний обмен (вернуться к предыдущему состоянию диалога)
  const goBack = () => {
    if (loading || !undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setMessages(prev.messages);
    setSessionId(prev.sessionId);
    setUndoStack(undoStack.slice(0, -1));
    setInput('');
  };

  // Начать диалог заново
  const resetChat = () => {
    if (loading) return;
    setMessages([GREETING]);
    setSessionId(null);
    setUndoStack([]);
    setInput('');
    seenManagerIds.current.clear();
  };

  const escalate = async () => {
    if (!sessionId) return;
    try {
      const res = await api.post(`/chat/${sessionId}/escalate`);
      setMessages((m) => [...m, { role: 'BOT', text: res.message }]);
      loadSessions(); // диалог стал обращением — показать в истории
    } catch {}
  };

  // ── История обращений (правый раздел на вебе / сворачиваемый блок на мобильном) ──
  const historyContent = (
    <>
      <Text style={st.histTitle}>Мои обращения</Text>
      {sessions.length === 0 ? (
        <Text style={st.histEmpty}>Здесь появятся вопросы, переданные менеджеру.</Text>
      ) : (
        sessions.map((s) => {
          const stt = SESSION_STATUS[s.status] || SESSION_STATUS.pending;
          const last = s.lastMessage;
          const who = last ? (last.role === 'MANAGER' ? 'Менеджер: ' : last.role === 'BOT' ? 'Бот: ' : 'Вы: ') : '';
          return (
            <Pressable key={s.sessionId} style={[st.histItem, s.sessionId === sessionId && st.histItemActive]} onPress={() => openSession(s.sessionId)}>
              <View style={st.histRow}>
                <View style={[st.histBadge, { backgroundColor: stt.bg }]}><Text style={[st.histBadgeText, { color: stt.fg }]}>{stt.t}</Text></View>
                <Text style={st.histDate}>{new Date(s.escalatedAt).toLocaleDateString('ru-RU')}</Text>
              </View>
              {last ? <Text style={st.histLast} numberOfLines={2}>{who}{last.text}</Text> : null}
            </Pressable>
          );
        })
      )}
    </>
  );

  const chatColumn = (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Переключатель движка бота: ИИ (локальная LLM) / Правила */}
      <View style={st.engineBar}>
        <Text style={st.engineLabel}>Помощник:</Text>
        <View style={st.segment}>
          <Pressable style={[st.segBtn, engine === 'ollama' && st.segBtnActive]} onPress={() => setEngine('ollama')}>
            <Ionicons name="sparkles-outline" size={13} color={engine === 'ollama' ? '#fff' : colors.textMuted} />
            <Text style={[st.segText, engine === 'ollama' && st.segTextActive]}>ИИ</Text>
          </Pressable>
          <Pressable style={[st.segBtn, engine === 'rules' && st.segBtnActive]} onPress={() => setEngine('rules')}>
            <Ionicons name="flash-outline" size={13} color={engine === 'rules' ? '#fff' : colors.textMuted} />
            <Text style={[st.segText, engine === 'rules' && st.segTextActive]}>Правила</Text>
          </Pressable>
        </View>
        {engine === 'ollama' && engineStatus && !engineStatus.ollamaAvailable ? (
          <Text style={st.engineHint}>ИИ выключен — ответят правила</Text>
        ) : null}
      </View>

      {/* Мобильный/узкий: сворачиваемый доступ к истории обращений */}
      {!isWide ? (
        <View>
          <Pressable style={st.histToggle} onPress={() => setHistoryOpen((o) => !o)}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={st.histToggleText}>Мои обращения{sessions.length ? ` (${sessions.length})` : ''}</Text>
            <Ionicons name={historyOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </Pressable>
          {historyOpen ? <ScrollView style={st.histDropdown} contentContainerStyle={{ padding: spacing(3) }}>{historyContent}</ScrollView> : null}
        </View>
      ) : null}

      {/* Полоска управления диалогом — появляется, когда есть что отменять */}
      {undoStack.length ? (
        <View style={st.toolbar}>
          <Pressable style={st.backBtn} onPress={goBack}>
            <Ionicons name="arrow-undo-outline" size={16} color={colors.primary} />
            <Text style={st.backText}>Вернуться назад</Text>
          </Pressable>
          <Pressable style={st.resetBtn} onPress={resetChat}>
            <Ionicons name="refresh-outline" size={15} color={colors.textMuted} />
            <Text style={st.resetText}>Новый чат</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing(4) }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map((m, i) => (
          <View key={i}>
            {m.role === 'MANAGER' ? <Text style={st.mgrLabel}>Менеджер</Text> : null}
            <View style={[st.bubble, m.role === 'USER' ? st.user : m.role === 'MANAGER' ? st.mgr : st.bot]}>
              <Text style={[st.text, (m.role === 'USER' || m.role === 'MANAGER') && { color: '#fff' }]}>{m.text}</Text>
            </View>
            {m.role === 'BOT' && m.engineUsed ? (
              <Text style={st.engineTag}>
                {m.engineUsed === 'ollama'
                  ? `Ответ ИИ · ${engineStatus?.model || 'qwen2.5'}`
                  : m.fellBack ? 'Базовый движок (ИИ недоступен)' : 'Базовый движок'}
              </Text>
            ) : null}
            {m.recommendations?.length ? (
              <View style={st.recs}>
                {m.recommendations.map((r) => (
                  <Pressable key={r.id} style={st.rec} onPress={() => navigation.navigate('Каталог', { screen: 'Product', params: { id: r.id } })}>
                    <Text style={st.recName}>{r.name}</Text>
                    <Text style={st.recMeta}>Шор A {r.shoreHardnessA} · {r.brittlenessTemp}°C{r.pricePerTon ? ` · ${r.pricePerTon.toLocaleString('ru-RU')} ₽/т` : ''}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {m.escalate ? <Pressable style={st.escalate} onPress={escalate}><Text style={st.escalateText}>📞 Передать вопрос менеджеру</Text></Pressable> : null}
          </View>
        ))}
        {loading ? <View style={[st.bubble, st.bot]}><ActivityIndicator color={colors.primary} /></View> : null}

        {messages.length <= 1 ? (
          <View style={st.sugWrap}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={st.sug} onPress={() => send(s)}><Text style={st.sugText}>{s}</Text></Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={st.inputBar}>
        <TextInput style={st.input} value={input} onChangeText={setInput} placeholder="Опишите задачу…" placeholderTextColor={colors.textMuted} onSubmitEditing={() => send()} returnKeyType="send" />
        <Pressable style={st.sendBtn} onPress={() => send()}><Text style={st.sendText}>➤</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  if (isWide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        {chatColumn}
        <View style={st.histPanel}>
          <ScrollView contentContainerStyle={{ padding: spacing(4) }}>{historyContent}</ScrollView>
        </View>
      </View>
    );
  }
  return chatColumn;
}

const st = StyleSheet.create({
  engineBar: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingHorizontal: spacing(4), paddingVertical: spacing(2), backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  engineLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.pill, padding: 2, borderWidth: 1, borderColor: colors.border },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), borderRadius: radius.pill },
  segBtnActive: { backgroundColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  segTextActive: { color: '#fff' },
  engineHint: { fontSize: 11, color: colors.warning, flexShrink: 1 },
  engineTag: { fontSize: 11, color: colors.textMuted, marginTop: -2, marginBottom: spacing(2), marginLeft: spacing(1), alignSelf: 'flex-start' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing(4), paddingVertical: spacing(2.5), backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), paddingVertical: spacing(1.5), paddingHorizontal: spacing(3) },
  resetText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  bubble: { maxWidth: '85%', padding: spacing(3), borderRadius: radius.lg, marginBottom: spacing(2) },
  user: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bot: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  mgr: { backgroundColor: colors.accent, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  mgrLabel: { fontSize: 11, color: colors.accent, fontWeight: '700', marginBottom: 2, marginLeft: spacing(1), alignSelf: 'flex-start' },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  recs: { marginBottom: spacing(2), alignSelf: 'flex-start', maxWidth: '90%' },
  rec: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing(3), marginBottom: spacing(2), borderWidth: 1, borderColor: colors.primary + '40' },
  recName: { fontWeight: '700', color: colors.primaryDark },
  recMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  escalate: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing(3), marginBottom: spacing(2), alignSelf: 'flex-start' },
  escalateText: { color: colors.warning, fontWeight: '700' },
  sugWrap: { marginTop: spacing(4) },
  sug: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing(2.5), paddingHorizontal: spacing(4), marginBottom: spacing(2), alignSelf: 'flex-start' },
  sugText: { color: colors.primary, fontWeight: '600' },
  inputBar: { flexDirection: 'row', padding: spacing(3), backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: spacing(4), paddingVertical: spacing(3), fontSize: 15, color: colors.text },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: spacing(2) },
  sendText: { color: '#fff', fontSize: 18 },

  // история обращений
  histPanel: { width: 320, backgroundColor: colors.card, borderLeftWidth: 1, borderLeftColor: colors.border },
  histTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing(3) },
  histEmpty: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  histItem: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing(3), marginBottom: spacing(2) },
  histItemActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(1.5) },
  histBadge: { borderRadius: radius.pill, paddingHorizontal: spacing(2), paddingVertical: 2 },
  histBadgeText: { fontSize: 11, fontWeight: '700' },
  histDate: { fontSize: 11, color: colors.textMuted },
  histLast: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  // мобильный сворачиваемый блок
  histToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingHorizontal: spacing(4), paddingVertical: spacing(2.5), backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  histToggleText: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 13 },
  histDropdown: { maxHeight: 260, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
});
