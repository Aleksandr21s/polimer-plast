import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Screen, Card, Button, TextField, SectionTitle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [f, setF] = useState({
    lastName: '', firstName: '', middleName: '', position: '', phone: '', email: '', password: '',
    orgForm: 'OOO', companyName: '', inn: '', kpp: '', ogrn: '', legalAddress: '',
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await register({
        email: f.email.trim(), password: f.password,
        firstName: f.firstName, lastName: f.lastName, middleName: f.middleName, position: f.position, phone: f.phone,
        company: { name: f.companyName, orgForm: f.orgForm, inn: f.inn, kpp: f.kpp, ogrn: f.ogrn, legalAddress: f.legalAddress },
      });
    } catch (e) {
      const LABELS = {
        'company.name': 'Наименование', 'company.inn': 'ИНН', 'company.kpp': 'КПП',
        'company.ogrn': 'ОГРН', 'company.legalAddress': 'Юр. адрес',
        email: 'E-mail', password: 'Пароль', firstName: 'Имя', lastName: 'Фамилия',
      };
      const details = e.details
        ? '\n' + e.details.map((d) => `• ${LABELS[d.path.join('.')] || d.path.join('.')}: ${d.message}`).join('\n')
        : '';
      setError(e.message + details);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <SectionTitle>Регистрация</SectionTitle>

        <Card>
          <Text style={st.group}>Личные данные</Text>
          <TextField label="Фамилия *" value={f.lastName} onChangeText={set('lastName')} />
          <TextField label="Имя *" value={f.firstName} onChangeText={set('firstName')} />
          <TextField label="Отчество" value={f.middleName} onChangeText={set('middleName')} />
          <TextField label="Должность" value={f.position} onChangeText={set('position')} placeholder="Менеджер по закупкам" />
          <TextField label="Телефон" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        </Card>

        <Card>
          <Text style={st.group}>Учётная запись</Text>
          <TextField label="E-mail *" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          <TextField label="Пароль *" value={f.password} onChangeText={set('password')} secureTextEntry placeholder="не менее 6 символов" />
        </Card>

        <Card>
          <Text style={st.group}>Реквизиты компании</Text>
          <Text style={st.label}>Формат организации</Text>
          <View style={st.segment}>
            {['OOO', 'IP'].map((o) => (
              <Pressable key={o} onPress={() => set('orgForm')(o)} style={[st.segBtn, f.orgForm === o && st.segActive]}>
                <Text style={[st.segText, f.orgForm === o && { color: '#fff' }]}>{o === 'OOO' ? 'ООО' : 'ИП'}</Text>
              </Pressable>
            ))}
          </View>
          <TextField label="Наименование организации *" value={f.companyName} onChangeText={set('companyName')} placeholder="ООО «Ромашка»" />
          <TextField label="ИНН *" value={f.inn} onChangeText={set('inn')} keyboardType="number-pad" placeholder="10 или 12 цифр" />
          <TextField label="КПП" value={f.kpp} onChangeText={set('kpp')} keyboardType="number-pad" />
          <TextField label="ОГРН" value={f.ogrn} onChangeText={set('ogrn')} keyboardType="number-pad" />
          <TextField label="Юридический адрес" value={f.legalAddress} onChangeText={set('legalAddress')} multiline />
        </Card>

        {error ? <Text style={st.error}>{error}</Text> : null}
        <Button title="Зарегистрироваться" onPress={submit} loading={loading} />
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: spacing(4) }}>
          <Text style={st.link}>Уже есть аккаунт? Войти</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  group: { fontSize: 15, fontWeight: '800', color: colors.primary, marginBottom: spacing(3) },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing(1.5) },
  segment: { flexDirection: 'row', marginBottom: spacing(3), gap: spacing(2) },
  segBtn: { flex: 1, paddingVertical: spacing(2.5), borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  segActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontWeight: '700', color: colors.text },
  error: { color: colors.danger, marginBottom: spacing(3) },
  link: { textAlign: 'center', color: colors.primary },
});
