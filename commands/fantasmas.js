module.exports = {
    name: 'fantasmas',
    aliases: ['inativos'],
    category: 'adm',
    description: 'Lista os membros que não interagem no grupo há vários dias',
    permission: 'admin',
    async execute({ sock, chatJid, args, db }) {
        const dias = parseInt(args[0]) || 7;

        if (dias < 1 || dias > 365) {
            await sock.sendMessage(chatJid, {
                text: '❌ O número de dias deve ser entre 1 e 365.'
            });
            return;
        }

        const inativos = db.groupInteraction.obterInativosGrupo(chatJid, dias);

        if (!inativos || inativos.length === 0) {
            await sock.sendMessage(chatJid, {
                text: `👻 *MEMBROS INATIVOS*\n\nNão há membros inativos há mais de ${dias} dias.\nTodos estão participando ativamente! 🎉`
            });
            return;
        }

        let mensagem = `👻 *MEMBROS INATIVOS (${dias}+ dias)*\n\n`;
        mensagem += `_Encontrados ${inativos.length} membros inativos:_\n\n`;

        for (let i = 0; i < Math.min(inativos.length, 20); i++) {
            const membro = inativos[i];
            const numero = membro.id_usuario.split(':')[0].replace('@s.whatsapp.net', '');
            const lastSeen = new Date(membro.last_seen);
            const diasInativo = Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));

            mensagem += `${i + 1}. @${numero}\n`;
            mensagem += `   🕐 Inativo há ${diasInativo} dias\n`;
            mensagem += `   💬 ${membro.msg_count} mensagens totais\n\n`;
        }

        if (inativos.length > 20) {
            mensagem += `\n_... e mais ${inativos.length - 20} membros inativos_`;
        }

        // Criar array de menções
        const mentions = inativos.slice(0, 20).map(m => m.id_usuario);

        await sock.sendMessage(chatJid, {
            text: mensagem,
            mentions: mentions
        });
    }
};
