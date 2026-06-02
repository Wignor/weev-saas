import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis_redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db: parseInt(process.env.REDIS_DB || '3'),
  lazyConnect: true,
});

export const KEYS = {
  atendimento: (number: string) => `atendimento.${number}`,
  aiBusy: (number: string) => `ai_busy.${number}`,
  chatHistory: (number: string) => `chat_history.${number}`,
  botBlock: (number: string) => `bot_block.${number}`,
  rateLimit: (number: string) => `rate.${number}`,
};

export const TTL = {
  PAUSA_HUMANO: 300,
  SESSAO_ATIVA: 1800,
  AI_BUSY: 60,
  CHAT_HISTORY: 172800, // 48h
  BOT_BLOCK: 86400,     // 24h
};
