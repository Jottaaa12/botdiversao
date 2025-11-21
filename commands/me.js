module.exports = {
    name: 'me',
    aliases: ['eu', 'perfil'],
    category: 'diversao',
    description: 'Mostra seu perfil ou de outro usuário (@mencionar)',
    permission: 'user',
    async execute({ sock, chatJid, msg, db, senderJid }) {
        const isGroup = chatJid.endsWith('@g.us');

        // Verificar se mencionou alguém
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        const alvoJid = (mentionedJid && mentionedJid.length > 0) ? mentionedJid[0] : senderJid;

        const usuario = db.obterUsuario(alvoJid);

        if (!usuario) {
            await sock.sendMessage(chatJid, {
                text: '❌ Não foi possível encontrar as informações deste usuário no banco de dados.'
            });
            return;
        }

        const numero = alvoJid.split(':')[0].replace('@s.whatsapp.net', '');
        let perfil = `👤 *PERFIL DE @${numero}* 👤\n\n`;

        // Nome
        perfil += `📝 *Nome:* ${usuario.nome || 'Não definido'}\n`;

        // Data de cadastro
        if (usuario.criado_em) {
            const dataCriacao = new Date(usuario.criado_em);
            perfil += `📅 *Membro desde:* ${dataCriacao.toLocaleDateString('pt-BR')}\n`;
        }

        // Role/Cargo
        const roleEmoji = {
            'owner': '👑',
            'admin': '⭐',
            'user': '👤'
        };
        const roleNome = {
            'owner': 'Dono',
            'admin': 'Administrador',
            'user': 'Membro'
        };
        perfil += `${roleEmoji[usuario.role] || '👤'} *Cargo:* ${roleNome[usuario.role] || 'Membro'}\n`;

        // Status de casamento
        perfil += `\n💕 *STATUS RELACIONAMENTO*\n`;
        const conjuge = db.obterConjuge(alvoJid);
        if (conjuge) {
            const numeroConjuge = conjuge.conjuge.split(':')[0].replace('@s.whatsapp.net', '');
            const dataCasamento = new Date(conjuge.data_casamento);
            const diasCasado = Math.floor((Date.now() - dataCasamento.getTime()) / (1000 * 60 * 60 * 24));

            perfil += `💍 Casado(a) com @${numeroConjuge}\n`;
            perfil += `📅 Desde: ${dataCasamento.toLocaleDateString('pt-BR')}\n`;
            perfil += `⏳ Há ${diasCasado} dia${diasCasado !== 1 ? 's' : ''}\n`;
            perfil += `❤️ Nível de amor: ${conjuge.nivel_amor}%\n`;
        } else {
            perfil += `💔 Solteiro(a)\n`;
        }

        // Estatísticas do grupo (se estiver em um grupo)
        if (isGroup) {
            perfil += `\n📊 *ESTATÍSTICAS NO GRUPO*\n`;

            // Buscar dados do membro no grupo
            const ranking = db.obterRankingGrupo(chatJid, 100);
            const membroGrupo = ranking.find(m => m.id_usuario === alvoJid);

            if (membroGrupo) {
                perfil += `💬 Mensagens enviadas: ${membroGrupo.msg_count}\n`;

                // Calcular posição no ranking
                const posicao = ranking.findIndex(m => m.id_usuario === alvoJid) + 1;
                const medalhas = ['🥇', '🥈', '🥉'];
                const posicaoTexto = posicao <= 3 ? medalhas[posicao - 1] : `${posicao}º`;
                perfil += `🏆 Posição no ranking: ${posicaoTexto}\n`;

                // Última atividade
                if (membroGrupo.last_seen) {
                    const lastSeen = new Date(membroGrupo.last_seen);
                    const horasInativo = Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60));

                    if (horasInativo < 1) {
                        perfil += `🕐 Última mensagem: Agora mesmo\n`;
                    } else if (horasInativo < 24) {
                        perfil += `🕐 Última mensagem: Há ${horasInativo} hora${horasInativo !== 1 ? 's' : ''}\n`;
                    } else {
                        const diasInativo = Math.floor(horasInativo / 24);
                        perfil += `🕐 Última mensagem: Há ${diasInativo} dia${diasInativo !== 1 ? 's' : ''}\n`;
                    }
                }
            } else {
                perfil += `💬 Mensagens enviadas: 0\n`;
                perfil += `🏆 Posição no ranking: Sem dados\n`;
            }
        }

        // Futuras funcionalidades (comentadas para referência)
        // perfil += `\n👶 *FAMÍLIA*\n`;
        // perfil += `Filhos: 0\n`;

        // Status de ban (apenas se estiver banido)
        if (usuario.banned) {
            perfil += `\n⛔ *STATUS:* BANIDO\n`;
        }

        // Criar array de menções
        const mentions = [alvoJid];
        if (conjuge) {
            mentions.push(conjuge.conjuge);
        }

        await sock.sendMessage(chatJid, {
            text: perfil,
            mentions: mentions
        });
    }
};
