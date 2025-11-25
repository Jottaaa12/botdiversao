const { handleAntiDelete, handleAntiMute, handleAntiLink, handleAntiEdit } = require('../../services/moderationService');
const { getPermissionLevel } = require('../../utils/auth');

module.exports = async (context, next) => {
    const { sock, msg, isGroup, chatJid, senderJid, message, db, sessionManager } = context;
    const { messageStore } = sessionManager;

    // --- ANTI-DELETE ---
    // handleAntiDelete retorna true se processou uma mensagem deletada (protocolMessage)
    // Se for protocolMessage, não devemos continuar o pipeline normal de comandos
    if (await handleAntiDelete(sock, msg, isGroup, chatJid, messageStore, db)) {
        return;
    }

    // --- ARMAZENAR MENSAGEM (para Anti-Edit/Delete) ---
    if (!msg.key.fromMe && messageStore) {
        const mediaType = msg.message?.imageMessage ? 'image' :
            msg.message?.videoMessage ? 'video' :
                msg.message?.documentMessage ? 'document' :
                    msg.message?.audioMessage ? 'audio' :
                        msg.message?.stickerMessage ? 'sticker' :
                            'text';

        const hasAttachment = !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage || msg.message?.audioMessage);

        messageStore.set(msg.key.id, {
            content: message || '[Mídia]',
            sender: senderJid,
            chatJid: chatJid,
            timestamp: Date.now(),
            mediaType: mediaType,
            hasMedia: hasAttachment,
            originalMessage: msg.message
        });

        // Limpeza (opcional, ou deixar para um cron/intervalo global)
        // ...
    }

    // --- ANTI-MUTE ---
    if (await handleAntiMute(sock, msg, isGroup, chatJid, senderJid, db)) {
        return;
    }

    // --- ANTI-LINK ---
    if (await handleAntiLink(sock, msg, isGroup, chatJid, senderJid, message, db, getPermissionLevel)) {
        return;
    }

    // --- BLACKLIST ---
    if (isGroup && message) {
        const blacklistKey = `blacklist_${chatJid}`;
        const blacklistGrupo = db.config.obterConfiguracaoAvancada('seguranca', blacklistKey) || [];
        const blacklistGlobal = db.config.obterConfiguracaoAvancada('seguranca', 'blacklist_global') || [];
        const blacklistCompleta = [...new Set([...blacklistGrupo, ...blacklistGlobal])];

        if (blacklistCompleta.length > 0) {
            const msgLower = message.toLowerCase();
            const palavraProibida = blacklistCompleta.find(palavra => msgLower.includes(palavra.toLowerCase()));

            if (palavraProibida) {
                const userPermission = await getPermissionLevel(sock, senderJid);
                if (userPermission !== 'admin' && userPermission !== 'owner') {
                    console.log(`[Blacklist] Palavra proibida "${palavraProibida}" detectada.`);
                    try {
                        await sock.sendMessage(chatJid, { delete: msg.key });
                        const sentMsg = await sock.sendMessage(chatJid, {
                            text: `⚠️ @${senderJid.split('@')[0]}, mensagem removida por conter palavra proibida.`,
                            mentions: [senderJid]
                        });
                        setTimeout(() => sock.sendMessage(chatJid, { delete: sentMsg.key }).catch(() => { }), 10000);
                    } catch (e) {
                        console.error('[Blacklist] Erro ao punir:', e);
                    }
                    return;
                }
            }
        }
    }

    await next();
};
