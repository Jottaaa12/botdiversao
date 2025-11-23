module.exports = {
    name: 'unadv',
    description: 'Remove a última advertência de um membro. (!unadv @membro)',
    category: 'adm',
    permission: 'admin',
    async execute({ sock, msg, chatJid, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentionedJids.length === 0) {
            return 'Você precisa marcar o membro para remover a advertência. Ex: `!unadv @usuario`';
        }

        const targetJid = mentionedJids[0];

        try {
            const currentWarnings = db.groupInteraction.obterAdvertenciasUsuario(chatJid, targetJid);
            if (currentWarnings.length === 0) {
                return `O membro @${targetJid.split('@')[0]} não tem advertências para remover.`;
            }

            db.groupInteraction.removerUltimaAdvertencia(chatJid, targetJid);

            const newWarningsCount = currentWarnings.length - 1;
            const response = `✅ A advertência mais recente de @${targetJid.split('@')[0]} foi removida. Total agora: *${newWarningsCount}/3*.`;

            await sock.sendMessage(chatJid, {
                text: response,
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('[UnADV Error]', error);
            return 'Ocorreu um erro ao tentar remover a advertência.';
        }
    },
};
