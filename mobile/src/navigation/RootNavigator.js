import { useState, useCallback } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useChat } from '../context/ChatContext';
import { colors } from '../theme';
import { Loader } from '../components/ui';
import { TopBar } from './TopBar';
import AppHeader from './AppHeader';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import CatalogScreen from '../screens/CatalogScreen';
import ProductScreen from '../screens/ProductScreen';
import CartScreen from '../screens/CartScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderScreen from '../screens/OrderScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ComplaintScreen from '../screens/ComplaintScreen';
import PricesScreen from '../screens/manager/PricesScreen';
import SamplesScreen from '../screens/manager/SamplesScreen';
import ChatInboxScreen from '../screens/manager/ChatInboxScreen';
import ManagerChatScreen from '../screens/manager/ManagerChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ВАЖНО: опцию `header` React Navigation вызывает как функцию (инлайня её хуки в родителя).
// Оборачиваем в JSX-элемент, чтобы AppHeader был полноценным компонентом со своим контекстом
// хуков — иначе его условный рендер ломает порядок хуков NativeStackView (пустой экран).
const renderAppHeader = (props) => <AppHeader {...props} />;

const screenOpts = {
  headerStyle: { backgroundColor: colors.primaryDark },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

// Все стеки используют общий AppHeader (зелёная шапка с условной кнопкой «Назад»).
// AppHeader сам скрывается на широком вебе (там «Назад» в TopBar).
function CatalogStack() {
  return (
    <Stack.Navigator screenOptions={{ header: renderAppHeader }}>
      <Stack.Screen name="Catalog" component={CatalogScreen} options={{ title: 'Каталог', headerShown: false }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Карточка продукции' }} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ header: renderAppHeader }}>
      <Stack.Screen name="OrdersList" component={OrdersScreen} options={{ title: 'Заказы' }} />
      <Stack.Screen name="Order" component={OrderScreen} options={{ title: 'Заказ' }} />
      <Stack.Screen name="Complaint" component={ComplaintScreen} options={{ title: 'Рекламация' }} />
    </Stack.Navigator>
  );
}

function CartStack() {
  return (
    <Stack.Navigator screenOptions={{ header: renderAppHeader }}>
      <Stack.Screen name="CartMain" component={CartScreen} options={{ title: 'Оформление заказа' }} />
    </Stack.Navigator>
  );
}

function ManagerChatStack() {
  return (
    <Stack.Navigator screenOptions={{ header: renderAppHeader }}>
      <Stack.Screen name="ChatInbox" component={ChatInboxScreen} options={{ title: 'Обращения' }} />
      <Stack.Screen name="ChatSession" component={ManagerChatScreen} options={({ route }) => ({ title: route.params?.title || 'Диалог' })} />
    </Stack.Navigator>
  );
}

const tabIcon = (name) => ({ color }) => <Ionicons name={name} size={21} color={color} />;

// Высоту и нижний отступ таб-бара увеличиваем на нижнюю безопасную зону
// (home indicator на iPhone / системная панель) — иначе подписи обрезаются снизу.
const tabBarOpts = (hide, insets) => {
  const bottom = insets?.bottom || 0;
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: hide ? { display: 'none' } : { height: 76 + bottom, paddingBottom: 12 + bottom, paddingTop: 8 },
    tabBarLabelStyle: { fontSize: 11, lineHeight: 14, marginTop: 0 },
  };
};

// Списки пунктов для верхней панели (веб)
export const CLIENT_NAV = [
  { name: 'Каталог', icon: 'grid-outline', label: 'Каталог' },
  { name: 'Заказы', icon: 'cube-outline', label: 'Заказы' },
  { name: 'Помощник', icon: 'chatbubbles-outline', label: 'Помощник' },
  { name: 'Корзина', icon: 'cart-outline', label: 'Корзина' },
  { name: 'Профиль', icon: 'person-outline', label: 'Профиль' },
];
export const MANAGER_NAV = [
  { name: 'Заказы', icon: 'clipboard-outline', label: 'Заказы' },
  { name: 'Обращения', icon: 'chatbubbles-outline', label: 'Обращения' },
  { name: 'Образцы', icon: 'gift-outline', label: 'Образцы' },
  { name: 'Цены', icon: 'pricetags-outline', label: 'Цены' },
  { name: 'Каталог', icon: 'grid-outline', label: 'Каталог' },
  { name: 'Профиль', icon: 'person-outline', label: 'Профиль' },
];

// backBehavior="history": когда goBack() доходит до корня стека, он возвращает на
// предыдущую посещённую вкладку — это и даёт сквозной «Назад» между вкладками.
// Одиночные таб-экраны рисуют AppHeader (он сам скрывается на широком вебе).
function ClientTabs({ hideTabBar }) {
  const { count } = useCart();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator backBehavior="history" screenOptions={tabBarOpts(hideTabBar, insets)}>
      <Tab.Screen name="Каталог" component={CatalogStack} options={{ tabBarIcon: tabIcon('grid-outline') }} />
      <Tab.Screen name="Корзина" component={CartStack} options={{ tabBarIcon: tabIcon('cart-outline'), tabBarBadge: count || undefined }} />
      <Tab.Screen name="Заказы" component={OrdersStack} options={{ tabBarIcon: tabIcon('cube-outline') }} />
      <Tab.Screen name="Помощник" component={ChatScreen} options={{ tabBarIcon: tabIcon('chatbubbles-outline'), tabBarLabel: 'Помощник', headerShown: true, header: renderAppHeader, title: 'Помощник по подбору' }} />
      <Tab.Screen name="Профиль" component={ProfileScreen} options={{ tabBarIcon: tabIcon('person-outline'), headerShown: true, header: renderAppHeader }} />
    </Tab.Navigator>
  );
}

