import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Card, Button, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, gradient, radius } from '../../theme';

const DEMO = [
  { label: 'Клиент (скидка 2%)', email: 'client@demo.ru', password: 'client123' },
  { label: 'Клиент (скидка 5%)', email: 'big@demo.ru', password: 'client123' },
  { label: 'Менеджер', email: 'manager@polymer-plast.ru', password: 'manager123' },
];

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
          <Image source={require('../../../assets/whitelogo.png')} style={st.heroLogo} resizeMode="contain" />
          <Text style={st.heroSub}>B2B-портал поставок ПВХ-пластиката</Text>
        </LinearGradient>

        <Card>
          <Text style={st.title}>Вход в систему</Text>
          <TextField label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@company.ru" />
          <TextField label="Пароль" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" />
          {error ? <Text style={st.error}>{error}</Text> : null}
          <Button title="Войти" onPress={submit} loading={loading} />
          <Pressable onPress={() => navigation.navigate('Register')} style={{ marginTop: spacing(4) }}>
            <Text style={st.link}>Нет аккаунта? <Text style={{ fontWeight: '800' }}>Зарегистрировать компанию</Text></Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={st.demoTitle}>Демо-доступы (для защиты ВКР)</Text>
          {DEMO.map((d) => (
            <Pressable key={d.email} style={st.demoRow} onPress={() => { setEmail(d.email); setPassword(d.password); }}>
              <Text style={st.demoLabel}>{d.label}</Text>
              <Text style={st.demoEmail}>{d.email}</Text>
            </Pressable>
          ))}
          <Text style={st.demoHint}>Нажмите, чтобы подставить данные</Text>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: radius.lg, paddingVertical: spacing(8), paddingHorizontal: spacing(5), alignItems: 'center', marginTop: spacing(6), marginBottom: spacing(6) },
  heroLogo: { width: '88%', height: 54 },
  heroSub: { color: 'rgba(255,255,255,0.92)', marginTop: spacing(3), fontSize: 13, fontWeight: '500' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing(4) },
  error: { color: colors.danger, marginBottom: spacing(3) },
  link: { textAlign: 'center', color: colors.primary },
  demoTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: spacing(2) },
  demoRow: { paddingVertical: spacing(2), borderBottomWidth: 1, borderBottomColor: colors.border },
  demoLabel: { fontWeight: '700', color: colors.text },
  demoEmail: { color: colors.textMuted, fontSize: 12 },
  demoHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing(2), fontStyle: 'italic' },
});
