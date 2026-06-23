import { Children, useState, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow, statusColors } from '../theme';

export function Screen({ children, scroll = true, style, refreshControl, contentStyle }) {
  const { width } = useWindowDimensions();
  // На широком вебе ограничиваем ширину контента по центру — иначе строки и
  // кнопки растягиваются на весь экран. На мобильном/узком вебе — как было.
  const body = width >= 1024 ? <View style={s.contentMax}>{children}</View> : children;
  if (scroll) {
    return (
      <ScrollView
        style={[s.screen, style]}
        contentContainerStyle={[{ padding: spacing(4), paddingBottom: spacing(10) }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {body}
      </ScrollView>
    );
  }
  return <View style={[s.screen, style]}>{body}</View>;
}

export function Card({ children, style, onPress }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={({ pressed }) => [s.card, shadow, onPress && pressed && { opacity: 0.85 }, style]}>
      {children}
    </Comp>
  );
}

// Единый белый «лист»: содержимое экрана на одном фоне, секции разделены тонкой линией.
// Каждый прямой потомок = секция. В отличие от Card — статичный стиль (на react-native-web
// функция-стиль Card отбрасывается, фон/паддинг пропадают). Секциям задаём убывающий zIndex,
// чтобы выпадашки автоподстановки из верхних секций перекрывали нижние (подводный камень RN-web).
export function Surface({ children, style }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[s.surface, style]}>
      {items.map((child, i) => (
        <View key={i} style={{ zIndex: items.length - i }}>
          {i > 0 ? <View style={s.surfaceDivider} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, small, icon, style }) {
  const v = BTN[variant] || BTN.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall, { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={s.btnInner}>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} style={{ marginRight: spacing(2) }} /> : null}
          <Text style={[s.btnText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const BTN = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  secondary: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
  outline: { bg: 'transparent', fg: colors.primary, border: colors.primary },
  success: { bg: colors.success, fg: '#fff', border: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
};

export function TextField({ label, error, style, ...props }) {
  return (
    <View style={{ marginBottom: spacing(3) }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[s.input, error && { borderColor: colors.danger }, style]}
        {...props}
      />
      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </View>
  );
}

// Поле с автоподстановкой: фильтрует подсказки по вводу, но позволяет вписать свой вариант.
export function AutocompleteField({ label, value, onChangeText, placeholder, options = [], max = 6, keyboardType }) {
  const [focused, setFocused] = useState(false);
  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    return list.slice(0, max);
  }, [value, options, max]);

  const exact = filtered.length === 1 && filtered[0].toLowerCase() === (value || '').trim().toLowerCase();
  const show = focused && filtered.length > 0 && !exact;

  return (
    <View style={{ marginBottom: spacing(3), zIndex: focused ? 50 : 1 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 180)}
        style={s.input}
      />
      {show ? (
        <View style={s.acDropdown}>
          {filtered.map((o) => (
            <Pressable key={o} style={s.acItem} onPress={() => { onChangeText(o); setFocused(false); }}>
              <Ionicons name="location-outline" size={15} color={colors.textMuted} style={{ marginRight: spacing(2) }} />
              <Text style={s.acText}>{o}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Шаговый ввод количества (− N +)
export function Stepper({ value, onChange, step = 50, min = 0, suffix = 'кг', compact }) {
  const set = (v) => onChange(Math.max(min, Math.round(v)));
  return (
    <View style={[s.stepper, compact && { height: 38 }]}>
      <Pressable style={s.stepBtn} onPress={() => set(value - step)} hitSlop={6}>
        <Ionicons name="remove" size={18} color={colors.text} />
      </Pressable>
      <TextInput
        style={s.stepInput}
        value={String(value)}
        keyboardType="numeric"
        onChangeText={(t) => onChange(Number(String(t).replace(/[^\d]/g, '')) || 0)}
      />
      <Pressable style={s.stepBtn} onPress={() => set(value + step)} hitSlop={6}>
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
      {suffix ? <Text style={s.stepSuffix}>{suffix}</Text> : null}
    </View>
  );
}

export function Badge({ text, bg = colors.primarySoft, fg = colors.primary, style }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }, style]}>
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function StatusBadge({ status, label }) {
  const c = statusColors[status] || { bg: colors.border, fg: colors.text };
  return <Badge text={label || status} bg={c.bg} fg={c.fg} />;
}

export function TagChip({ tag, onPress, active }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, { backgroundColor: active ? tag.color : (tag.color || colors.primary) + '20', borderColor: tag.color || colors.primary }]}
    >
      <Text style={[s.chipText, { color: active ? '#fff' : tag.color || colors.primary }]}>{tag.name}</Text>
    </Pressable>
  );
}

export function Money({ value, suffix = ' ₽', style }) {
  return <Text style={style}>{formatMoney(value)}{suffix}</Text>;
}

export function formatMoney(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function Loader({ text }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {text ? <Text style={{ color: colors.textMuted, marginTop: spacing(2) }}>{text}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <View style={[s.center, { padding: spacing(8) }]}>
      <Text style={{ fontSize: 44, marginBottom: spacing(2) }}>{icon}</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing(1) }}>{subtitle}</Text> : null}
      {action}
    </View>
  );
}

export function Row({ label, value, valueStyle, bold }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, bold && { fontWeight: '700', color: colors.text }]}>{label}</Text>
      <Text style={[s.rowValue, bold && { fontWeight: '800', fontSize: 16 }, valueStyle]}>{value}</Text>
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: spacing(3) }, style]} />;
}

export function SectionTitle({ children, style }) {
  return <Text style={[s.sectionTitle, style]}>{children}</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  contentMax: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing(4), marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border },
  // Единый белый лист (Surface) — без тени, по образцу карточки товара. Зазор между листами
  // на экранах задаём явными View-разделителями (margin у View на RN-web ненадёжен).
  surface: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing(4), borderWidth: 1, borderColor: colors.border },
  surfaceDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(4) },
  btn: { paddingVertical: spacing(3.5), paddingHorizontal: spacing(4), borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: spacing(2), paddingHorizontal: spacing(3) },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing(1.5) },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing(3.5), paddingVertical: spacing(3), fontSize: 16, color: colors.text },
  acDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: 4, overflow: 'hidden', zIndex: 50, ...shadow, elevation: 8 },
  acItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing(3.5), paddingVertical: spacing(3), borderBottomWidth: 1, borderBottomColor: colors.border },
  acText: { fontSize: 15, color: colors.text },
  errorText: { color: colors.danger, fontSize: 12, marginTop: spacing(1) },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, height: 44, backgroundColor: '#fff', overflow: 'hidden' },
  stepBtn: { width: 38, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  stepInput: { width: 48, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text, paddingVertical: 0 },
  stepSuffix: { color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing(2) },
  badge: { paddingHorizontal: spacing(2.5), paddingVertical: spacing(1), borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  chip: { paddingHorizontal: spacing(3), paddingVertical: spacing(1.5), borderRadius: radius.pill, borderWidth: 1, marginRight: spacing(2), marginBottom: spacing(2) },
  chipText: { fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing(1.5) },
  rowLabel: { color: colors.textMuted, fontSize: 14, flex: 1 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'right', flexShrink: 1, marginLeft: spacing(3) },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing(3) },
});
