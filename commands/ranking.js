module.exports = {
    name: 'ranking',
    aliases: ['top'],
    category: 'diversao',
    description: 'Mostra o ranking dos usuários mais ativos do grupo',
    permission: 'user',
    async execute({ sock, chatJid, args, db }) {
        const limite = parseInt(args[0]) || 10;

        if (limite < 1 || limite > 20) {
            await sock.sendMessage(chatJid, {
                text: '❌ O limite deve ser entre 1 e 20 usuários.'
            });
            return;
        }

        const ranking = db.obterRankingGrupo(chatJid, limite);

        if (!ranking || ranking.length === 0) {
            await sock.sendMessage(chatJid, {
                text: '📊 *RANKING DO GRUPO*\n\nAinda não há dados suficientes para gerar o ranking.\nContinue conversando no grupo!'
            });
            return;
        }

        let mensagem = '📊 *RANKING DOS MAIS ATIVOS*\n\n';
        const medalhas = ['🥇', '🥈', '🥉'];

        // Buscar metadata do grupo para obter nomes
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatJid);
        } catch (error) {
            console.error('[Ranking] Erro ao buscar metadata do grupo:', error);
        }

        for (let i = 0; i < ranking.length; i++) {
            const membro = ranking[i];
            const medalha = i < 3 ? medalhas[i] : `${i + 1}º`;

            // Buscar nome do participante no metadata do grupo
            let displayName = membro.id_usuario.split(':')[0].replace('@s.whatsapp.net', '');

            if (groupMetadata) {
                const participant = groupMetadata.participants.find(p => p.id === membro.id_usuario);
                if (participant) {
                    // Usar notify (nome que a pessoa definiu) ou o número como fallback
                    displayName = participant.notify || displayName;
                }
            }

            mensagem += `${medalha} @${displayName}\n`;
            mensagem += `   💬 ${membro.msg_count} mensagens\n\n`;
        }

        mensagem += `\n_Total de ${ranking.length} usuários no ranking_`;

        // Criar array de menções
        const mentions = ranking.map(m => m.id_usuario);

        await sock.sendMessage(chatJid, {
            text: mensagem,
            mentions: mentions
        });
    }
};
