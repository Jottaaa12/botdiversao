const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = async (context, next) => {
    const { sock, m } = context;
    const msg = m.messages[0];

    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    let senderJid = isGroup ? (msg.participant || msg.key.participant) : msg.key.remoteJid;

    // Normalizar JID (LID -> PN)
    if (senderJid && senderJid.includes('@lid')) {
        try {
            const pnJid = await sock.signalRepository.lidMapping.getPNForLID(senderJid);
            if (pnJid) senderJid = pnJid;
        } catch (e) {
            console.error(`[Normalizer] Erro ao normalizar LID ${senderJid}:`, e);
        }
    }

    if (senderJid) {
        senderJid = jidNormalizedUser(senderJid);
    }

    const chatJid = msg.key.remoteJid;
    const messageContent = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        msg.message?.documentMessage?.caption ||
        '';

    const messageId = msg.key.id;

    // Adiciona dados normalizados ao contexto
    context.msg = msg;
    context.isGroup = isGroup;
    context.senderJid = senderJid;
    context.chatJid = chatJid;
    context.message = messageContent;
    context.messageId = messageId;
    context.jidNormalizedUser = jidNormalizedUser;

    // Marca como lido (Receipt)
    try {
        const messageKey = {
            remoteJid: chatJid,
            id: messageId,
            participant: msg.key.participant
        };
        await sock.readMessages([messageKey]);
    } catch (error) {
        console.error('[Receipt] Erro ao marcar mensagem como lida:', error);
    }

    await next();
};
