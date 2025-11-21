# 📝 Como Substituir as URLs dos Vídeos nos Comandos de Interação

Os comandos de interação com GIF foram criados com URLs de exemplo. Para que funcionem corretamente, você precisa substituir essas URLs pelos links reais dos seus vídeos MP4.

## 🎯 Arquivos que Precisam de Atualização

Cada arquivo abaixo contém uma linha com `// SUBSTITUIR PELA URL REAL`:

1. **tapa.js** - Linha 28: `const videoUrl = 'https://example.com/tapa.mp4';`
2. **tiro.js** - Linha 28: `const videoUrl = 'https://example.com/tiro.mp4';`
3. **reviver.js** - Linha 28: `const videoUrl = 'https://example.com/reviver.mp4';`
4. **emote.js** - Linha 13: `const videoUrl = 'https://example.com/emote.mp4';`
5. **rir.js** - Linha 13: `const videoUrl = 'https://example.com/rir.mp4';`
6. **chorar.js** - Linha 13: `const videoUrl = 'https://example.com/chorar.mp4';`
7. **f.js** - Linha 28: `const videoUrl = 'https://example.com/f.mp4';`

## 📋 Instruções

### Opção 1: URLs Diretas (Recomendado)
Se você tiver os vídeos hospedados em algum lugar:

1. Faça upload dos vídeos MP4 para um servidor (pode ser Google Drive, Dropbox, servidor próprio, etc.)
2. Obtenha o link direto do vídeo
3. Substitua a URL de exemplo pela URL real em cada arquivo

**Exemplo:**
```javascript
// Antes
const videoUrl = 'https://example.com/tapa.mp4';

// Depois
const videoUrl = 'https://meusvideos.com/tapa.mp4';
```

### Opção 2: Usar API de GIFs (Avançado)
Se preferir usar GIFs de serviços como Tenor ou Giphy:

1. Cadastre-se na API do serviço escolhido
2. Modifique os comandos para fazer requisições à API
3. A API retornará URLs de GIFs/vídeos relacionados

### Opção 3: Armazenamento Local
Se quiser usar vídeos locais:

1. Coloque os vídeos em uma pasta no projeto (ex: `assets/videos/`)
2. Use Buffer.from para ler o arquivo localmente
3. Modifique o envio para usar `video: fs.readFileSync('./assets/videos/tapa.mp4')`

## ⚠️ Requisitos dos Vídeos

Para melhor performance:
- **Formato:** MP4
- **Tamanho:** Menor que 5MB (ideal < 2MB)
- **Duração:** 2-5 segundos
- **Qualidade:** 480p ou 720p no máximo

## 🔄 Reiniciar o Bot

Após fazer as substituições, reinicie o bot para carregar os novos comandos:
```
!reiniciar
```

Ou pare e inicie novamente pelo terminal:
```bash
npm start
```

## 🎮 Testando os Comandos

Depois de configurar as URLs, teste cada comando:

### Comandos com menção:
- `!tapa @usuario`
- `!tiro @usuario`
- `!reviver @usuario`
- `!f @usuario`

### Comandos sem menção:
- `!emote`
- `!rir`
- `!chorar`
