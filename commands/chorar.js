const giphyService = require('../services/giphyService');

/**
 * Comando de interação: chorar (VERSÃO DINÂMICA)
 * Envia um GIF aleatório de choro buscado dinamicamente do Giphy
 * @param {object} context - O objeto de contexto da mensagem
 */
async function execute({ sock, msg, chatJid, senderJid }) {
    try {
        // Buscar GIF aleatório do Giphy
        let videoUrl;
        try {
            // Busca por termos relacionados a "cry" ou "sad"
            videoUrl = await giphyService.getRandomFromSearch('crying sad', 30);
        } catch (error) {
            // Fallback: URL fixa caso a API falhe
            videoUrl = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXY5dzNkbnpsbzFmcDRteXhicWsxMmYzcWZvbXR2NHR0NGxmZXBqNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/k61nOBRRBMxva/giphy.gif';
            console.warn('[Comando Chorar] Usando GIF fallback devido a erro na API:', error.message);
        }

        // Enviar vídeo com gifPlayback
        await sock.sendMessage(chatJid, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: '😭 Que tristeza...'
        });

        return null; // Não retorna mensagem de texto adicional

    } catch (error) {
        console.error('[Comando Chorar] Erro:', error);
        return '❌ Ocorreu um erro ao enviar o GIF. Tente novamente.';
    }
}

module.exports = {
    name: 'chorar',
    description: 'Envia um GIF aleatório de choro.',
    category: 'diversao',
    permission: 'user',
    aliases: ['triste', 'sad'],
    execute
};
