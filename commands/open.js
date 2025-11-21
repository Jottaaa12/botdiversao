const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'open',
    description: 'Abre o grupo para que todos os membros possam enviar mensagens.',
    aliases: ['abrir'],
    category: 'adm',
    permission: 'admin',

    async execute({ sock, chatJid, senderJid }) {
        if (!chatJid.endsWith('@g.us')) {
            return 'Este comando só pode ser usado em grupos.';
        }

        // 1. Obter metadados e verificar permissões
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatJid);
        } catch (e) {
            return 'Ocorreu um erro ao verificar as informações deste grupo.';
        }

        // Verificar se quem envia é admin do grupo
        const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
        if (!senderParticipant?.admin) {
            return '❌ Apenas administradores do grupo podem usar este comando.';
        }

        // Verificar se o bot é admin
        const botPnJid = jidNormalizedUser(sock.user.id);
        let botIsAdmin = false;
        for (const p of groupMetadata.participants) {
            if (p.admin) {
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
            return '❌ Eu preciso ser um administrador para alterar as configurações do grupo.';
        }

        // 2. Abrir o grupo
        try {
            await sock.groupSettingUpdate(chatJid, 'not_announcement');
            return '✅ Grupo aberto. Todos os membros podem enviar mensagens agora.';
        } catch (error) {
            console.error('[Comando Open] Erro ao abrir o grupo:', error);
            return '❌ Ocorreu um erro ao tentar abrir o grupo.';
        }
    }
};
