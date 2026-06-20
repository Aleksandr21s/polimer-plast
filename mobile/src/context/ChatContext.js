import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

// Счётчик неотвеченных обращений (эскалаций) — для бейджа у менеджера.
// Опрашивает сервер только когда вошёл менеджер.
export function ChatProvider({ children }) {
  const { isManager, user } = useAuth();
  const [unanswered, setUnanswered] = useState(0);

  const refresh = useCallback(async () => {
    if (!isManager) return;
    try {
      const data = await api.get('/chat/manager/escalations/count');
      setUnanswered(data?.unanswered || 0);
    } catch {}
  }, [isManager]);

  useEffect(() => {
    if (!isManager) { setUnanswered(0); return; }
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [isManager, user?.id, refresh]);

  return (
    <ChatContext.Provider value={{ unanswered, refresh }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
