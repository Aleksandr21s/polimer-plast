import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, ScrollView, RefreshControl, Linking, Image, TextInput, Modal, useWindowDimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Loader, EmptyState, Stepper, Badge, formatMoney } from '../components/ui';
import { useCart } from '../context/CartContext';
import { colors, spacing, radius, shadow } from '../theme';

const SORTS = [
  { key: 'popular', label: 'Популярные' },
  { key: 'price_asc', label: 'Сначала дешевле' },
  { key: 'price_desc', label: 'Сначала дороже' },
  { key: 'name', label: 'По названию' },
  { key: 'shore_asc', label: 'Мягче (Шор ↑)' },
  { key: 'shore_desc', label: 'Твёрже (Шор ↓)' },
];

function sortProducts(list, key) {
  const a = [...list];
  switch (key) {
    case 'price_asc': return a.sort((x, y) => (x.pricePerKg ?? 0) - (y.pricePerKg ?? 0));
    case 'price_desc': return a.sort((x, y) => (y.pricePerKg ?? 0) - (x.pricePerKg ?? 0));
    case 'shore_asc': return a.sort((x, y) => (x.shoreHardnessA ?? 0) - (y.shoreHardnessA ?? 0));
    case 'shore_desc': return a.sort((x, y) => (y.shoreHardnessA ?? 0) - (x.shoreHardnessA ?? 0));
    case 'name': return a.sort((x, y) => x.name.localeCompare(y.name, 'ru'));
    default: return a.sort((x, y) => x.id - y.id);
  }
}

