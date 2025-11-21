const giphyService = require('../services/giphyService');

/**
 * Comando de interação: reviver (VERSÃO DINÂMICA)
 * Envia um GIF aleatório de "reviver" buscado dinamicamente do Giphy
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
            return '❌ Você precisa marcar alguém para reviver!\n\nExemplo: !reviver @usuario';
        }

        // Buscar GIF aleatório do Giphy
        let videoUrl;
        try {
            // Busca por termos relacionados a "reviver" ou "help"
            videoUrl = await giphyService.getRandomFromSearch('revive help up', 30);
        } catch (error) {
            // Fallback: URL fixa caso a API falhe
            videoUrl = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnRqZmdtdm95eWc5b2NuYjk0N3kwYmtuM3JmaGp1YzZ5Y2lmOXJneCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ZBntGsuRCF0eRKqPOW/giphy.gif';
            console.warn('[Comando Reviver] Usando GIF fallback devido a erro na API:', error.message);
        }

        // Buscar informações do contato mencionado
        let displayName = mentionedJid.split('@')[0];
        try {
            const [contact] = await sock.onWhatsApp(mentionedJid);
            if (contact && contact.exists) {
                displayName = mentionedJid.split('@')[0];
            }
        } catch (err) {
            console.log('[Comando Reviver] Não foi possível obter info do contato');
        }

        // Enviar vídeo com gifPlayback
        await sock.sendMessage(chatJid, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: `🚑 Salvando o @${displayName}... não cai de novo hein!`,
            mentions: [mentionedJid]
        });

        return null; // Não retorna mensagem de texto adicional

    } catch (error) {
        console.error('[Comando Reviver] Erro:', error);
        return '❌ Ocorreu um erro ao enviar o GIF. Tente novamente.';
    }
}

module.exports = {
    name: 'reviver',
    description: 'Envia um GIF aleatório de reviver mencionando o usuário marcado.',
    category: 'diversao',
    permission: 'user',
    aliases: [],
    execute
};
