import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Image, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Card, Button, TextField, Badge, Loader, formatMoney } from '../components/ui';
import { useCart } from '../context/CartContext';
import { colors, spacing, radius, shadow } from '../theme';

const SAMPLE_WEIGHTS = [5, 10, 20, 30];
const SIMILAR_QTY = 1000; // объём по умолчанию для быстрого «В заказ» из похожих

export default function ProductScreen({ route, navigation }) {
  const { id } = route.params;
  const { addItem } = useCart();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 1000;

  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [weight, setWeight] = useState('1000');
  const [sampleKg, setSampleKg] = useState(10);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);

  // тост-уведомление
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { api.get(`/catalog/products/${id}`).then(setProduct); }, [id]);
  useEffect(() => {
    const tag = product?.tags?.[0]?.slug;
    if (!tag) return;
    api.get(`/catalog/products?tag=${tag}&pageSize=40`)
      .then((d) => setSimilar(d.products.filter((p) => p.id !== product.id).slice(0, 20)))
      .catch(() => {});
  }, [product?.id]);

  if (!product) return <Loader text="Загрузка карточки…" />;

  const kg = Number(String(weight).replace(',', '.')) || 0;
  const total = kg * product.pricePerKg;

  const addToOrder = () => {
    if (kg <= 0) return Alert.alert('Ошибка', 'Укажите объём в кг (больше 0)');
    addItem(product, kg);
    showToast(`Добавлено в заказ: ${kg.toLocaleString('ru-RU')} кг`);
  };
  const requestInvoice = () => {
    if (kg <= 0) return Alert.alert('Ошибка', 'Укажите объём в кг (больше 0)');
    addItem(product, kg);
    navigation.navigate('Корзина');
  };
  const quickAdd = (p) => {
    addItem(p, SIMILAR_QTY);
    showToast(`Добавлено в заказ: ${p.name}`);
  };
  const requestSample = async () => {
    setSampleLoading(true);
    try {
      await api.post('/samples', { productId: product.id, weightKg: sampleKg });
      showToast(`Образец ${sampleKg} кг запрошен — заявка в ваших заказах`);
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSampleLoading(false);
    }
  };

  // ── переиспользуемые блоки ──
  const photo = (
    <Image source={{ uri: api.fileUrl(product.imageUrl) }} style={isWide ? st.mainImageWeb : st.mainImageMob} resizeMode="cover" />
  );

  const titleBlock = (
    <View>
      <View style={st.articleBadge}><Text style={st.articleBadgeText}>арт. {product.article}</Text></View>
      <Text style={st.name}>{product.name}</Text>
      <View style={st.priceRow}>
        <View style={[st.swatch, { backgroundColor: product.colorHex || '#ccc' }]} />
        <Text style={st.price}>{formatMoney(product.pricePerKg)} ₽<Text style={st.perKg}> / кг</Text></Text>
        <Text style={st.vat}>с НДС {product.vatRate}%</Text>
      </View>
      <View style={[st.featRow, !isWide && st.featRowMob]}>
        {product.tags.map((t) => (
          <Badge key={t.id} text={t.name} bg={(t.color || colors.primary) + '22'} fg={t.color || colors.primary} style={isWide ? { marginRight: spacing(2), marginBottom: spacing(2) } : null} />
        ))}
      </View>
    </View>
  );

  const characteristics = <CharsTable product={product} />;

  const description = (
    <Card>
      <Text style={st.sectionTitle}>Описание</Text>
      <Text style={st.descText}>
        {product.description?.trim()
          ? product.description
          : `Поливинилхлоридный пластикат «${product.name}». Применение: ${product.tags.map((t) => t.name).join(', ') || 'общего назначения'}. Поставляется в гранулах, соответствует требованиям ГОСТ. Доступны бесплатные образцы для тестирования.`}
      </Text>
    </Card>
  );

  const infoCards = (
    <View style={st.infoCards}>
      <InfoCard icon="shield-checkmark-outline" title="Качество и сертификация" sub="Вся продукция сертифицирована и соответствует ГОСТ" />
      <InfoCard icon="car-outline" title="Быстрая доставка" sub="Доставка по всей России и СНГ в короткие сроки" />
      <InfoCard icon="pricetag-outline" title="Выгодные условия" sub="Гибкая система скидок для постоянных клиентов" />
    </View>
  );

  const orderCard = (
    <Card>
      <Text style={st.sectionTitle}>Добавить в заказ</Text>
      <TextField label="Объём, кг" value={weight} onChangeText={setWeight} keyboardType="numeric" />
      <View style={st.totalRow}>
        <Text style={st.totalLabel}>Итого</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.totalValue}>{formatMoney(total)} ₽</Text>
          <Text style={st.vat}>с НДС {product.vatRate}%</Text>
        </View>
      </View>
      <Button title="Добавить в заказ" icon="cart-outline" onPress={addToOrder} />
      <Button title="Запросить счёт" variant="outline" icon="document-text-outline" style={{ marginTop: spacing(2) }} onPress={requestInvoice} />
    </Card>
  );

  const sampleForm = (
    <>
      <Text style={st.sampleHint}>Закажите комплект образцов для тестирования материала. Доставка — по реквизитам вашей компании.</Text>
      <Text style={st.label}>Навеска</Text>
      <View style={st.weightRow}>
        {SAMPLE_WEIGHTS.map((w) => (
          <Pressable key={w} onPress={() => setSampleKg(w)} style={[st.wBtn, sampleKg === w && st.wActive]}>
            <Text style={[st.wText, sampleKg === w && { color: '#fff' }]}>{w} кг</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Запросить образец" icon="flask-outline" onPress={requestSample} loading={sampleLoading} />
    </>
  );

  const sampleCard = isWide ? (
    <Card style={st.sampleCard}>
      <Text style={st.sectionTitle}>Бесплатный образец</Text>
      {sampleForm}
    </Card>
  ) : (
    <Card style={st.sampleCard}>
      <Pressable style={st.sampleHead} onPress={() => setSampleOpen((o) => !o)}>
        <Text style={st.sectionTitle}>Бесплатный образец</Text>
        <Ionicons name={sampleOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
      </Pressable>
      {sampleOpen ? sampleForm : <Text style={[st.sampleHint, { marginBottom: 0 }]}>Закажите пробную партию для тестирования материала.</Text>}
    </Card>
  );

  const similarBlock = similar.length ? (
    <View style={{ marginTop: spacing(4) }}>
      <View style={st.similarHead}>
        <Text style={st.similarTitle}>Похожие товары</Text>
        <Pressable onPress={() => navigation.navigate('Catalog')}><Text style={st.link}>Смотреть все</Text></Pressable>
      </View>
      <View style={st.similarGrid}>
        {similar.map((p) => (
          <View key={p.id} style={[st.similarCard, shadow, { width: isWide ? 224 : '47%' }]}>
            <Pressable onPress={() => navigation.push('Product', { id: p.id })}>
              <Image source={{ uri: api.fileUrl(p.imageUrl) }} style={st.similarImg} resizeMode="cover" />
              <Text style={st.similarName} numberOfLines={2}>{p.name}</Text>
              <Text style={st.similarArticle}>арт. {p.article}</Text>
              <Text style={st.similarPrice}>{formatMoney(p.pricePerKg)} ₽/кг</Text>
            </Pressable>
            <Pressable style={[st.similarAddBtn, !isWide && { gap: spacing(1) }]} onPress={() => quickAdd(p)}>
              <Ionicons name="cart-outline" size={isWide ? 15 : 14} color="#fff" />
              <Text style={[st.similarAddText, !isWide && { fontSize: 12 }]} numberOfLines={1}>Добавить в заказ</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  ) : null;

  const toastEl = toast ? (
    <View style={st.toastWrap} pointerEvents="none">
      <View style={st.toast}>
        <Ionicons name="checkmark-circle" size={18} color="#fff" />
        <Text style={st.toastText}>{toast}</Text>
      </View>
    </View>
  ) : null;

  // ── ВЕБ: три колонки ──
  if (isWide) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing(5) }}>
          <View style={st.container}>
            <View style={st.webRow}>
              <View style={st.colLeft}>
                {photo}
                <View style={{ height: spacing(3) }} />
                {infoCards}
              </View>
              <View style={st.colMid}>
                {titleBlock}
                {characteristics}
                {description}
              </View>
              <View style={st.colRight}>
                {orderCard}
                {sampleCard}
              </View>
            </View>
            {similarBlock}
          </View>
        </ScrollView>
        {toastEl}
      </View>
    );
  }

  // ── МОБИЛЬНЫЙ: стопка + липкая нижняя панель ──
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        {photo}
        <View style={{ padding: spacing(4) }}>
          {titleBlock}
          <View style={{ height: spacing(3) }} />
          {characteristics}
          {infoCards}
          {orderCard}
          <View style={{ height: spacing(2) }} />
          {sampleCard}
          <View style={{ height: spacing(3) }} />
          {description}
          {similarBlock}
        </View>
      </ScrollView>
      <View style={st.stickyBar}>
        <View>
          <Text style={st.stickyTotal}>{formatMoney(total)} ₽</Text>
          <Text style={st.stickySub}>{(kg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} т · с НДС</Text>
        </View>
        <Pressable style={st.stickyBtn} onPress={addToOrder}>
          <Ionicons name="cart-outline" size={18} color="#fff" />
          <Text style={st.stickyBtnText}>Добавить в заказ</Text>
        </Pressable>
      </View>
      {toastEl}
    </View>
  );
}

// ───────────────────── под-компоненты ─────────────────────
function CharsTable({ product }) {
  const rows = [
    ['Цвет', `${product.colorName || '—'}${product.colorRal ? ` (${product.colorRal})` : ''}`],
    ['Твёрдость по Шору, шкала А', product.shoreHardnessA != null ? String(product.shoreHardnessA) : '—'],
    ['Температура хрупкости', product.brittlenessTemp != null ? `${product.brittlenessTemp} °C` : '—'],
    ['ПТР (текучесть расплава)', product.meltFlowIndex != null ? `${product.meltFlowIndex} г/10 мин` : '—'],
    ['Плотность', product.density != null ? `${product.density} г/см³` : '—'],
    ['Единица измерения', product.unit],
  ];
  return (
    <Card>
      <Text style={st.sectionTitle}>Характеристики</Text>
      {rows.map(([k, v], i) => (
        <View key={k} style={[st.charRow, i < rows.length - 1 && st.charDivider]}>
          <Text style={st.charKey}>{k}</Text>
          <Text style={st.charVal}>{v}</Text>
        </View>
      ))}
    </Card>
  );
}

function InfoCard({ icon, title, sub }) {
  return (
    <View style={st.infoCard}>
      <View style={st.infoIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.infoTitle}>{title}</Text>
        <Text style={st.infoSub}>{sub}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { width: '100%', maxWidth: 1600, alignSelf: 'center' },
  webRow: { flexDirection: 'row', alignItems: 'flex-start' },
  colLeft: { width: 420 },
  colMid: { flex: 1, minWidth: 0, gap: spacing(3), marginLeft: spacing(8) },
  colRight: { width: 360, gap: spacing(3), marginLeft: spacing(30) },
  mainImageWeb: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: '#eef1ee', borderWidth: 1, borderColor: colors.border },
  mainImageMob: { width: '100%', aspectRatio: 1, backgroundColor: '#eef1ee' },

  // заголовок/цена
  articleBadge: { alignSelf: 'flex-start', backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: spacing(3), paddingVertical: spacing(1) },
  articleBadgeText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing(2) },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(3) },
  swatch: { width: 26, height: 26, borderRadius: 7, marginRight: spacing(2.5), borderWidth: 1, borderColor: colors.border },
  price: { fontSize: 26, fontWeight: '700', color: colors.primary },
  perKg: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  vat: { fontSize: 12, color: colors.textMuted, marginLeft: spacing(3) },
  featRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(4) },
  featRowMob: { gap: spacing(1.5), marginTop: spacing(2) },

  // секции
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing(3) },
  descText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },

  // характеристики — вертикальная таблица, значения выровнены в колонку
  charRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing(2.5) },
  charDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(27,36,32,0.08)' },
  charKey: { flex: 1.5, color: colors.textMuted, fontSize: 14, paddingRight: spacing(3) },
  charVal: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },

  // преимущества (под фото) — компактные строки
  infoCards: { gap: spacing(2) },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2.5), backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing(3) },
  infoIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontWeight: '700', color: colors.text, fontSize: 13.5 },
  infoSub: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },

  // заказ
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing(3) },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.text },

  // образец
  sampleCard: { backgroundColor: colors.accentSoft, borderColor: colors.accent + '55' },
  sampleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sampleHint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing(3) },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing(2) },
  weightRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(3) },
  wBtn: { flex: 1, paddingVertical: spacing(2.5), borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: '#fff' },
  wActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  wText: { fontWeight: '600', color: colors.text },

  // похожие — крупные белые карточки с кнопкой
  similarHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(3) },
  similarTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  similarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  similarCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing(3) },
  similarImg: { width: '100%', height: 150, borderRadius: radius.md, backgroundColor: '#eef1ee', marginBottom: spacing(2.5) },
  similarName: { fontSize: 14, fontWeight: '600', color: colors.text },
  similarArticle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  similarPrice: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: spacing(2) },
  similarAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(2), backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing(2.5), marginTop: spacing(3) },
  similarAddText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // липкая панель (моб)
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing(4), paddingVertical: spacing(3), gap: spacing(3) },
  stickyTotal: { fontSize: 18, fontWeight: '800', color: colors.text },
  stickySub: { fontSize: 12, color: colors.textMuted },
  stickyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing(5), paddingVertical: spacing(3.5) },
  stickyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // тост
  toastWrap: { position: 'absolute', top: spacing(5), left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), backgroundColor: colors.primaryDark, paddingHorizontal: spacing(4), paddingVertical: spacing(3), borderRadius: radius.pill, ...shadow },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
