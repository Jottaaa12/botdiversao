const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '..', 'config.json');

module.exports = {
    name: 'removeadmin',
    description: 'Rebaixa um usuário de administrador no grupo e o remove como admin do bot.',
    aliases: ['rebaixar', 'demote'],
    category: 'adm',
    permission: 'owner', // Apenas o dono do bot pode remover outros admins do sistema

    async execute({ sock, msg, chatJid, senderJid }) {
        if (!chatJid.endsWith('@g.us')) {
            return 'Este comando só pode ser usado em grupos.';
        }

        // 1. Identificar o alvo
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const repliedToJid = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.senderJid;
        const targetJid = mentionedJid || repliedToJid;

        if (!targetJid) {
            return 'Você precisa marcar um usuário ou responder a uma mensagem dele para rebaixar.';
        }
        
        if (targetJid === senderJid) {
            return 'Você não pode rebaixar a si mesmo.';
        }
        
        const ownerJid = sock.user.id;
        if (targetJid === jidNormalizedUser(ownerJid)) {
            return 'Você não pode rebaixar o dono do bot.';
        }

        // 2. Obter metadados e verificar permissões
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatJid);
        } catch (e) {
            return 'Ocorreu um erro ao verificar as informações deste grupo.';
        }
        
        // Verificar se o bot é admin
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
            return 'Eu preciso ser um administrador neste grupo para poder rebaixar membros.';
        }
        
        // Verificar se o alvo é de fato um admin
        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (!targetParticipant?.admin) {
             await sock.sendMessage(chatJid, { text: `O usuário @${targetJid.split('@')[0]} já não é um administrador do grupo.`, mentions: [targetJid] });
             return null;
        }

        // 3. Rebaixar usuário no grupo
        try {
            await sock.groupParticipantsUpdate(chatJid, [targetJid], 'demote');
        } catch (e) {
            console.error('[Comando RemoveAdmin] Erro ao rebaixar no grupo:', e);
            return `Ocorreu um erro ao tentar rebaixar @${targetJid.split('@')[0]} no grupo.`;
        }

        // 4. Remover usuário do config.json
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const targetId = targetJid.split('@')[0];
            
            if (config.admins.includes(targetId)) {
                config.admins = config.admins.filter(admin => admin !== targetId);
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                console.log(`[Comando RemoveAdmin] Usuário ${targetId} removido como admin do sistema.`);
            }
        } catch (error) {
            console.error(`[Comando RemoveAdmin] Erro ao remover admin do config.json:`, error);
        }

        // 5. Enviar mensagem de sucesso
        const responseText = `✅ Sucesso! @${targetJid.split('@')[0]} não é mais um administrador.`;
        await sock.sendMessage(chatJid, {
            text: responseText,
            mentions: [targetJid]
        });

        return null;
    }
};