import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, Pressable, Alert, Linking, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../api/client';
import { Screen, Card, Button, StatusBadge, Row, Divider, SectionTitle, Loader, formatMoney } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme';

const DOC_LABELS = {
  COMMERCIAL_OFFER: { t: 'КП / счёт', icon: '📋' },
  TRANSPORT_INVOICE: { t: 'Счёт ТК (доставка)', icon: '🚚' },
  PAYMENT_GOODS: { t: 'Платёжка за товар', icon: '💳' },
  PAYMENT_DELIVERY: { t: 'Платёжка за доставку', icon: '💳' },
  OTHER: { t: 'Документ', icon: '📎' },
};

export default function OrderScreen({ route, navigation }) {
  const { id, openInvoice } = route.params;
  const { isManager } = useAuth();
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const autoOpenedRef = useRef(false);

  const load = useCallback(async () => {
    const data = await api.get(`/orders/${id}`);
    setOrder(data);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Автооткрытие КП (PDF) сразу после формирования из корзины
  useEffect(() => {
    if (order && openInvoice && !autoOpenedRef.current) {
      const kp = order.documents.find((d) => d.type === 'COMMERCIAL_OFFER');
      if (kp) {
        autoOpenedRef.current = true;
        Linking.openURL(api.authedFileUrl(kp.downloadUrl)).catch(() => {});
      }
    }
  }, [order, openInvoice]);

  if (!order) return <Loader text="Загрузка заказа…" />;

  const act = async (fn, confirm) => {
    if (confirm && !(await ask(confirm))) return;
    setBusy(true);
    try { await fn(); await load(); } catch (e) { Alert.alert('Ошибка', e.message); } finally { setBusy(false); }
  };

  const issueInvoice = () => act(() => api.post(`/orders/${id}/issue-invoice`));
  const confirmPayment = () => act(() => api.post(`/orders/${id}/confirm-payment`), 'Подтвердить оплату заказа?');
  const setStatus = (status, label) => act(() => api.patch(`/orders/${id}/status`, { status }), `Перевести заказ в статус «${label}»?`);
  const remove = async () => {
    if (!(await ask('Удалить заказ? Действие необратимо.'))) return;
    setBusy(true);
    try {
      await api.del(`/orders/${id}`);
      navigation.goBack(); // заказ удалён — возвращаемся к списку (он обновится сам)
    } catch (e) {
      Alert.alert('Ошибка', e.message);
      setBusy(false);
    }
  };

  const uploadDoc = async (type) => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const file = res.assets[0];
    const form = new FormData();
    form.append('type', type);
    if (Platform.OS === 'web' && file.file) form.append('file', file.file);
    else form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
    setBusy(true);
    try { await api.upload(`/orders/${id}/documents`, form); await load(); Alert.alert('Готово', 'Документ загружен'); }
    catch (e) { Alert.alert('Ошибка', e.message); } finally { setBusy(false); }
  };

  const openDoc = (doc) => Linking.openURL(api.authedFileUrl(doc.downloadUrl));

  const offerDoc = order.documents.find((d) => d.type === 'COMMERCIAL_OFFER');
  const hasOffer = !!offerDoc;
  const canClientPay = !isManager && order.status === 'INVOICE_ISSUED';
  const canCancel = ['NEW', 'INVOICE_ISSUED'].includes(order.status);

  return (
    <Screen>
      <Card>
        <View style={st.headRow}>
          <Text style={st.number}>№ {order.number}</Text>
          <StatusBadge status={order.status} label={order.statusLabel} />
        </View>
        <Text style={st.meta}>от {new Date(order.createdAt).toLocaleDateString('ru-RU')}</Text>
        {order.company ? <Text style={st.company}>{order.company.name}</Text> : null}
        <Text style={st.delivery}>📍 {order.deliveryRegion}{order.deliveryCity ? ', ' + order.deliveryCity : ''}</Text>
        {order.comment ? <Text style={st.comment}>«{order.comment}»</Text> : null}
        {order.remainingHours != null ? (
          <View style={[st.timerBox, order.remainingHours < 24 && { backgroundColor: colors.dangerSoft }]}>
            <Text style={[st.timerText, order.remainingHours < 24 && { color: colors.danger }]}>
              ⏳ Оплатить/подтвердить в течение {Math.floor(order.remainingHours)} ч, иначе автоотмена
            </Text>
          </View>
        ) : null}
        {order.status === 'CANCELLED' && order.cancelReason ? <Text style={st.cancel}>❌ {order.cancelReason}</Text> : null}
      </Card>

      {/* КП/счёт (PDF) — крупная кнопка открытия */}
      {hasOffer ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
          <Text style={st.offerTitle}>📄 Коммерческое предложение готово</Text>
          <Text style={st.offerSub}>{offerDoc.fileName}</Text>
          <Button title="Открыть / скачать КП (PDF)" icon="download-outline" onPress={() => openDoc(offerDoc)} />
        </Card>
      ) : null}

      {/* Позиции */}
      <Card>
        <SectionTitle>Состав заказа</SectionTitle>
        {order.items.map((it) => (
          <View key={it.id} style={st.item}>
            <View style={[st.swatch, { backgroundColor: it.colorHex || '#ccc' }]} />
            <View style={{ flex: 1 }}>
              <Text style={st.itemName}>{it.name}</Text>
              <Text style={st.itemMeta}>{(it.weightKg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 })} т × {formatMoney(it.pricePerTon)} ₽/т</Text>
            </View>
            <Text style={st.itemSum}>{formatMoney(it.lineTotal)} ₽</Text>
          </View>
        ))}
        <Divider />
        <Row label="Объём" value={`${(order.totalWeightKg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 })} т`} />
        <Row label="Сумма без скидки" value={`${formatMoney(order.subtotal)} ₽`} />
        {order.discountPercent > 0 ? <Row label={`Скидка (${order.discountPercent}%)`} value={`−${formatMoney(order.discountAmount)} ₽`} valueStyle={{ color: colors.success }} /> : null}
        <Row label={`НДС ${order.vatRate}%`} value={`${formatMoney(order.vatAmount)} ₽`} />
        <Row label="Итого к оплате" value={`${formatMoney(order.total)} ₽`} bold />
      </Card>

      {/* Документы */}
      <Card>
        <SectionTitle>Документы</SectionTitle>
        {order.documents.length === 0 ? <Text style={st.empty}>Документов пока нет</Text> : null}
        {order.documents.map((d) => (
          <Pressable key={d.id} style={st.doc} onPress={() => openDoc(d)}>
            <Text style={st.docIcon}>{(DOC_LABELS[d.type] || DOC_LABELS.OTHER).icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.docTitle}>{(DOC_LABELS[d.type] || DOC_LABELS.OTHER).t}</Text>
              <Text style={st.docMeta}>{d.fileName}{d.uploadedBy ? ` · ${d.uploadedBy}` : ''}</Text>
            </View>
            <Text style={st.docOpen}>Открыть ↗</Text>
          </Pressable>
        ))}

        {/* Загрузка документов по ролям */}
        {isManager ? (
          <Button title="Загрузить счёт ТК за доставку" variant="outline" small icon="car-outline" style={{ marginTop: spacing(2) }} onPress={() => uploadDoc('TRANSPORT_INVOICE')} />
        ) : null}
        {canClientPay ? (
          <>
            <Button title="Загрузить платёжку за товар" variant="outline" small icon="card-outline" style={{ marginTop: spacing(2) }} onPress={() => uploadDoc('PAYMENT_GOODS')} />
            <Button title="Загрузить платёжку за доставку" variant="outline" small icon="card-outline" style={{ marginTop: spacing(2) }} onPress={() => uploadDoc('PAYMENT_DELIVERY')} />
          </>
        ) : null}
      </Card>

      {/* Отслеживание */}
      <Card>
        <SectionTitle>Отслеживание заказа</SectionTitle>
        {order.history.map((h, idx) => (
          <View key={idx} style={st.tl}>
            <View style={st.tlDot}>
              <View style={[st.dot, { backgroundColor: idx === order.history.length - 1 ? colors.primary : colors.border }]} />
              {idx < order.history.length - 1 ? <View style={st.line} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing(3) }}>
              <Text style={st.tlStatus}>{h.statusLabel}</Text>
              {h.comment ? <Text style={st.tlComment}>{h.comment}</Text> : null}
              <Text style={st.tlDate}>{new Date(h.createdAt).toLocaleString('ru-RU')}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Действия */}
      <View style={{ gap: spacing(2) }}>
        {!hasOffer && !['CANCELLED', 'COMPLETED'].includes(order.status) ? (
          <Button title="Сформировать КП / счёт (PDF)" icon="document-text-outline" onPress={issueInvoice} loading={busy} />
        ) : null}
        {hasOffer && order.status === 'INVOICE_ISSUED' ? (
          <Button title="Переформировать КП / счёт" variant="secondary" icon="refresh-outline" onPress={issueInvoice} loading={busy} />
        ) : null}

        {isManager && order.status === 'INVOICE_ISSUED' ? (
          <Button title="Подтвердить оплату" variant="success" icon="checkmark-circle-outline" onPress={confirmPayment} loading={busy} />
        ) : null}
        {isManager && order.status === 'PAID' ? (
          <Button title="Отметить «Отгружен»" icon="cube-outline" onPress={() => setStatus('SHIPPED', 'Отгружен')} loading={busy} />
        ) : null}
        {isManager && order.status === 'SHIPPED' ? (
          <Button title="Отметить «Доставлен»" icon="checkmark-done-outline" onPress={() => setStatus('DELIVERED', 'Доставлен')} loading={busy} />
        ) : null}
        {isManager && order.status === 'DELIVERED' ? (
          <Button title="Завершить заказ" variant="success" icon="checkmark-done-circle-outline" onPress={() => setStatus('COMPLETED', 'Завершён')} loading={busy} />
        ) : null}

        {['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) ? (
          <Button title="Подать рекламацию" variant="outline" icon="alert-circle-outline" onPress={() => navigation.navigate('Complaint', { orderId: order.id, number: order.number })} />
        ) : null}
        {canCancel ? <Button title="Удалить заказ" variant="danger" icon="trash-outline" onPress={remove} loading={busy} /> : null}
      </View>
    </Screen>
  );
}

