# Refatoração do MessageHandler

A refatoração do `handlers/messageHandler.js` foi concluída com sucesso, transformando o antigo manipulador monolítico em uma arquitetura de pipeline modular.

## Nova Arquitetura

O processamento de mensagens agora segue um fluxo linear através de middlewares, onde cada etapa tem uma responsabilidade única.

### Estrutura de Diretórios

```
/handlers
  ├── messageHandler.js      # Orquestrador do pipeline
  ├── middlewares/           # Camadas de processamento
  │   ├── 01_normalizer.js
  │   ├── 01b_system.js
  │   ├── 01c_userLoader.js  # [NOVO] Carrega/Cria usuário e atualiza histórico
  │   ├── 02_deduplicator.js
  │   ├── 02b_botStatus.js
  │   ├── 02c_sales.js
  │   ├── 03_moderation.js
  │   ├── 04_interactiveSession.js
  │   ├── 05_commandParser.js
  │   ├── 05b_triggers.js
  │   └── 06_aiHandler.js
  └── services/
      ├── commandExecutor.js  # Execução centralizada de comandos
      └── sessionManager.js   # Gerenciamento de estado (Maps)
```

### Componentes

1.  **SessionManager (`handlers/services/sessionManager.js`)**:
    *   Centraliza todos os `Map`s de estado (jogos, sessões interativas, etc.).
    *   Exporta os mapas e funções auxiliares.
    *   Mantém compatibilidade com comandos existentes injetando os mapas no contexto.

2.  **CommandExecutor (`handlers/services/commandExecutor.js`)**:
    *   Padroniza a execução de comandos.
    *   Realiza verificações de permissão, tratamento de erros (`try/catch`) e atualizações de presença (`composing`).

3.  **Middlewares**:
    *   **Normalizer**: Prepara os dados da mensagem (`senderJid`, `message`, etc.).
    *   **System**: Lida com comandos de sistema prioritários (`/reiniciar`).
    *   **UserLoader**: Carrega o usuário do banco de dados, cria se não existir e atualiza o histórico de interações. Essencial para que os comandos tenham acesso aos dados do usuário.
    *   **Deduplicator**: Evita processamento duplicado de mensagens.
    *   **BotStatus**: Verifica se o bot está ativo no grupo (ignora mensagens se estiver off, exceto `/on`).
    *   **Sales**: Registra vendas e fechamentos de caixa automaticamente.
    *   **Moderation**: Aplica regras de Anti-Mute, Anti-Link, Anti-Delete e Blacklist.
    *   **InteractiveSession**: Intercepta mensagens se o usuário estiver em um fluxo interativo (jogos, wizards).
    *   **CommandParser**: Identifica e executa comandos (por prefixo ou linguagem natural).
    *   **Triggers**: Processa auto-respostas e detecção de desistência de lista (se nenhum comando foi executado).
    *   **AIHandler**: Gera respostas com IA para mensagens privadas.

## Benefícios

*   **Modularidade**: Cada lógica está isolada em seu próprio arquivo.
*   **Manutenibilidade**: Fácil adicionar novas etapas ao pipeline sem risco de quebrar o fluxo principal.
*   **Testabilidade**: Middlewares podem ser testados individualmente.
*   **Compatibilidade**: A estrutura mantém compatibilidade com os comandos existentes, injetando as dependências necessárias no contexto de execução.

## Próximos Passos (Sugestões)

1.  **Migração para Banco de Dados**: Mover o estado do `sessionManager` (memória) para o banco de dados (SQLite/Postgres) para tornar o bot verdadeiramente *stateless*.
2.  **Padronização de Comandos**: Atualizar os comandos para usar uma interface mais limpa, sem depender da injeção de mapas brutos.
