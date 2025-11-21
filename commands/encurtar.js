const axios = require('axios');

async function execute({ sock, msg, args }) {
    const jid = msg.key.remoteJid;
    const url = args.join(' ').trim();

    if (!url) {
        return '🤖 *Como usar o comando encurtar:*\n\n- Digite `!encurtar https://exemplo.com` ou `!shorten https://exemplo.com`\n- O comando irá encurtar a URL fornecida usando TinyURL.';
    }

    // Validação básica de URL
    const urlRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
    if (!urlRegex.test(url)) {
        return '❌ URL inválida. Por favor, forneça uma URL válida começando com http:// ou https://';
    }

    try {
        const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        const shortUrl = response.data;

        await sock.sendMessage(jid, { text: `🔗 *URL Encurtada:*\n\n${shortUrl}` }, { quoted: msg });
    } catch (error) {
        console.error('Erro ao encurtar URL:', error);
        return '❌ Ocorreu um erro ao tentar encurtar a URL. Verifique se a URL é válida e tente novamente.';
    }
}

module.exports = {
    name: 'encurtar',
    aliases: ['shorten'],
    description: 'Encurta URLs longas usando TinyURL.',
    category: 'diversao',
    permission: 'user',
    execute,
};
