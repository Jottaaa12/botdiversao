const giphyService = require('../services/giphyService');

/**
 * Comando de interação: f (Press F to Pay Respects) (VERSÃO DINÂMICA)
 * Envia um GIF aleatório do meme "Press F" buscado dinamicamente do Giphy
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

        // Se não houver menção, retornar erro
        if (!mentionedJid) {
            return '❌ Você precisa marcar alguém para prestar respeitos!\n\nExemplo: !f @usuario';
        }

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

        // Buscar informações do contato mencionado
        let displayName = mentionedJid.split('@')[0];
        try {
            const [contact] = await sock.onWhatsApp(mentionedJid);
            if (contact && contact.exists) {
                displayName = mentionedJid.split('@')[0];
            }
        } catch (err) {
            console.log('[Comando F] Não foi possível obter info do contato');
        }

        // Enviar vídeo com gifPlayback
        await sock.sendMessage(chatJid, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: `⚰️ Descanse em paz, @${displayName}.`,
            mentions: [mentionedJid]
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
