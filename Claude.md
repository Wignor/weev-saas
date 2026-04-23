# Weev SaaS

Dois modos de trabalho: (1) converter workflows n8n em aplicativos web completos, e (2) criar/atualizar workflows n8n do zero.

## Ambiente

| Camada | Tecnologia |
|--------|-----------|
| Automação | n8n Cloud |
| MCPs | n8n-mcp (czlonkowski/n8n-mcp), GitHub MCP |
| Skills | n8n suite, Frontend Designer |
| Frontend | Next.js (App Router), React, TypeScript |
| Deploy | Monorepo GitHub → Vercel (auto-sync por app) |

---

## Modo 1 — n8n Workflow → Web App

### Passo 1: Analisar o Workflow

- Inspecionar com `n8n_get_workflow` — identificar trigger e nós de saída
- Confirmar que existe nó **Webhook** como trigger e **Respond to Webhook** como saída
- Adicionar/ajustar esses nós se necessário (`n8n_update_partial_workflow`)
- Validar com `validate_workflow` e testar com `n8n_test_workflow`
- Confirmar que o workflow retorna JSON estruturado compatível com o frontend

### Passo 2: Construir o Frontend

- Usar a **skill Frontend Designer**
- Criar o app em `apps/<nome-do-app>/` no monorepo
- Comunicação: UI → API Route Next.js → n8n Webhook (URL nunca exposta ao cliente)
- Testar localmente com `npm run dev` antes de qualquer push

### Passo 3: Publicar

- Usar **GitHub MCP** para fazer push ao monorepo `weev-saas`
- Vercel detecta as mudanças e faz deploy automático
- Configurar `N8N_WEBHOOK_URL` como variável de ambiente no Vercel (por app)

---

## Padrão de Integração

```
Usuário → UI Next.js → /api/n8n (API Route) → n8n Webhook → Workflow → Resposta JSON → UI
```

Template da API Route:

```typescript
// apps/<nome>/app/api/n8n/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return Response.json(await res.json());
}
```

`.env.local` (nunca commitar):
```
N8N_WEBHOOK_URL=https://sua-instancia.n8n.cloud/webhook/...
```

---

## Estrutura do Monorepo

```
weev-saas/                  ← repositório GitHub
├── apps/
│   ├── app-um/             ← Next.js App Router
│   │   ├── app/
│   │   │   ├── api/n8n/route.ts
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── .env.local      ← ignorado pelo git
│   │   └── package.json
│   └── app-dois/
└── README.md
```

Vercel: configurar **Root Directory** como `apps/<nome-do-app>` para cada projeto.

---

## Modo 2 — Construção de Workflows n8n

### Processo

1. **Entender** — propósito, trigger, integrações, tratamento de erros
2. **Pesquisar** — `search_templates` → `get_template` para partir de um modelo
3. **Pesquisar nós** — `search_nodes` → `get_node` para configuração correta
4. **Construir** — começar pelo trigger, adicionar nós um a um, validar cada adição
5. **Validar** — `validate_workflow` antes de qualquer deploy
6. **Testar** — `n8n_test_workflow` com dados representativos

### Padrões Arquiteturais

| Padrão | Uso |
|--------|-----|
| Webhook Processing | Trigger externo → Processar → Responder |
| HTTP API Integration | Buscar dados → Transformar → Armazenar/Enviar |
| AI Workflow | Entrada → IA → Saída estruturada |
| Database Operations | Query → Processar → Atualizar |
| Scheduled Tasks | Cron → Processar em lote → Relatório |

---

## Referência MCP Tools

### n8n MCP

| Ferramenta | Uso |
|-----------|-----|
| `n8n_list_workflows` | Listar workflows existentes |
| `n8n_get_workflow` | Inspecionar workflow |
| `n8n_create_workflow` | Criar novo workflow |
| `n8n_update_workflow` | Atualizar workflow completo |
| `n8n_update_partial_workflow` | Atualizar nós específicos |
| `n8n_test_workflow` | Testar/disparar workflow |
| `n8n_list_executions` / `n8n_get_execution` | Histórico de execuções |
| `validate_workflow` | Validar antes de deploy |
| `search_nodes` / `get_node` | Pesquisar e configurar nós |
| `search_templates` / `get_template` | Encontrar templates |

### GitHub MCP

| Ferramenta | Uso |
|-----------|-----|
| `create_repository` | Criar repositório |
| `push_files` | Enviar arquivos ao repo |
| `create_or_update_file` | Atualizar arquivo individual |
| `get_file_contents` | Ler arquivo do repo |

---

## Skills

- **n8n suite**: expressões `{{}}`, padrões de workflow, configuração de nós, validação, código JS/Python
- **Frontend Designer**: UI/UX, componentes React, layouts responsivos, integração com APIs

---

## Regras de Segurança

- **NUNCA** expor `N8N_WEBHOOK_URL` no código cliente — sempre usar API Route como proxy
- **NUNCA** editar workflows de produção diretamente — testar antes com `n8n_test_workflow`
- **NUNCA** construir o frontend sem confirmar que o workflow retorna JSON correto
- **NUNCA** fazer push sem testar localmente com `npm run dev`
- **NUNCA** commitar `.env.local` — adicionar ao `.gitignore`
