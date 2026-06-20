import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4000',
  autoCancelHours: Number(process.env.ORDER_AUTOCANCEL_HOURS || 72),
  // Чат-бот: движок по умолчанию и параметры локальной LLM (Ollama)
  llmProvider: (process.env.LLM_PROVIDER || 'rules').toLowerCase(),
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5:14b',
};
