const giphyService = require('../services/giphyService');

/**
 * Comando de interação: f (Press F to Pay Respects) (VERSÃO DINÂMICA)
 * Envia um GIF aleatório do meme "Press F" buscado dinamicamente do Giphy
 * @param {object} context - O objeto de contexto da mensagem
 */
async function execute({ sock, msg, chatJid, senderJid, args }) {
    try {
        // Extrair menção do usuário do contextInfo
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

        // Se não houver menção, retornar erro
        if (!mentionedJid || mentionedJid.length === 0) {
            return '❌ Você precisa marcar alguém para prestar respeitos!\n\nExemplo: !f @usuario';
        }

        const targetJid = mentionedJid[0];

        // Buscar GIF aleatório do Giphy
        let videoUrl;
        try {
            // Busca por termos relacionados a "press f" ou "respect"
            videoUrl = await giphyService.getRandomFromSearch('press f respect', 30);
        } catch (error) {
            // Fallback: URL fixa caso a API falhe
            videoUrl = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExa3lmaDQ1aWdpZnNraTQ5dWpkNmg4MWU3NTl3Z3VrazBqMzljdmZjNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/5ptSdQUojHf0ogU3Zm/giphy.gif';
            console.warn('[Comando F] Usando GIF fallback devido a erro na API:', error.message);
        }

        // Extrair número limpo (sem device ID e sem @s.whatsapp.net)
        const displayName = targetJid.split(':')[0].replace('@s.whatsapp.net', '');

        // Enviar vídeo com gifPlayback
        await sock.sendMessage(chatJid, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: `⚰️ Descanse em paz, @${displayName}.`,
            mentions: [targetJid]
        });

        return null; // Não retorna mensagem de texto adicional

    } catch (error) {
        console.error('[Comando F] Erro:', error);
        return '❌ Ocorreu um erro ao enviar o GIF. Tente novamente.';
    }
}

module.exports = {
    name: 'f',
    description: 'Press F to Pay Respects - Envia um GIF aleatório do meme mencionando o usuário marcado.',
    category: 'diversao',
    permission: 'user',
    aliases: ['rip'],
    execute
};