function ManagerTabs({ hideTabBar }) {
  const { unanswered = 0 } = useChat() || {};
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator backBehavior="history" screenOptions={tabBarOpts(hideTabBar, insets)}>
      <Tab.Screen name="Заказы" component={OrdersStack} options={{ tabBarIcon: tabIcon('clipboard-outline') }} />
      <Tab.Screen name="Обращения" component={ManagerChatStack} options={{ tabBarIcon: tabIcon('chatbubbles-outline'), tabBarBadge: unanswered || undefined }} />
      <Tab.Screen name="Образцы" component={SamplesScreen} options={{ tabBarIcon: tabIcon('gift-outline'), headerShown: true, header: renderAppHeader }} />
      <Tab.Screen name="Цены" component={PricesScreen} options={{ tabBarIcon: tabIcon('pricetags-outline'), headerShown: true, header: renderAppHeader, title: 'Цены' }} />
      <Tab.Screen name="Каталог" component={CatalogStack} options={{ tabBarIcon: tabIcon('grid-outline') }} />
      <Tab.Screen name="Профиль" component={ProfileScreen} options={{ tabBarIcon: tabIcon('person-outline'), headerShown: true, header: renderAppHeader }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Регистрация' }} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, booting, isManager } = useAuth();
  const { width } = useWindowDimensions();
  const navRef = useNavigationContainerRef();
  const [activeTab, setActiveTab] = useState('Каталог');
  const [canBack, setCanBack] = useState(false);

  const webWide = Platform.OS === 'web' && width >= 1024;

  const syncActive = useCallback(() => {
    const root = navRef.getRootState?.();
    if (root && root.routes && root.index != null) setActiveTab(root.routes[root.index].name);
    setCanBack(navRef.isReady?.() ? navRef.canGoBack() : false);
  }, [navRef]);

  if (booting) return <Loader text="Загрузка…" />;

  const navItems = isManager ? MANAGER_NAV : CLIENT_NAV;
  const Tabs = isManager ? ManagerTabs : ClientTabs;

  return (
    <NavigationContainer ref={navRef} onStateChange={syncActive} onReady={syncActive}>
      {!user ? (
        <AuthStack />
      ) : webWide ? (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <TopBar
            items={navItems}
            active={activeTab}
            canBack={canBack}
            onBack={() => navRef.goBack()}
            onNavigate={(name) => {
              // Клик по логотипу/«Каталог» — всегда на главный список каталога
              if (name === 'Каталог') navRef.navigate('Каталог', { screen: 'Catalog' });
              else navRef.navigate(name);
            }}
          />
          <Tabs hideTabBar />
        </View>
      ) : (
        <Tabs />
      )}
    </NavigationContainer>
  );
}
