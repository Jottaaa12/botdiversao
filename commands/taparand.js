const giphyService = require('../services/giphyService');

/**
 * Comando de interação: tapa (VERSÃO DINÂMICA)
 * Envia um GIF aleatório de "tapão" buscado dinamicamente do Giphy
 * @param {object} context - O objeto de contexto da mensagem
 */
async function execute({ sock, msg, chatJid, senderJid, args }) {
    try {
        // Extrair menção do usuário
        let mentionedJid = null;

        // Verificar se há menção via @ no texto
        if (args.length > 0 && args[0].startsWith('@')) {
            const numero = args[0].substring(1);
            mentionedJid = `${numero}@s.whatsapp.net`;
        }

        // Verificar se há menção na mensagem (contextInfo)
        if (!mentionedJid && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            mentionedJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        // Se não houver menção, usar o próprio remetente
        if (!mentionedJid) {
            return '❌ Você precisa marcar alguém para dar um tapa!\n\nExemplo: !taparand @usuario';
        }

        // Buscar GIF aleatório do Giphy
        let videoUrl;
        try {
            // Busca por termos relacionados a "tapa" ou "slap"
            videoUrl = await giphyService.getRandomFromSearch('slap anime', 25);
        } catch (error) {
            // Fallback: URL fixa caso a API falhe
            videoUrl = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeHB5M3Rvd21mNXI1ZHNqdnQ3OWxyczhsbjAyMmQ1eHlyZHZnb2E3byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/srD8JByP9u3zW/giphy.gif';
            console.warn('[Comando TapaRand] Usando GIF fallback devido a erro na API');
        }

        // Nome do usuário mencionado
        const userName = mentionedJid.split('@')[0];

        // Enviar vídeo com gifPlayback
        await sock.sendMessage(chatJid, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: `💥 Acorda pra vida, @${userName}!`,
            mentions: [mentionedJid]
        });

        return null; // Não retorna mensagem de texto adicional

    } catch (error) {
        console.error('[Comando TapaRand] Erro:', error);
        return '❌ Ocorreu um erro ao enviar o GIF. Tente novamente.';
    }
}

module.exports = {
    name: 'taparand',
    description: 'Envia um GIF aleatório de tapão mencionando o usuário marcado (busca dinâmica do Giphy).',
    category: 'diversao',
    permission: 'user',
    aliases: ['taparandom'],
    execute
};