// Кросс-платформенное подтверждение: в вебе Alert с кнопками не срабатывает,
// поэтому используем window.confirm; на мобильных — Alert.
function ask(message) {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : true);
  }
  return new Promise((resolve) => {
    Alert.alert('Подтверждение', message, [
      { text: 'Нет', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Да', onPress: () => resolve(true) },
    ]);
  });
}

const st = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: 18, fontWeight: '900', color: colors.text },
  meta: { color: colors.textMuted, marginTop: spacing(1.5) },
  company: { color: colors.primary, fontWeight: '700', marginTop: spacing(2) },
  delivery: { color: colors.text, marginTop: spacing(2) },
  comment: { color: colors.textMuted, fontStyle: 'italic', marginTop: spacing(1.5) },
  timerBox: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing(3), marginTop: spacing(3) },
  timerText: { color: colors.warning, fontWeight: '600', fontSize: 13 },
  cancel: { color: colors.danger, marginTop: spacing(2), fontWeight: '600' },
  offerTitle: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  offerSub: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1.5), marginBottom: spacing(3) },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(2) },
  swatch: { width: 36, height: 36, borderRadius: 9, marginRight: spacing(3), borderWidth: 1, borderColor: colors.border },
  itemName: { fontWeight: '700', color: colors.text, fontSize: 14 },
  itemMeta: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1) },
  itemSum: { fontWeight: '800', color: colors.text, marginLeft: spacing(2) },
  empty: { color: colors.textMuted },
  doc: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing(3), marginBottom: spacing(2) },
  docIcon: { fontSize: 22, marginRight: spacing(3) },
  docTitle: { fontWeight: '700', color: colors.text },
  docMeta: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1) },
  docOpen: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  tl: { flexDirection: 'row' },
  tlDot: { width: 24, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 },
  tlStatus: { fontWeight: '700', color: colors.text },
  tlComment: { color: colors.textMuted, fontSize: 13, marginTop: spacing(1) },
  tlDate: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1) },
});
