import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { Screen, Surface, Button, Row, Divider, SectionTitle, Badge, Loader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme';

export default function ProfileScreen() {
  const { user, logout, isManager } = useAuth();
  const [company, setCompany] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/company').catch(() => null),
      isManager ? Promise.resolve(null) : api.get('/company/loyalty').catch(() => null),
    ]).then(([c, l]) => { setCompany(c); setLoyalty(l); }).finally(() => setLoading(false));
  }, [isManager]));

  if (loading) return <Loader />;

  const progress = loyalty?.nextTier ? Math.min(1, loyalty.tons / loyalty.nextTier.minTons) : 1;

  return (
    <Screen>
      <Surface>
        <View>
          <View style={st.avatarRow}>
            <View style={st.avatar}><Text style={st.avatarText}>{(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{user.lastName} {user.firstName} {user.middleName || ''}</Text>
              <Text style={st.position}>{user.position || (isManager ? 'Менеджер' : 'Сотрудник')}</Text>
              <Badge text={isManager ? 'Менеджер' : 'Клиент'} bg={isManager ? colors.accent + '20' : colors.primarySoft} fg={isManager ? colors.accent : colors.primary} style={{ marginTop: spacing(2) }} />
            </View>
          </View>
          <Divider />
          <Row label="E-mail" value={user.email} />
          {user.phone ? <Row label="Телефон" value={user.phone} /> : null}
        </View>

        {!isManager && loyalty ? (
          <View>
            <SectionTitle>Программа лояльности</SectionTitle>
            <View style={st.discountBox}>
              <Text style={st.discountValue}>{loyalty.currentDiscount}%</Text>
              <Text style={st.discountLabel}>текущая скидка компании</Text>
            </View>
            <Text style={st.tons}>Закуплено за 2 года: <Text style={{ fontWeight: '800', color: colors.text }}>{loyalty.tons.toLocaleString('ru-RU')} т</Text></Text>
            <View style={st.progressTrack}><View style={[st.progressFill, { width: `${progress * 100}%` }]} /></View>
            {loyalty.nextTier ? (
              <Text style={st.next}>До скидки {loyalty.nextTier.discountPercent}% осталось {loyalty.nextTier.tonsLeft.toLocaleString('ru-RU')} т</Text>
            ) : <Text style={[st.next, { color: colors.success }]}>Достигнут максимальный уровень скидки 🎉</Text>}
            <Divider />
            {loyalty.tiers.map((t) => (
              <Row key={t.minTons} label={`от ${t.minTons} т`} value={`${t.discountPercent}%`} valueStyle={{ color: loyalty.currentDiscount >= t.discountPercent ? colors.success : colors.textMuted }} />
            ))}
          </View>
        ) : null}

        {company ? (
          <View>
            <SectionTitle>Реквизиты компании</SectionTitle>
            <Text style={st.companyName}>{company.name}</Text>
            <Badge text={company.orgForm === 'OOO' ? 'ООО' : 'ИП'} style={{ marginVertical: spacing(2) }} />
            <Row label="ИНН" value={company.inn || '—'} />
            {company.kpp ? <Row label="КПП" value={company.kpp} /> : null}
            {company.ogrn ? <Row label="ОГРН" value={company.ogrn} /> : null}
            {company.legalAddress ? <Row label="Юр. адрес" value={company.legalAddress} /> : null}
          </View>
        ) : null}
      </Surface>

      <View style={{ height: spacing(3) }} />
      <Button title="Выйти" variant="danger" onPress={logout} />
      <Text style={st.footer}>ООО ТПК «Полимер-Пласт» · B2B-портал · 2026</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing(3) },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  position: { color: colors.textMuted, marginTop: 2 },
  discountBox: { alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: radius.lg, paddingVertical: spacing(4), marginBottom: spacing(3) },
  discountValue: { fontSize: 40, fontWeight: '900', color: colors.success },
  discountLabel: { color: colors.success, fontWeight: '600' },
  tons: { color: colors.textMuted, marginBottom: spacing(2) },
  progressTrack: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: colors.primary, borderRadius: 5 },
  next: { color: colors.textMuted, fontSize: 13, marginTop: spacing(2) },
  companyName: { fontSize: 16, fontWeight: '700', color: colors.text },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing(4) },
});
