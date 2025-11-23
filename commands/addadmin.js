const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'addadmin',
    description: 'Promove um usuário a administrador no grupo e o adiciona como admin do bot.',
    aliases: ['promover', 'setadmin', 'admin', 'pmv'],
    category: 'adm',
    permission: 'owner', // Apenas o dono do bot pode adicionar outros admins no sistema

    /**
     * @param {object} context
     * @param {import('@whiskeysockets/baileys').WASocket} context.sock
     * @param {import('@whiskeysockets/baileys').WAMessage} context.msg
     * @param {string[]} context.args
     * @param {string} context.chatJid
     * @param {string} context.senderJid
     * @param {object} context.db
     */
    async execute({ sock, msg, args, chatJid, senderJid, db }) {
        // 1. Verificar se é um grupo
        if (!chatJid.endsWith('@g.us')) {
            return 'Este comando só pode ser usado em grupos.';
        }

        // 2. Obter o JID do alvo (por menção, resposta ou argumento)
        let targetJid;
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const repliedToJid = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.senderJid || msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (mentionedJid) {
            targetJid = mentionedJid;
        } else if (repliedToJid) {
            targetJid = repliedToJid;
        } else if (args[0]) {
            const phone = args[0].replace(/[^0-9]/g, '');
            if (!phone) {
                return 'Você precisa marcar um usuário, responder a uma mensagem dele ou fornecer um número de telefone válido.';
            }
            targetJid = `${phone}@s.whatsapp.net`;
        } else {
            return 'Você precisa marcar um usuário, responder a uma mensagem dele ou fornecer o número de telefone.';
        }

        const targetId = targetJid.split('@')[0];

        // 3. Obter metadados e verificar se o bot é admin
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatJid);
        } catch (e) {
            console.error('[Comando AddAdmin] Erro ao obter metadados do grupo:', e);
            return 'Ocorreu um erro ao verificar as informações deste grupo.';
        }

        const botPnJid = jidNormalizedUser(sock.user.id);
        let botIsAdmin = false;
        for (const p of groupMetadata.participants) {
            if (p.admin) { // 'admin' ou 'superadmin'
                let adminId = p.id;
                if (adminId.endsWith('@lid')) {
                    try {
                        const resolved = await sock.signalRepository.lidMapping.getPNForLID(adminId);
                        if (resolved) adminId = resolved;
                    } catch (e) { /* Ignora */ }
                }
                if (jidNormalizedUser(adminId) === botPnJid) {
                    botIsAdmin = true;
                    break;
                }
            }
        }
        if (!botIsAdmin) {
            return 'Eu preciso ser um administrador neste grupo para promover outros membros.';
        }

        // 4. Adicionar usuário como admin no banco de dados
        try {
            // Verifica se o usuário já existe, se não, cria
            let user = db.user.obterUsuario(targetJid);
            if (!user) {
                db.user.salvarUsuario(targetJid, null, []);
            }

            db.setUserRole(targetJid, 'admin');
            console.log(`[Comando AddAdmin] Usuário ${targetId} adicionado como admin do sistema.`);
        } catch (error) {
            console.error(`[Comando AddAdmin] Erro ao adicionar admin ao banco de dados:`, error);
            await sock.sendMessage(chatJid, { text: 'Ocorreu um erro ao salvar a permissão de admin no sistema.' });
            return null;
        }

        // 5. Promover usuário no grupo
        try {
            await sock.groupParticipantsUpdate(
                chatJid,
                [targetJid],
                "promote"
            );
        } catch (e) {
            console.error('[Comando AddAdmin] Erro ao promover no grupo:', e);
            // Se falhar aqui, o usuário já foi adicionado ao sistema, mas não ao grupo.
            // A mensagem informa o status misto.
            const responseText = `✅ @${targetId} foi adicionado como admin do *sistema*, mas falhei em promovê-lo no grupo. Verifique minhas permissões.`;
            await sock.sendMessage(chatJid, {
                text: responseText,
                mentions: [targetJid]
            });
            return null;
        }

        // 6. Enviar mensagem de sucesso
        const responseText = `✅ Sucesso! @${targetId} agora é administrador do grupo e do sistema.`;
        await sock.sendMessage(chatJid, {
            text: responseText,
            mentions: [targetJid]
        });

        return null; // Retorna null para que o handler não envie outra mensagem
    }
};