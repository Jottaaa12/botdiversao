const { jidNormalizedUser } = require('@whiskeysockets/baileys');

async function handleAntiDelete(sock, msg, isGroup, chatJid, messageStore, db) {
    if (msg.message?.protocolMessage?.type === 0) { // Type 0 = REVOKE (delete)
        const deletedMessageId = msg.message.protocolMessage.key.id;
        const antideleteEnabled = isGroup && db.config.obterConfiguracaoGrupo(chatJid, 'antidelete') === 'true';

        if (antideleteEnabled && messageStore.has(deletedMessageId)) {
            const deletedMsg = messageStore.get(deletedMessageId);
            const senderName = deletedMsg.sender.split('@')[0];

            try {
                await sock.sendMessage(chatJid, {
                    text: `🗑️ *@${senderName}* deletou esta mensagem:\n\n"${deletedMsg.content}"`,
                    mentions: [deletedMsg.sender]
                });
                console.log(`[ANTIDELETE] Mensagem deletada recuperada em ${chatJid}`);
            } catch (error) {
                console.error('[ANTIDELETE] Erro ao reenviar mensagem deletada:', error);
            }
        }
        return true; // Indica que foi uma mensagem de protocolo processada
    }
    return false;
}

async function handleAntiMute(sock, msg, isGroup, chatJid, senderJid, db) {
    if (isGroup && await db.groupInteraction.isMuted(senderJid, chatJid)) {
        console.log(`[MUTE] Mensagem de usuário mutado (${senderJid}) no grupo (${chatJid}) detectada. Apagando mensagem.`);
        try {
            await sock.sendMessage(chatJid, { delete: msg.key });
            return true; // Indica que a mensagem foi apagada
        } catch (error) {
            console.error('[MUTE] Erro ao apagar mensagem de usuário mutado:', error);
            // Continua a execução para evitar que o bot trave, mas a mensagem não será apagada
        }
    }
    return false;
}

async function handleAntiLink(sock, msg, isGroup, chatJid, senderJid, message, db, getPermissionLevel) {
    if (isGroup && message) {
        const antilinkEnabled = db.config.obterConfiguracaoGrupo(chatJid, 'antilink') === 'true';
        if (antilinkEnabled) {
            const urlRegex = /https?:\/\/[^\s]+/;
            if (urlRegex.test(message)) {
                try {
                    const groupMetadata = await sock.groupMetadata(chatJid);

                    // Verifica se o remetente é admin
                    const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
                    const isSenderGroupAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
                    const userBotPermission = await getPermissionLevel(sock, senderJid);
                    const isSenderBotAdmin = userBotPermission === 'owner' || userBotPermission === 'admin';

                    // Se o remetente NÃO for admin, aplicar a punição
                    if (!isSenderGroupAdmin && !isSenderBotAdmin) {
                        // --- Verificação de Admin do Bot (Lógica Corrigida) ---
                        const botPnJid = jidNormalizedUser(sock.user.id);
                        let botIsAdmin = false;
                        for (const p of groupMetadata.participants) {
                            if (p.admin === 'admin' || p.admin === 'superadmin') {
                                let adminId = p.id;
                                if (adminId.endsWith('@lid')) {
                                    try {
                                        const resolved = await sock.signalRepository.lidMapping.getPNForLID(adminId);
                                        if (resolved) adminId = resolved;
                                    } catch (e) { /* Ignora se não conseguir resolver */ }
                                }
                                if (jidNormalizedUser(adminId) === botPnJid) {
                                    botIsAdmin = true;
                                    break;
                                }
                            }
                        }
                        // --- Fim da Verificação ---

                        if (botIsAdmin) {
                            console.log(`[Anti-Link] Link detectado de não-admin (${senderJid}). Removendo...`);
                            await sock.sendMessage(chatJid, { delete: msg.key });
                            await sock.groupParticipantsUpdate(chatJid, [senderJid], 'remove');
                            await sock.sendMessage(chatJid, {
                                text: `🚫 *@${senderJid.split('@')[0]}* foi removido por enviar um link.`,
                                mentions: [senderJid]
                            });
                            return true; // Link detectado e punido
                        } else {
                            console.log(`[Anti-Link] Ação cancelada. O bot não tem permissões de admin no grupo para remover membros.`);
                        }
                    } else {
                        console.log(`[Anti-Link] Link enviado por um administrador (${senderJid}). Nenhuma ação foi tomada.`);
                    }
                } catch (error) {
                    console.error('[Anti-Link] Erro na execução do anti-link:', error);
                }
            }
        }
    }
    return false;
}

async function handleAntiEdit(sock, updates, messageStore, db) {
    for (const update of updates) {
        const { key, update: messageUpdate } = update;

        // Verificar se é uma edição de mensagem
        if (messageUpdate?.message) {
            const messageId = key.id;
            const chatJid = key.remoteJid;
            const isGroup = chatJid.endsWith('@g.us');

            console.log('[ANTIEDIT DEBUG] Mensagem editada detectada!');
            console.log('[ANTIEDIT DEBUG] Message ID:', messageId);

            // Verificar se o antiedit está ativo
            const antieditEnabled = isGroup && db.config.obterConfiguracaoGrupo(chatJid, 'antiedit') === 'true';
            console.log('[ANTIEDIT DEBUG] Anti-edit ativo?', antieditEnabled);
            console.log('[ANTIEDIT DEBUG] Mensagem está no store?', messageStore.has(messageId));

            if (antieditEnabled && messageStore.has(messageId)) {
                const originalMsg = messageStore.get(messageId);
                const senderJid = key.participant || key.remoteJid;
                const senderName = senderJid.split('@')[0];

                // Extrair o novo conteúdo da mensagem editada
                // O conteúdo editado está em editedMessage.message, não diretamente em message
                const editedContent = messageUpdate.message?.editedMessage?.message?.conversation ||
                    messageUpdate.message?.editedMessage?.message?.extendedTextMessage?.text ||
                    '';

                console.log('[ANTIEDIT DEBUG] Conteúdo original:', originalMsg.content);
                console.log('[ANTIEDIT DEBUG] Conteúdo editado:', editedContent);

                // Verificar se houve mudança no conteúdo
                if (originalMsg.content !== editedContent && editedContent) {
                    try {
                        await sock.sendMessage(chatJid, {
                            text: `✏️ *@${senderName}* editou a mensagem!\n\n📜 *Original:*\n"${originalMsg.content}"\n\n📝 *Editada para:*\n"${editedContent}"`,
                            mentions: [senderJid]
                        });
                        console.log(`[ANTIEDIT] Edição revelada em ${chatJid}`);

                        // Atualizar o conteúdo armazenado
                        messageStore.set(messageId, {
                            ...originalMsg,
                            content: editedContent
                        });
                    } catch (error) {
                        console.error('[ANTIEDIT] Erro ao revelar mensagem editada:', error);
                    }
                }
            }
        }
    }
}

module.exports = {
    handleAntiDelete,
    handleAntiMute,
    handleAntiLink,
    handleAntiEdit
};
