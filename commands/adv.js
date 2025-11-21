module.exports = {
    name: 'adv',
    description: 'Adverte um membro. Com 3 advertências, o membro é banido. (!adv @membro [motivo])',
    category: 'adm',
    permission: 'adm',
    async execute({ sock, msg, chatJid, senderJid, args, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentionedJids.length === 0) {
            return 'Você precisa marcar o membro que deseja advertir. Ex: `!adv @usuario spam`';
        }

        const targetJid = mentionedJids[0];
        const reason = args.slice(1).join(' ') || 'TOMOU ADV POR MOTIVOS JUSTOS';

        try {
            // Salva a advertência no banco de dados
            db.salvarAdvertencia(chatJid, targetJid, reason, senderJid);

            // Verifica o número de advertências
            const warnings = db.obterAdvertenciasUsuario(chatJid, targetJid);
            const warningCount = warnings.length;

            if (warningCount >= 3) {
                // Banir o usuário
                await sock.sendMessage(chatJid, {
                    text: `*🚨 BANIMENTO AUTOMÁTICO 🚨*\n\nO membro @${targetJid.split('@')[0]} atingiu *${warningCount}/3* advertências e será removido do grupo.`, // Corrected: escaped newline character
                    mentions: [targetJid]
                });

                // Tenta remover o usuário do grupo
                await sock.groupParticipantsUpdate(chatJid, [targetJid], 'remove');

                // Limpa as advertências do usuário do banco de dados após o ban
                db.limparAdvertenciasUsuario(chatJid, targetJid);

            } else {
                // Apenas envia a mensagem de advertência
                const response = `*⚠️ ADVERTÊNCIA ⚠️*\n\nO membro @${targetJid.split('@')[0]} recebeu uma advertência.\n\n*Motivo:* ${reason}\n*Total de Advertências:* ${warningCount}/3`; // Corrected: escaped newline characters
                await sock.sendMessage(chatJid, {
                    text: response,
                    mentions: [targetJid]
                });
            }

        } catch (error) {
            console.error('[ADV Error]', error);
            return 'Ocorreu um erro ao processar a advertência. Verifique se eu sou administrador do grupo.';
        }
    },
};
