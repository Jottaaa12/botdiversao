const Tiktok = require("@tobyg74/tiktok-api-dl");

async function execute({ sock, msg, args }) {
    const query = args.join(' ');
    const sender = msg.key.remoteJid;

    if (!query) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Digite algo para pesquisar!\n\nExemplo: .tiktoksearch nome de usuário' });
    }

    try {
        console.log('Pesquisando no TikTok...');
        const result = await Tiktok.Search(query, {
            type: "user",
            page: 1
        });

        if (result.status !== "success") {
            throw new Error(result.message || 'Erro na pesquisa');
        }

        if (!result.result || result.result.length === 0) {
            return sock.sendMessage(sender, { text: '❌ *PESQUISA TIKTOK*\n\nNenhum usuário encontrado para: ' + query });
        }

        let response = `🔍 *PESQUISA TIKTOK - USUÁRIOS*\n\n*Query:* ${query}\n*Resultados:* ${result.result.length}\n\n`;

        // Mostrar até 5 resultados
        const maxResults = Math.min(5, result.result.length);
        for (let i = 0; i < maxResults; i++) {
            const user = result.result[i];
            response += `${i + 1}. *${user.nickname}* (@${user.username})\n`;
            response += `   Seguidores: ${user.followerCount?.toLocaleString() || 'N/A'}\n`;
            response += `   Verificado: ${user.isVerified ? '✅' : '❌'}\n`;
            response += `   URL: ${user.url}\n\n`;
        }

        if (result.result.length > 5) {
            response += `*... e mais ${result.result.length - 5} resultados*`;
        }

        return sock.sendMessage(sender, { text: response });

    } catch (error) {
        console.error('Erro no comando .tiktoksearch:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível pesquisar no TikTok.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'tiktoksearch',
    description: 'Pesquisa por usuários no TikTok.',
    category: 'Downloads',
    permission: 'user',
    execute,
};
