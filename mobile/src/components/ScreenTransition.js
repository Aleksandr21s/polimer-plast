import { useRef, useCallback } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Лёгкое появление контента экрана при фокусе. Зачем: native-stack НЕ анимирует переходы
// на react-native-web (опция `animation` помечена iOS/Android-only — см. RootNavigator),
// поэтому на вебе переход Каталог → Карточка выглядел бы мгновенным. Здесь даём плавный
// fade + небольшой подъём через ВСТРОЕННЫЙ Animated, без новых зависимостей.
//
// Анимируем ТОЛЬКО на вебе: на телефоне работает нативный slide_from_right, дублировать
// не нужно (на нативе обёртка — обычный flex:1 View без анимации).
//
// Применяется только к «вложенным» (pushed) экранам стека. Корневые экраны вкладок не
// оборачиваем: там уже играет fade самих вкладок (bottom-tabs), иначе анимации наложатся.
const IS_WEB = Platform.OS === 'web';

export default function ScreenTransition({ children, style }) {
  const opacity = useRef(new Animated.Value(IS_WEB ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(IS_WEB ? 10 : 0)).current;

  useFocusEffect(
    useCallback(() => {
      if (!IS_WEB) return undefined;
      opacity.setValue(0);
      translateY.setValue(10);
      // useNativeDriver:false — на react-native-web нативного драйвера нет (иначе предупреждение);
      // opacity/transform анимируются через инлайн-стили покадрово, этого достаточно.
      const anim = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: false }),
        Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: false }),
      ]);
      anim.start();
      return () => anim.stop();
    }, [opacity, translateY])
  );

  return (
    <Animated.View style={[styles.fill, { opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
