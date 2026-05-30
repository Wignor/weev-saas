import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis_redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db: parseInt(process.env.REDIS_DB || '4'),
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

// Keys namespaced by tenantId + number
export const KEYS = {
  atendimento: (tid: string, n: string) => `t:${tid}:atendimento.${n}`,
  aiBusy:      (tid: string, n: string) => `t:${tid}:ai_busy.${n}`,
  sessaoAtiva: (tid: string, n: string) => `t:${tid}:sessao_ativa.${n}`,
};

export const TTL = {
  SESSAO_ATIVA:  86400,
  PAUSA_HUMANO:  300,
  AI_BUSY:       60,
};
