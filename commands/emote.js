const giphyService = require('../services/giphyService');

/**
 * Comando de interação: emote (VERSÃO DINÂMICA)
 * Envia um GIF aleatório de dancinha/emote buscado dinamicamente do Giphy
 * @param {object} context - O objeto de contexto da mensagem
 */
async function execute({ sock, msg, chatJid, senderJid }) {
    try {
        // Buscar GIF aleatório do Giphy
        let videoUrl;
        try {
            // Busca por termos relacionados a "dance" ou "emote"
            videoUrl = await giphyService.getRandomFromSearch('dance celebration', 30);
        } catch (error) {
            // Fallback: URL fixa caso a API falhe
            videoUrl = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTdhdjd0aGdjeDd0NzVodzNvdTBvaGx0cW05cnN3MnR4cjB1Y3Y3YyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/EBeKznBAtxaH9uChgk/giphy.gif';
            console.warn('[Comando Emote] Usando GIF fallback devido a erro na API:', error.message);
        }

        // Enviar vídeo com gifPlayback
        await sock.sendMessage(chatJid, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: '💃 Hora do show!'
        });

        return null; // Não retorna mensagem de texto adicional

    } catch (error) {
        console.error('[Comando Emote] Erro:', error);
        return '❌ Ocorreu um erro ao enviar o GIF. Tente novamente.';
    }
}

module.exports = {
    name: 'emote',
    description: 'Envia um GIF aleatório de dancinha/emote.',
    category: 'diversao',
    permission: 'user',
    aliases: ['dance', 'danca'],
    execute
};
