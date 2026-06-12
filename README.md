# AI-Driven Sales Meeting Follow-Up Scheduler

Aplicação TypeScript full-stack que substitui o fluxo n8n por um backend modular com painel de aprovação:

1. roda todos os dias às 06:00;
2. busca reuniões comerciais encerradas entre 2 e 4 dias atrás;
3. ignora reuniões já processadas;
4. verifica no Gmail se houve contato com o participante depois da reunião;
5. sugere slots futuros parecidos com a reunião original;
6. envia um email para aprovação humana;
7. cria o evento no Google Calendar apenas quando aprovado.

## Rodando em desenvolvimento

```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

Configure as credenciais OAuth do Google com escopos para Calendar e Gmail, além da chave da OpenAI.

Em outro terminal, rode o frontend:

```bash
npm run dev:web
```

O painel abre em `http://localhost:5173`.

## Banco de dados

O projeto usa Prisma com SQLite local por padrão:

```env
DATABASE_URL=file:./dev.db
```

Para desenvolvimento local, o backend também cria as tabelas SQLite automaticamente se elas ainda não existirem. Em produção, o mesmo desenho pode ser migrado para PostgreSQL trocando o datasource do Prisma.

## Endpoints

- `GET /health`: status da aplicação.
- `GET /approvals`: lista aprovações e histórico.
- `GET /approvals/:id`: detalhes de uma aprovação.
- `POST /jobs/follow-ups/run`: executa a rotina manualmente.
- `POST /approvals/:id/respond`: aprova ou recusa uma sugestão.

Exemplo:

```json
{
  "decision": "approve",
  "slotStart": "2026-06-15T10:00:00-03:00"
}
```
