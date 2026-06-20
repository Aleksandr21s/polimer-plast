import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { useChat } from '../context/ChatContext';
import { colors, spacing, radius } from '../theme';

// Верхняя панель навигации для веб-версии (вместо нижних вкладок).
// Логотип слева, пункты меню справа. Поиск вынесен в каталог.
// items: [{ name, icon, label }]; active — имя активной вкладки.
// canBack/onBack — глобальная кнопка «Назад» (показывается, когда есть история).
export function TopBar({ items, active, onNavigate, canBack, onBack }) {
  const { count } = useCart();
  const { unanswered = 0 } = useChat() || {};

  return (
    <View style={st.bar}>
      {canBack ? (
        <Pressable onPress={onBack} style={st.back} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={st.backLabel}>Назад</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => onNavigate('Каталог')} style={st.brand}>
        <Image source={require('../../assets/blacklogo.png')} style={st.logo} resizeMode="contain" />
      </Pressable>

      <View style={{ flex: 1 }} />

      <View style={st.nav}>
        {items.map((it) => {
          const isActive = active === it.name;
          const badge = it.name === 'Корзина' ? (count > 0 ? count : null)
            : it.name === 'Обращения' ? (unanswered > 0 ? unanswered : null)
            : null;
          return (
            <Pressable key={it.name} onPress={() => onNavigate(it.name)} style={st.navItem}>
              <View>
                <Ionicons name={it.icon} size={22} color={isActive ? colors.primary : colors.text} />
                {badge ? (
                  <View style={st.badge}><Text style={st.badgeText}>{badge}</Text></View>
                ) : null}
              </View>
              <Text style={[st.navLabel, isActive && { color: colors.primary, fontWeight: '700' }]}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  bar: { height: 64, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing(6), paddingVertical: spacing(2), gap: spacing(5), zIndex: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  backLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  brand: { paddingRight: spacing(2), alignSelf: 'stretch', justifyContent: 'center' },
  logo: { width: 367, height: 48 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing(5) },
  navItem: { alignItems: 'center', gap: 2 },
  navLabel: { fontSize: 12, color: colors.textMuted },
  badge: { position: 'absolute', top: -6, right: -10, backgroundColor: colors.primary, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
