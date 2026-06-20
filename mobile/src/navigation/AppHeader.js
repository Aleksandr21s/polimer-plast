import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

// На широком вебе (>=1024) используется верхняя панель TopBar — она же даёт глобальный «Назад».
// На остальных раскладках (мобильный / узкий веб) шапку рисует этот AppHeader.
export function useTopBarLayout() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 1024;
}

// Кастомная зелёная шапка для раскладки с вкладками.
// Кнопка «Назад» показывается, только когда есть куда возвращаться (включая историю вкладок,
// т.к. у Tab.Navigator выставлен backBehavior="history").
// Сигнатура хедера RN: { navigation, route, options } — общая для native-stack и bottom-tabs.
export default function AppHeader({ navigation, route, options }) {
  const insets = useSafeAreaInsets();
  const topBar = useTopBarLayout();
  if (topBar) return null; // на широком вебе «Назад» живёт в TopBar — дублирование исключаем

  const title = options?.title ?? route?.name ?? '';
  const canGoBack = navigation.canGoBack();

  return (
    <View style={[st.bar, { paddingTop: insets.top, height: 56 + insets.top }]}>
      {canGoBack ? (
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={st.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
          <Text style={st.backText}>Назад</Text>
        </Pressable>
      ) : null}
      <Text style={[st.title, !canGoBack && { marginLeft: spacing(2) }]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryDark, paddingHorizontal: spacing(3), gap: spacing(2) },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
});
