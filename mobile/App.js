import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { ChatProvider } from './src/context/ChatContext';
import RootNavigator from './src/navigation/RootNavigator';
import { useFonts, interMap } from './src/fonts';
import { colors } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts(interMap);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <ChatProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </ChatProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
