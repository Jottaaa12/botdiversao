module.exports = {
    name: 'listadmins',
    description: 'Lista todos os administradores do bot.',
    category: 'adm',
    permission: 'owner', // Apenas o dono pode usar
    execute: async ({ sock, msg, db }) => {
        try {
            const admins = db.getAdmins();

            if (!admins || admins.length === 0) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Não há administradores configurados no sistema.' }, { quoted: msg });
                return;
            }

            let adminList = `*Lista de Administradores do Sistema:*\n\n`;
            admins.forEach(admin => {
                const phone = admin.id_whatsapp.split('@')[0];
                const name = admin.nome || 'Sem nome';
                const role = admin.role === 'owner' ? '👑 Dono' : '👮 Admin';
                adminList += `- ${role}: ${name} (@${phone})\n`;
            });

            await sock.sendMessage(msg.key.remoteJid, {
                text: adminList,
                mentions: admins.map(a => a.id_whatsapp)
            }, { quoted: msg });

        } catch (error) {
            console.error(`[Comando ListAdmins] Erro ao listar admins:`, error);
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Ocorreu um erro ao tentar listar os administradores.' }, { quoted: msg });
        }
    }
};