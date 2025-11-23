module.exports = {
    name: 'listadv',
    description: 'Lista as advertências de um membro ou de todos. (!listadv [@membro])',
    category: 'adm',
    permission: 'admin',
    async execute({ sock, msg, chatJid, args, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        try {
            // Se um usuário for mencionado, lista as advertências dele
            if (mentionedJids.length > 0) {
                const targetJid = mentionedJids[0];
                const warnings = db.groupInteraction.obterAdvertenciasUsuario(chatJid, targetJid);

                if (warnings.length === 0) {
                    return `O membro @${targetJid.split('@')[0]} não possui nenhuma advertência.`;
                }

                let response = `*📋 Advertências de @${targetJid.split('@')[0]} (${warnings.length})*\n\n`;
                warnings.forEach((warn, index) => {
                    const date = new Date(warn.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                    response += `*${index + 1}.* Motivo: ${warn.motivo}\n`
                        + `   - Autor: @${warn.id_autor.split('@')[0]}\n`
                        + `   - Data: ${date}\n\n`;
                });

                // Adiciona todos os JIDs mencionados na resposta para garantir a marcação
                const allMentions = [targetJid, ...warnings.map(w => w.id_autor)];

                await sock.sendMessage(chatJid, { text: response, mentions: allMentions });
                return;
            }

            // Se ninguém for mencionado, lista um resumo de todos os membros com advertências
            const allWarnings = db.groupInteraction.obterAdvertenciasGrupo(chatJid);
            if (allWarnings.length === 0) {
                return 'Ninguém neste grupo possui advertências.';
            }

            const warningsByUser = allWarnings.reduce((acc, warn) => {
                if (!acc[warn.id_usuario]) {
                    acc[warn.id_usuario] = 0;
                }
                acc[warn.id_usuario]++;
                return acc;
            }, {});

            let response = '*📑 Resumo de Advertências do Grupo*\n\n';
            let allMentions = [];
            for (const userId in warningsByUser) {
                response += `▪️ @${userId.split('@')[0]}: *${warningsByUser[userId]}* advertência(s)\n`;
                allMentions.push(userId);
            }
            response += '\nPara ver detalhes, use `!listadv @membro`.';

            await sock.sendMessage(chatJid, { text: response, mentions: allMentions });

        } catch (error) {
            console.error('[ListADV Error]', error);
            return 'Ocorreu um erro ao listar as advertências.';
        }
    },
};