export default function CatalogScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 1024;
  const SIDEBAR = 392, CART = 300;
  const centerW = width - SIDEBAR - CART;
  const { items: cartItems, addItem } = useCart();

  const [tags, setTags] = useState([]);
  const [products, setProducts] = useState([]);
  const [catalogFile, setCatalogFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // фильтры
  const [q, setQ] = useState(route.params?.q || '');
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [range, setRange] = useState({ priceFrom: '', priceTo: '', shoreFrom: '', shoreTo: '', brittleTo: '' });
  const [sort, setSort] = useState('popular');
  const [grid, setGrid] = useState(false);
  const [qty, setQty] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  useEffect(() => { if (route.params?.q !== undefined) setQ(route.params.q); }, [route.params?.q]);

  useEffect(() => {
    (async () => {
      try {
        const [t, p, cf] = await Promise.all([
          api.get('/catalog/tags'),
          api.get('/catalog/products?pageSize=300'),
          api.get('/catalog/catalog-file').catch(() => null),
        ]);
        setTags(t);
        setProducts(p.products);
        setCatalogFile(cf);
      } finally { setLoading(false); }
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const p = await api.get('/catalog/products?pageSize=300');
    setProducts(p.products);
    setRefreshing(false);
  };

  const toggleTag = (slug) => setSelectedTags((prev) => {
    const n = new Set(prev);
    n.has(slug) ? n.delete(slug) : n.add(slug);
    return n;
  });
  const setR = (k) => (v) => setRange((p) => ({ ...p, [k]: v.replace(/[^\d]/g, '') }));
  const resetAll = () => { setSelectedTags(new Set()); setRange({ priceFrom: '', priceTo: '', shoreFrom: '', shoreTo: '', brittleTo: '' }); setQ(''); };

  const filtered = useMemo(() => {
    const num = (v) => (v === '' ? null : Number(v));
    const pf = num(range.priceFrom), pt = num(range.priceTo), sf = num(range.shoreFrom), stp = num(range.shoreTo), bt = num(range.brittleTo);
    const ql = q.trim().toLowerCase();
    return products.filter((p) => {
      if (ql && !p.name.toLowerCase().includes(ql)) return false;
      if (selectedTags.size && !p.tags.some((t) => selectedTags.has(t.slug))) return false;
      if (pf != null && (p.pricePerKg ?? 0) < pf) return false;
      if (pt != null && (p.pricePerKg ?? 0) > pt) return false;
      if (sf != null && (p.shoreHardnessA ?? 0) < sf) return false;
      if (stp != null && (p.shoreHardnessA ?? 0) > stp) return false;
      if (bt != null && (p.brittlenessTemp ?? 0) > bt) return false; // не теплее, чем
      return true;
    });
  }, [products, q, selectedTags, range]);

  const sorted = useMemo(() => sortProducts(filtered, sort), [filtered, sort]);

  const getQty = (id) => qty[id] ?? 100;
  const setQtyFor = (id, v) => setQty((p) => ({ ...p, [id]: v }));
  const addToOrder = (p) => addItem(p, getQty(p.id));

  const activeFilterCount = selectedTags.size + Object.values(range).filter(Boolean).length;
  const openProduct = (id) => navigation.navigate('Product', { id });

  // ── Активные фильтр-чипы ──
  const activeChips = [
    ...[...selectedTags].map((slug) => ({ key: 't:' + slug, label: tags.find((t) => t.slug === slug)?.name || slug, onRemove: () => toggleTag(slug) })),
    ...((range.priceFrom || range.priceTo) ? [{ key: 'price', label: `Цена: ${range.priceFrom || '0'}–${range.priceTo || '∞'} ₽/кг`, onRemove: () => setRange((p) => ({ ...p, priceFrom: '', priceTo: '' })) }] : []),
    ...((range.shoreFrom || range.shoreTo) ? [{ key: 'shore', label: `Шор: ${range.shoreFrom || '0'}–${range.shoreTo || '∞'}`, onRemove: () => setRange((p) => ({ ...p, shoreFrom: '', shoreTo: '' })) }] : []),
    ...(range.brittleTo ? [{ key: 'brittle', label: `Хрупкость ≤ ${range.brittleTo}°C`, onRemove: () => setRange((p) => ({ ...p, brittleTo: '' })) }] : []),
  ];

  if (loading) return <Loader text="Загрузка каталога…" />;

  const filterPanel = (
    <FilterContent tags={tags} selectedTags={selectedTags} toggleTag={toggleTag} range={range} setR={setR} resetAll={resetAll} />
  );

  const listHeader = (
    <View>
      {isWeb ? <Text style={st.breadcrumb}>Главная  ›  Каталог</Text> : null}
      <View style={st.titleRow}>
        <Text style={st.title}>Каталог <Text style={st.titleCount}>{filtered.length} товаров</Text></Text>
        <View style={st.titleControls}>
          <SortControl value={sort} onChange={setSort} onOpenModal={() => setShowSort(true)} isWeb={isWeb} />
          <View style={st.viewToggle}>
            <Pressable onPress={() => setGrid(false)} style={[st.viewBtn, !grid && st.viewBtnActive]}><Ionicons name="list" size={18} color={!grid ? '#fff' : colors.textMuted} /></Pressable>
            <Pressable onPress={() => setGrid(true)} style={[st.viewBtn, grid && st.viewBtnActive]}><Ionicons name="grid" size={16} color={grid ? '#fff' : colors.textMuted} /></Pressable>
          </View>
        </View>
      </View>

      {/* Быстрые метки */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing(2), gap: spacing(2) }}>
        <Chip label={`Все товары · ${products.length}`} active={selectedTags.size === 0} color={colors.primary} onPress={() => setSelectedTags(new Set())} />
        {tags.map((t) => (
          <Chip key={t.slug} label={`${t.name} · ${t.productCount}`} color={t.color} active={selectedTags.has(t.slug)} onPress={() => toggleTag(t.slug)} />
        ))}
      </ScrollView>

      {/* Активные фильтры */}
      {activeChips.length ? (
        <View style={st.activeRow}>
          <Text style={st.activeLabel}>Выбрано: {activeFilterCount}</Text>
          {activeChips.map((c) => (
            <Pressable key={c.key} style={st.activeChip} onPress={c.onRemove}>
              <Text style={st.activeChipText}>{c.label}</Text>
              <Ionicons name="close" size={13} color={colors.textMuted} />
            </Pressable>
          ))}
          <Pressable onPress={resetAll}><Text style={st.resetLink}>Сбросить всё</Text></Pressable>
        </View>
      ) : null}
    </View>
  );

  const renderItem = ({ item }) => grid
    ? <GridCard product={item} qty={getQty(item.id)} setQty={(v) => setQtyFor(item.id, v)} onAdd={() => addToOrder(item)} onOpen={() => openProduct(item.id)} cardWidth={isWeb ? '31.5%' : '48%'} />
    : <ListCard product={item} qty={getQty(item.id)} setQty={(v) => setQtyFor(item.id, v)} onAdd={() => addToOrder(item)} onOpen={() => openProduct(item.id)} onSample={() => openProduct(item.id)} isWeb={isWeb} />;

  // ── Центральная колонка (список товаров) ──
  const productList = (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      key={grid ? 'grid' : 'list'}
      numColumns={grid ? (isWeb ? 3 : 2) : 1}
      columnWrapperStyle={grid ? { gap: spacing(3), paddingHorizontal: spacing(isWeb ? 5 : 4) } : undefined}
      contentContainerStyle={{ paddingTop: spacing(3), paddingBottom: spacing(12), paddingHorizontal: grid ? 0 : spacing(isWeb ? 5 : 4) }}
      data={sorted}
      keyExtractor={(p) => String(p.id)}
      ListHeaderComponent={isWeb ? null : <View style={{ paddingHorizontal: grid ? spacing(4) : 0 }}>{listHeader}</View>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState icon="🔍" title="Ничего не найдено" subtitle="Измените фильтры или запрос" />}
      renderItem={renderItem}
    />
  );

  // ── ВЕБ: три колонки ──
  if (isWeb) {
    return (
      <View style={st.webRoot}>
        <ScrollView style={[st.webSidebar, { width: SIDEBAR }]} contentContainerStyle={{ paddingHorizontal: spacing(6), paddingVertical: spacing(4) }}>
          {catalogFile ? (
            <Pressable onPress={() => Linking.openURL(api.fileUrl(catalogFile.downloadUrl))} style={st.catalogBanner}>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={st.catalogText}>Каталог PDF</Text>
              <Ionicons name="download-outline" size={16} color="#fff" />
            </Pressable>
          ) : null}
          {filterPanel}
        </ScrollView>
        <View style={{ width: centerW }}>
          <View style={st.webSearchWrap}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Поиск по каталогу" placeholderTextColor={colors.textMuted} style={st.webSearchInput} />
            {q ? <Pressable onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable> : null}
          </View>
          {/* Заголовок (сортировка/чипы) вне FlatList: иначе выпадашка сортировки уходит под карточки */}
          <View style={{ paddingHorizontal: spacing(5), zIndex: 30 }}>{listHeader}</View>
          {productList}
        </View>
        <CartPanel items={cartItems} width={CART} onCheckout={() => navigation.navigate('Корзина')} />
      </View>
    );
  }

  // ── МОБИЛЬНЫЙ ──
  const cartTotalKg = cartItems.reduce((s, i) => s + i.weightKg, 0);
  const cartTotal = cartItems.reduce((s, i) => s + (i.weightKg / 1000) * i.pricePerTon, 0);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={st.mobHeader}>
        <Image source={require('../../assets/blacklogo.png')} style={st.mobLogo} resizeMode="contain" />
        <Pressable onPress={() => navigation.navigate('Корзина')} style={st.mobCart}>
          <Ionicons name="cart-outline" size={24} color={colors.text} />
          {cartItems.length ? <View style={st.mobCartBadge}><Text style={st.mobCartBadgeText}>{cartItems.length}</Text></View> : null}
        </Pressable>
      </View>

      <View style={st.mobSearchRow}>
        <View style={st.mobSearch}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Поиск по каталогу" placeholderTextColor={colors.textMuted} style={st.mobSearchInput} />
        </View>
        <Pressable style={st.mobIconBtn} onPress={() => setShowFilters(true)}>
          <Ionicons name="options-outline" size={20} color={colors.text} />
          {activeFilterCount ? <View style={st.mobIconBadge}><Text style={st.ctrlBadgeText}>{activeFilterCount}</Text></View> : null}
        </Pressable>
        <Pressable style={st.mobIconBtn} onPress={() => setShowSort(true)}>
          <Ionicons name="swap-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>

      {productList}

      {/* Липкая мини-корзина */}
      {cartItems.length ? (
        <Pressable style={st.stickyCart} onPress={() => navigation.navigate('Корзина')}>
          <View style={st.stickyCartIcon}>
            <Ionicons name="cart" size={20} color="#fff" />
            <View style={st.stickyBadge}><Text style={st.mobCartBadgeText}>{cartItems.length}</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.stickyText}>{cartItems.length} товара · {(cartTotalKg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} т · {formatMoney(cartTotal)} ₽</Text>
            <Text style={st.stickySub}>без НДС</Text>
          </View>
          <View style={st.stickyBtn}><Text style={st.stickyBtnText}>Оформить</Text></View>
        </Pressable>
      ) : null}

      {/* Модалка фильтров */}
      <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
        <View style={st.sheetOverlay}>
          <View style={st.sheet}>
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>Фильтры</Text>
              <Pressable onPress={() => setShowFilters(false)}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing(4) }}>{filterPanel}</ScrollView>
            <View style={st.sheetFoot}>
              <Pressable style={st.sheetReset} onPress={resetAll}><Text style={st.resetLink}>Сбросить</Text></Pressable>
              <Pressable style={st.sheetApply} onPress={() => setShowFilters(false)}><Text style={st.sheetApplyText}>Показать {filtered.length}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модалка сортировки */}
      <Modal visible={showSort} animationType="fade" transparent onRequestClose={() => setShowSort(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowSort(false)}>
          <View style={st.sortSheet}>
            <Text style={st.sheetTitle}>Сортировка</Text>
            {SORTS.map((s) => (
              <Pressable key={s.key} style={st.sortOption} onPress={() => { setSort(s.key); setShowSort(false); }}>
                <Text style={[st.sortOptionText, sort === s.key && { color: colors.primary, fontWeight: '700' }]}>{s.label}</Text>
                {sort === s.key ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ───────────────────────── под-компоненты ─────────────────────────

function Chip({ label, color, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, { borderColor: color }, active && { backgroundColor: color }]}>
      <Text style={[st.chipText, { color: active ? '#fff' : color }]}>{label}</Text>
    </Pressable>
  );
}

function CheckRow({ label, count, checked, onPress, color }) {
  return (
    <Pressable style={st.checkRow} onPress={onPress}>
      <View style={[st.checkbox, checked && { backgroundColor: color || colors.primary, borderColor: color || colors.primary }]}>
        {checked ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
      </View>
      <Text style={st.checkLabel} numberOfLines={1}>{label}</Text>
      {count != null ? <Text style={st.checkCount}>{count}</Text> : null}
    </Pressable>
  );
}

function RangeRow({ title, suffix, from, to, setFrom, setTo, fromPh = '0', toPh = '∞' }) {
  return (
    <View style={{ marginBottom: spacing(4) }}>
      <Text style={st.filterTitle}>{title}{suffix ? `, ${suffix}` : ''}</Text>
      <View style={st.rangeField}>
        <Text style={st.rangeLabel}>от</Text>
        <TextInput style={st.rangeInputFull} value={from} onChangeText={setFrom} keyboardType="numeric" placeholder={fromPh} placeholderTextColor={colors.textMuted} />
      </View>
      <View style={st.rangeField}>
        <Text style={st.rangeLabel}>до</Text>
        <TextInput style={st.rangeInputFull} value={to} onChangeText={setTo} keyboardType="numeric" placeholder={toPh} placeholderTextColor={colors.textMuted} />
      </View>
    </View>
  );
}

function FilterContent({ tags, selectedTags, toggleTag, range, setR, resetAll }) {
  return (
    <View>
      <View style={st.filterHead}>
        <Text style={st.filterHeadTitle}>Фильтры</Text>
        <Pressable onPress={resetAll}><Text style={st.resetLink}>Сбросить</Text></Pressable>
      </View>

      <Text style={st.filterTitle}>Применение</Text>
      <View style={{ marginBottom: spacing(4) }}>
        {tags.map((t) => (
          <CheckRow key={t.slug} label={t.name} count={t.productCount} color={t.color} checked={selectedTags.has(t.slug)} onPress={() => toggleTag(t.slug)} />
        ))}
      </View>

      <RangeRow title="Цена" suffix="₽/кг" from={range.priceFrom} to={range.priceTo} setFrom={setR('priceFrom')} setTo={setR('priceTo')} />
      <RangeRow title="Твёрдость (Шор А)" from={range.shoreFrom} to={range.shoreTo} setFrom={setR('shoreFrom')} setTo={setR('shoreTo')} fromPh="40" toPh="95" />
      <View style={{ marginBottom: spacing(2) }}>
        <Text style={st.filterTitle}>Морозостойкость</Text>
        <Text style={st.filterHint}>Температура хрупкости не теплее, °C</Text>
        <TextInput style={[st.rangeInput, { width: 120 }]} value={range.brittleTo} onChangeText={setR('brittleTo')} keyboardType="numeric" placeholder="напр. 50" placeholderTextColor={colors.textMuted} />
      </View>
    </View>
  );
}

function SortControl({ value, onChange, onOpenModal, isWeb }) {
  const [open, setOpen] = useState(false);
  const current = SORTS.find((s) => s.key === value);
  if (!isWeb) {
    return (
      <Pressable style={st.sortBtn} onPress={onOpenModal}>
        <Text style={st.sortBtnText}>{current?.label}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.text} />
      </Pressable>
    );
  }
  return (
    <View style={{ zIndex: 30 }}>
      <Pressable style={st.sortBtn} onPress={() => setOpen((o) => !o)}>
        <Text style={st.sortBtnLabel}>Сортировка:</Text>
        <Text style={st.sortBtnText}>{current?.label}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.text} />
      </Pressable>
      {open ? (
        <View style={st.sortDropdown}>
          {SORTS.map((s) => (
            <Pressable key={s.key} style={st.sortOption} onPress={() => { onChange(s.key); setOpen(false); }}>
              <Text style={[st.sortOptionText, value === s.key && { color: colors.primary, fontWeight: '700' }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Characteristics({ product, layout }) {
  const full = layout === 'rowFull';
  const c = [
    ['Шор A', product.shoreHardnessA ?? '—'],
    [full ? 'Хрупкость' : 'Темп. хрупкости', product.brittlenessTemp != null ? `${product.brittlenessTemp}°C` : '—'],
    ['ПТР', product.meltFlowIndex ?? '—'],
    ['Плотность', product.density != null ? `${product.density} г/см³` : '—'],
  ];
  return (
    <View style={full ? st.charsRowFull : st.charsRow}>
      {c.map(([k, v]) => (
        <View key={k} style={st.charItem}>
          <Text style={st.charKey} numberOfLines={1}>{k}</Text>
          <Text style={st.charVal} numberOfLines={1}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function ListCard({ product, qty, setQty, onAdd, onOpen, onSample, isWeb }) {
  // ── ВЕБ: фото во всю высоту, инфо (название/арт → применение → характеристики), цена справа, действия в ряд ──
  if (isWeb) {
    return (
      <View style={[st.listCard, shadow]}>
        <Pressable onPress={onOpen} style={st.listImageWrap}>
          <Image source={{ uri: api.fileUrl(product.imageUrl) }} style={st.listImage} resizeMode="cover" />
        </Pressable>
        <View style={st.listBody}>
          <View style={st.listInfoRow}>
            <View style={{ flex: 1 }}>
              <Pressable onPress={onOpen}>
                <Text style={st.cardName} numberOfLines={2}>{product.name}</Text>
                <Text style={st.cardArticle}>арт. {product.article}</Text>
              </Pressable>
              {product.tags[0] ? (
                <Badge text={product.tags[0].name} bg={(product.tags[0].color || colors.primary) + '22'} fg={product.tags[0].color || colors.primary} style={{ marginTop: spacing(2), marginBottom: spacing(2) }} />
              ) : null}
              <Characteristics product={product} />
            </View>
            <View style={st.listPriceBlock}>
              <View style={st.inStock}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={st.inStockText}>В наличии</Text></View>
              <Text style={st.price}>{formatMoney(product.pricePerKg)} ₽<Text style={st.perKg}>/кг</Text></Text>
              <Text style={st.vat}>с НДС</Text>
            </View>
          </View>
          <View style={st.listActions}>
            <Stepper value={qty} onChange={setQty} step={50} compact />
            <Pressable style={[st.addBtn, { width: 168 }]} onPress={onAdd}>
              <Ionicons name="cart-outline" size={16} color="#fff" />
              <Text style={st.addBtnText}>В заказ</Text>
            </Pressable>
            <Pressable style={[st.sampleBtn, { width: 168 }]} onPress={onSample}>
              <Ionicons name="flask-outline" size={15} color={colors.primary} />
              <Text style={st.sampleBtnText}>Запросить образец</Text>
            </Pressable>
            <Pressable style={st.detailBtn} onPress={onOpen}>
              <Text style={st.detailBtnText}>Подробнее</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── МОБИЛЬНЫЙ: стопка (фото+инфо, затем цена и кнопки) ──
  return (
    <View style={[st.mCard, shadow]}>
      <View style={st.mTop}>
        <Pressable onPress={onOpen}>
          <Image source={{ uri: api.fileUrl(product.imageUrl) }} style={st.mImage} resizeMode="cover" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={st.mNameRow}>
            <Pressable style={{ flex: 1 }} onPress={onOpen}>
              <Text style={st.cardName} numberOfLines={2}>{product.name}</Text>
              <Text style={st.cardArticle}>арт. {product.article}</Text>
            </Pressable>
            <View style={st.inStock}><Ionicons name="checkmark-circle" size={13} color={colors.success} /><Text style={st.inStockText}>В наличии</Text></View>
          </View>
          {product.tags[0] ? (
            <Badge text={product.tags[0].name} bg={(product.tags[0].color || colors.primary) + '22'} fg={product.tags[0].color || colors.primary} style={{ marginTop: spacing(2), alignSelf: 'flex-start' }} />
          ) : null}
        </View>
      </View>
      <Characteristics product={product} layout="rowFull" />
      <View style={st.mDivider} />
      <View style={st.mBottom}>
        <View>
          <Text style={st.price}>{formatMoney(product.pricePerKg)} ₽<Text style={st.perKg}>/кг</Text></Text>
          <Text style={st.vat}>с НДС</Text>
        </View>
        <Stepper value={qty} onChange={setQty} step={50} compact />
      </View>
      <View style={st.mBtnRow}>
        <Pressable style={[st.addBtn, st.mActionBtn, { flex: 1 }]} onPress={onAdd}>
          <Ionicons name="cart-outline" size={16} color="#fff" />
          <Text style={st.addBtnText}>В заказ</Text>
        </Pressable>
        <Pressable style={[st.sampleBtn, st.mActionBtn, { flex: 1 }]} onPress={onSample}>
          <Ionicons name="flask-outline" size={15} color={colors.primary} />
          <Text style={st.sampleBtnText}>Запросить образец</Text>
        </Pressable>
      </View>
    </View>
  );
}

function GridCard({ product, qty, setQty, onAdd, onOpen, cardWidth }) {
  return (
    <View style={[st.gridCard, shadow, { width: cardWidth }]}>
      <Pressable onPress={onOpen}>
        <Image source={{ uri: api.fileUrl(product.imageUrl) }} style={st.gridImage} resizeMode="cover" />
        <Text style={st.cardName} numberOfLines={2}>{product.name}</Text>
        <Text style={st.cardArticle}>арт. {product.article}</Text>
      </Pressable>
      <Text style={[st.price, { marginTop: spacing(2) }]}>{formatMoney(product.pricePerKg)} ₽<Text style={st.perKg}>/кг</Text></Text>
      <View style={{ marginTop: spacing(2), gap: spacing(2) }}>
        <Stepper value={qty} onChange={setQty} step={50} compact />
        <Pressable style={st.addBtn} onPress={onAdd}>
          <Ionicons name="cart-outline" size={16} color="#fff" />
          <Text style={st.addBtnText}>В заказ</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CartPanel({ items, onCheckout, width }) {
  const totalKg = items.reduce((s, i) => s + i.weightKg, 0);
  const subtotal = items.reduce((s, i) => s + (i.weightKg / 1000) * i.pricePerTon, 0);
  const total = subtotal * 1.22;
  return (
    <View style={[st.cartPanel, { width }]}>
      <View style={st.cartHead}>
        <Text style={st.cartTitle}>Ваш заказ</Text>
        <Text style={st.cartCount}>{items.length} товаров · {(totalKg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} т</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(3) }}>
        {items.length === 0 ? (
          <Text style={st.cartEmpty}>Добавьте марки из каталога — они появятся здесь.</Text>
        ) : items.map((i) => (
          <View key={i.productId} style={st.cartItem}>
            <Image source={{ uri: api.fileUrl(i.imageUrl) }} style={st.cartItemImg} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={st.cartItemName} numberOfLines={1}>{i.name}</Text>
              <Text style={st.cartItemMeta}>{i.article ? `арт. ${i.article} · ` : ''}{i.weightKg} кг × {formatMoney(i.pricePerKg)} ₽</Text>
              <Text style={st.cartItemTotal}>{formatMoney((i.weightKg / 1000) * i.pricePerTon)} ₽</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={st.cartFoot}>
        <View style={st.cartTotalRow}><Text style={st.cartTotalLabel}>Итого</Text><Text style={st.cartTotalValue}>{formatMoney(total)} ₽</Text></View>
        <Text style={st.cartTotalSub}>с НДС · {(totalKg / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} т</Text>
        <Pressable style={[st.checkoutBtn, !items.length && { opacity: 0.5 }]} disabled={!items.length} onPress={onCheckout}>
          <Text style={st.checkoutBtnText}>Перейти к оформлению</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  // веб-каркас
  webRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  webSidebar: { backgroundColor: colors.card, borderRightWidth: 1, borderRightColor: colors.border },
  webSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: 46, paddingHorizontal: spacing(4), marginHorizontal: spacing(5), marginTop: spacing(4) },
  webSearchInput: { flex: 1, fontSize: 15, color: colors.text, outlineStyle: 'none' },
  catalogBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing(2.5), paddingHorizontal: spacing(3), marginBottom: spacing(4) },
  catalogText: { color: '#fff', fontWeight: '600', flex: 1, fontSize: 13 },

  breadcrumb: { color: colors.textMuted, fontSize: 12, marginBottom: spacing(2) },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing(2) },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  titleCount: { fontSize: 15, fontWeight: '500', color: colors.textMuted },
  titleControls: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  viewToggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  viewBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  viewBtnActive: { backgroundColor: colors.primary },

  chip: { paddingHorizontal: spacing(3), paddingVertical: spacing(2), borderRadius: radius.pill, borderWidth: 1, backgroundColor: '#fff' },
  chipText: { fontSize: 12.5, fontWeight: '600' },

  activeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing(2), paddingVertical: spacing(2) },
  activeLabel: { color: colors.textMuted, fontSize: 13 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingVertical: spacing(1), paddingHorizontal: spacing(2.5) },
  activeChipText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600' },
  resetLink: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  // фильтры
  filterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(3) },
  filterHeadTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  filterTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing(2) },
  filterHint: { fontSize: 11, color: colors.textMuted, marginBottom: spacing(2) },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(1.5), gap: spacing(2) },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontSize: 13, color: colors.text },
  checkCount: { fontSize: 12, color: colors.textMuted },
  rangeInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2), fontSize: 14, color: colors.text, backgroundColor: '#fff', outlineStyle: 'none' },
  rangeField: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(2) },
  rangeLabel: { width: 22, color: colors.textMuted, fontSize: 13 },
  rangeInputFull: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), fontSize: 14, color: colors.text, backgroundColor: '#fff', outlineStyle: 'none' },

  // сортировка
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing(3), height: 38, backgroundColor: '#fff' },
  sortBtnLabel: { color: colors.textMuted, fontSize: 13 },
  sortBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sortDropdown: { position: 'absolute', top: 44, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing(1), minWidth: 200, ...shadow, elevation: 10, zIndex: 40 },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing(2.5), paddingHorizontal: spacing(3) },
  sortOptionText: { fontSize: 14, color: colors.text },

  // карточка — список
  listCard: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing(3), marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(3), minHeight: 150 },
  listImageWrap: { width: 174, height: 174, alignSelf: 'flex-start' },
  listImage: { width: 174, height: 174, borderRadius: radius.md, backgroundColor: '#eef1ee' },
  listBody: { flex: 1, minWidth: 0, justifyContent: 'space-between', gap: spacing(3) },
  listInfoRow: { flexDirection: 'row', gap: spacing(3) },
  listPriceBlock: { width: 150, alignItems: 'flex-end', gap: 2 },
  listActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing(2.5) },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto', paddingVertical: spacing(2), paddingHorizontal: spacing(2.5) },
  detailBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardArticle: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 1 },
  charsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3), marginTop: spacing(2) },
  charsRowFull: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing(2), marginTop: spacing(3) },
  charItem: {},
  charKey: { fontSize: 10.5, color: colors.textMuted },
  charVal: { fontSize: 13, fontWeight: '600', color: colors.text },
  inStock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inStockText: { color: colors.success, fontSize: 12, fontWeight: '600' },
  price: { fontSize: 18, fontWeight: '700', color: colors.text },
  perKg: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  vat: { fontSize: 11, color: colors.textMuted, marginTop: -2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(2), backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing(2.5), paddingHorizontal: spacing(3) },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sampleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(1.5), borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: spacing(2.5), paddingHorizontal: spacing(2) },
  sampleBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  // карточка — мобильная (стопка)
  mCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing(3.5), marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border },
  mTop: { flexDirection: 'row', gap: spacing(3) },
  mImage: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: '#eef1ee' },
  mNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  mDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(3) },
  mBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(2.5) },
  mBtnRow: { flexDirection: 'row', gap: spacing(2.5), marginTop: spacing(3) },
  mActionBtn: { height: 38, paddingVertical: 0 },

  // карточка — сетка
  gridCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing(3), marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border },
  gridImage: { width: '100%', height: 130, borderRadius: radius.md, backgroundColor: '#eef1ee', marginBottom: spacing(2) },

  // корзина (веб)
  cartPanel: { backgroundColor: colors.card, borderLeftWidth: 1, borderLeftColor: colors.border },
  cartHead: { padding: spacing(4), borderBottomWidth: 1, borderBottomColor: colors.border },
  cartTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cartCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cartEmpty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing(6) },
  cartItem: { flexDirection: 'row', gap: spacing(2.5), paddingVertical: spacing(2.5), borderBottomWidth: 1, borderBottomColor: colors.border },
  cartItemImg: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: '#eef1ee' },
  cartItemName: { fontSize: 13, fontWeight: '600', color: colors.text },
  cartItemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  cartItemTotal: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 },
  cartFoot: { padding: spacing(4), borderTopWidth: 1, borderTopColor: colors.border },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartTotalLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  cartTotalValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  cartTotalSub: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(3) },
  checkoutBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing(3.5), alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // мобильный
  mobHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing(4), paddingTop: spacing(2), paddingBottom: spacing(2), backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  mobLogo: { width: 150, height: 30 },
  mobCart: { padding: spacing(1) },
  mobCartBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: colors.primary, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  mobCartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  mobSearchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingHorizontal: spacing(4), marginTop: spacing(3) },
  mobSearch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing(2), backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing(3.5), height: 44 },
  mobSearchInput: { flex: 1, fontSize: 15, color: colors.text, outlineStyle: 'none' },
  mobIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: '#fff' },
  mobIconBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: colors.primary, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  mobControls: { flexDirection: 'row', gap: spacing(3), paddingHorizontal: spacing(4), paddingTop: spacing(3) },
  mobCtrlBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing(3.5), paddingVertical: spacing(2.5), backgroundColor: '#fff' },
  mobCtrlText: { fontSize: 13, fontWeight: '600', color: colors.text },
  ctrlBadge: { backgroundColor: colors.primary, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ctrlBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  stickyCart: { position: 'absolute', left: spacing(3), right: spacing(3), bottom: spacing(3), flexDirection: 'row', alignItems: 'center', gap: spacing(3), backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing(3), borderWidth: 1, borderColor: colors.border, ...shadow, elevation: 8 },
  stickyCartIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stickyBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: colors.primaryDark, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  stickyText: { fontSize: 13, fontWeight: '700', color: colors.text },
  stickySub: { fontSize: 11, color: colors.textMuted },
  stickyBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing(4), paddingVertical: spacing(2.5) },
  stickyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // модалки
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '85%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing(4), borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetFoot: { flexDirection: 'row', gap: spacing(3), padding: spacing(4), borderTopWidth: 1, borderTopColor: colors.border },
  sheetReset: { paddingVertical: spacing(3), paddingHorizontal: spacing(4), justifyContent: 'center' },
  sheetApply: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(3.5) },
  sheetApplyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sortSheet: { backgroundColor: '#fff', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing(4) },
});
