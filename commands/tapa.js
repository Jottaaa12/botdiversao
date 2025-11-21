const giphyService = require('../services/giphyService');

/**
 * Comando de interação: tapa (VERSÃO DINÂMICA)
 * Envia um GIF aleatório de "tapão" buscado dinamicamente do Giphy
 * @param {object} context - O objeto de contexto da mensagem
 */
async function execute({ sock, msg, chatJid, senderJid, args }) {
    try {
        // Extrair menção do usuário do contextInfo
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

        // Se não houver menção, retornar erro
        if (!mentionedJid || mentionedJid.length === 0) {
            return '❌ Você precisa marcar alguém para dar um tapa!\n\nExemplo: !tapa @usuario';
        }

        const targetJid = mentionedJid[0];

        // Buscar GIF aleatório do Giphy
        let videoUrl;
        try {
            // Busca por termos relacionados a "tapa" ou "slap"
            videoUrl = await giphyService.getRandomFromSearch('slap anime meme', 30);
            console.log('[Comando Tapa] URL do GIF:', videoUrl);
        } catch (error) {
            // Fallback: URL fixa caso a API falhe
            videoUrl = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeHB5M3Rvd21mNXI1ZHNqdnQ3OWxyczhsbjAyMmQ1eHlyZHZnb2E3byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/srD8JByP9u3zW/giphy.mp4';
            console.warn('[Comando Tapa] Usando GIF fallback devido a erro na API:', error.message);
        }

        // Log do JID para debug
        console.log('[Comando Tapa] JID completo capturado:', targetJid);

        // Extrair número limpo (sem device ID e sem @s.whatsapp.net)
        const displayName = targetJid.split(':')[0].replace('@s.whatsapp.net', '');
        console.log('[Comando Tapa] Nome/numero a mencionar:', displayName);

        // Enviar vídeo com gifPlayback
        await sock.sendMessage(chatJid, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: `💥 Acorda pra vida, @${displayName}!`,
            mentions: [targetJid]
        });

        return null; // Não retorna mensagem de texto adicional

    } catch (error) {
        console.error('[Comando Tapa] Erro:', error);
        return '❌ Ocorreu um erro ao enviar o GIF. Tente novamente.';
    }
}

module.exports = {
    name: 'tapa',
    description: 'Envia um GIF aleatório de tapão mencionando o usuário marcado.',
    category: 'diversao',
    permission: 'user',
    aliases: [],
    execute
};
