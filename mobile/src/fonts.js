import { Text, TextInput, StyleSheet } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export const interMap = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };
export { useFonts };

// Числовая жирность → конкретное начертание Inter.
// Самые тяжёлые (800/900) сведены к Bold(700) — снижаем «перегруженность» заголовков.
const FAMILY = {
  100: 'Inter_400Regular', 200: 'Inter_400Regular', 300: 'Inter_400Regular',
  400: 'Inter_400Regular', normal: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold', 800: 'Inter_700Bold', 900: 'Inter_700Bold', bold: 'Inter_700Bold',
};

function familyFor(style) {
  const flat = StyleSheet.flatten(style) || {};
  const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  return FAMILY[w] || 'Inter_400Regular';
}

// Глобально подменяем шрифт на Inter, изменяя ВХОДНЫЕ props (style) до оригинального
// рендера. Так корректно работает и на нативе, и в react-native-web.
let patched = false;
function patchTextFont() {
  if (patched) return;
  patched = true;
  try {
    [Text, TextInput].forEach((Comp) => {
      const orig = Comp.render;
      if (typeof orig !== 'function') return;
      Comp.render = function interRender(props, ref) {
        try {
          const fam = familyFor(props && props.style);
          return orig.call(this, { ...props, style: [{ fontFamily: fam }, props && props.style] }, ref);
        } catch {
          return orig.call(this, props, ref);
        }
      };
    });
  } catch {
    /* в крайнем случае оставляем системный шрифт */
  }
}

patchTextFont();
