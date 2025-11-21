const giphyService = require('../services/giphyService');

/**
 * Comando de interação: rir (VERSÃO DINÂMICA)
 * Envia um GIF aleatório de risada buscado dinamicamente do Giphy
 * @param {object} context - O objeto de contexto da mensagem
 */
async function execute({ sock, msg, chatJid, senderJid }) {
    try {
        // Buscar GIF aleatório do Giphy
        let videoUrl;
        try {
            // Busca por termos relacionados a "laugh"
            videoUrl = await giphyService.getRandomFromSearch('laughing funny', 30);
        } catch (error) {
            // Fallback: URL fixa caso a API falhe
            videoUrl = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeWEzMTBzejRlcHZsMGliYmh5cWhrN3N5eGw2OWFkZ2ZlaW1vNWFudCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/lcjvA848mj48ds48gk/giphy.gif';
            console.warn('[Comando Rir] Usando GIF fallback devido a erro na API:', error.message);
        }

        // Enviar vídeo com gifPlayback
        await sock.sendMessage(chatJid, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: '😂 KKKKKKKK'
        });

        return null; // Não retorna mensagem de texto adicional

    } catch (error) {
        console.error('[Comando Rir] Erro:', error);
        return '❌ Ocorreu um erro ao enviar o GIF. Tente novamente.';
    }
}

module.exports = {
    name: 'rir',
    description: 'Envia um GIF aleatório de risada.',
    category: 'diversao',
    permission: 'user',
    aliases: ['risada', 'kkkk'],
    execute
};
