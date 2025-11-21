# IA Assistente Acessória JP

Este é um projeto base para uma IA de atendimento usando WhatsApp via Baileys e a API do Google Gemini.

## Pré-requisitos

- Node.js (versão 16 ou superior)
- Uma conta do Google AI Studio para obter a chave da API do Gemini
- Um dispositivo com WhatsApp para autenticação

## Instalação

1. Clone ou baixe este repositório.
2. Instale as dependências:
   ```
   npm install
   ```

## Configuração

1. Obtenha uma chave da API do Google Gemini em [Google AI Studio](https://makersuite.google.com/app/apikey).
2. Defina a variável de ambiente `GEMINI_API_KEY` com sua chave:
   - No Windows: `set GEMINI_API_KEY=sua_chave_aqui`
   - Ou edite diretamente no arquivo `index.js`, substituindo `'SUA_CHAVE_API_AQUI'`.

## Como usar

1. Execute o projeto:
   ```
   npm start
   ```

2. No terminal, será exibido um QR Code. Escaneie-o com o WhatsApp no seu dispositivo para autenticar.

3. Uma vez conectado, o bot responderá automaticamente às mensagens recebidas usando a IA do Gemini.

## Funcionalidades

- Conexão automática ao WhatsApp
- Reconexão em caso de desconexão
- Geração de respostas inteligentes usando Gemini
- Tratamento básico de erros

## Problemas Conhecidos e Soluções

- **Erro 405 Method Not Allowed**: Indica que o WhatsApp está bloqueando a conexão. Soluções possíveis:
  - Use uma VPN para contornar restrições geográficas.
  - Aguarde atualizações da biblioteca Baileys.
  - Considere usar a API oficial do WhatsApp Business (requer aprovação).
  - Tente executar em um servidor na nuvem (ex: Heroku, Railway).
- **QR Code não aparece**: Certifique-se de que o evento 'qr' está sendo capturado corretamente. O QR será exibido no console.
- **Problemas de autenticação**: Delete a pasta `auth_info_baileys` e tente novamente.
- **Versão desatualizada**: Execute `npm update` ou `npm install @whiskeysockets/baileys@latest` para a versão mais recente.

## Desenvolvimento

O código principal está em `index.js`. Você pode personalizar o prompt do Gemini ou adicionar mais funcionalidades conforme necessário.

## Licença

ISC
