const Tiktok = require("@tobyg74/tiktok-api-dl");

// Função auxiliar para validar URLs
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function execute({ sock, msg, args }) {
    const url = args[0];
    const sender = msg.key.remoteJid;

    if (!url || !isValidUrl(url)) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Envie um link válido do TikTok!\n\nExemplo: .tiktokcomments https://www.tiktok.com/@usuario/video/123456789' });
    }

    if (!url.includes('tiktok.com')) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Link deve ser do TikTok!' });
    }

    try {
        console.log('Obtendo comentários do TikTok...');
        const result = await Tiktok.GetVideoComments(url, {
            commentLimit: 10
        });

        if (result.status !== "success") {
            throw new Error(result.message || 'Erro ao obter comentários');
        }

        if (!result.result || result.result.length === 0) {
            return sock.sendMessage(sender, { text: '💬 *COMENTÁRIOS TIKTOK*\n\nNenhum comentário encontrado ou comentários desabilitados.' });
        }

        let response = `💬 *COMENTÁRIOS TIKTOK*\n\n*Vídeo:* ${url}\n*Total de comentários:* ${result.totalComments || result.result.length}\n\n`;

        // Mostrar até 5 comentários
        const maxComments = Math.min(5, result.result.length);
        for (let i = 0; i < maxComments; i++) {
            const comment = result.result[i];
            const user = comment.user;
            const timestamp = new Date(comment.createTime * 1000).toLocaleDateString('pt-BR');

            response += `${i + 1}. *${user.nickname}* (@${user.username})\n`;
            response += `   "${comment.text}"\n`;
            response += `   ❤️ ${comment.likeCount} | 📅 ${timestamp}\n\n`;
        }

        if (result.result.length > 5) {
            response += `*... e mais ${result.result.length - 5} comentários*`;
        }

        return sock.sendMessage(sender, { text: response });

    } catch (error) {
        console.error('Erro no comando .tiktokcomments:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível obter os comentários do TikTok.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'tiktokcomments',
    description: 'Exibe os comentários de um vídeo do TikTok.',
    category: 'Downloads',
    permission: 'user',
    execute,
    aliases: ['tkcomments'],
};
