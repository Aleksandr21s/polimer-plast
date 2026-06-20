import { useState } from 'react';
import { Text, Alert } from 'react-native';
import { api } from '../api/client';
import { Screen, Card, Button, TextField, SectionTitle } from '../components/ui';
import { colors, spacing } from '../theme';

export default function ComplaintScreen({ route, navigation }) {
  const { orderId, number } = route.params || {};
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!subject.trim() || text.trim().length < 5) return Alert.alert('Ошибка', 'Заполните тему и описание (от 5 символов)');
    setLoading(true);
    try {
      await api.post('/complaints', { orderId, subject: subject.trim(), text: text.trim() });
      Alert.alert('Отправлено', 'Рекламация передана менеджеру.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <SectionTitle>Рекламация</SectionTitle>
      <Card>
        {number ? <Text style={{ color: colors.textMuted, marginBottom: spacing(3) }}>По заказу № {number}</Text> : null}
        <TextField label="Тема *" value={subject} onChangeText={setSubject} placeholder="Несоответствие характеристикам" />
        <TextField label="Описание проблемы *" value={text} onChangeText={setText} multiline numberOfLines={5} style={{ minHeight: 120, textAlignVertical: 'top' }} placeholder="Опишите проблему подробно…" />
        <Button title="Отправить рекламацию" icon="alert-circle-outline" onPress={submit} loading={loading} />
      </Card>
    </Screen>
  );
}
