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
};

export const TTL = {
  PAUSA_HUMANO: 300,    // 5 minutos
  SESSAO_ATIVA: 1800,   // 30 minutos
  AI_BUSY: 60,          // 1 minuto
};
