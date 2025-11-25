const { delay } = require('@whiskeysockets/baileys');

module.exports = async (context, next) => {
    const { isGroup, message, db, chatJid, sock, msg, senderJid, commands } = context;

    if (!isGroup || !message) {
        await next();
        return;
    }

    // --- AUTO-RESPOSTAS ---
    try {
        const triggers = db.groupInteraction.listarAutoRespostas(chatJid);
        const msgLower = message.trim().toLowerCase();

        for (const t of triggers) {
            let match = false;
            if (t.match_type === 'contains') {
                if (msgLower.includes(t.gatilho)) match = true;
            } else {
                if (msgLower === t.gatilho) match = true;
            }

            if (match) {
                console.log(`[AutoResposta] Gatilho "${t.gatilho}" acionado.`);
                await sock.sendMessage(chatJid, { text: t.resposta }, { quoted: msg });
                return; // Interrompe pipeline
            }
        }
    } catch (error) {
        console.error('[AutoResposta] Erro:', error);
    }

    // --- DETECÇÃO DE DESISTÊNCIA DA LISTA ---
    try {
        const listaAtiva = db.list.obterListaAtiva(chatJid);
        if (listaAtiva) {
            const msgNormalizada = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const padroes = [
                /\b(nao|não)\s+(vou|vo|irei)\s+mais\b/i,
                /\b(n|ñ)\s+(vou|vo|irei)\s+mais\b/i,
                /\b(nao|não)\s+(vou|vo|irei)\b/i,
                /\b(n|ñ)\s+(vou|vo)\b/i
            ];

            if (padroes.some(p => p.test(msgNormalizada))) {
                const membros = db.list.obterMembrosLista(listaAtiva.id);
                if (membros.some(m => m.id_usuario === senderJid)) {
                    console.log(`[Lista Auto-Saída] ${senderJid} desistiu.`);

                    db.list.removerMembroLista(listaAtiva.id, senderJid);

                    const usuarioLista = db.user.obterUsuario(senderJid);
                    const nomeUsuario = usuarioLista?.nome || senderJid.split('@')[0];

                    const emojisTristes = ['😢', '😭', '🥺', '😔', '😞', '😿', '💔', '🙁', '☹️', '😥'];
                    const emoji = emojisTristes[Math.floor(Math.random() * emojisTristes.length)];

                    await sock.sendMessage(chatJid, { react: { text: emoji, key: msg.key } });

                    const mensagens = [
                        `😮 Eita! Já que você não vai mais, te removi da lista! 👋`,
                        `🤔 Ué, mudou de ideia? Tranquilo! Te tirei da lista já! 😄`,
                        `😱 Pegamos você de surpresa! Como você não vai mais, já te removi da lista! 🎭`,
                        `🎪 Abracadabra! *POOF* 💨\nVocê sumiu da lista! 😂`,
                        `🚀 Entendido! Já que não vai mais, te mandei pra fora da lista! 😜`,
                        `🎯 Pronto! Você foi removido(a) da lista num piscar de olhos! ⚡`,
                        `🌪️ Whoosh! Você desapareceu da lista como mágica! ✨`,
                        `🎭 Que reviravolta! Você saiu da lista antes mesmo de piscar! 👀`,
                        `🎬 Ação! E... cortou! Você não está mais na lista! 🎥`,
                        `🌟 Entendido, chefe! Você foi removido(a) da lista! 🫡`,
                        `🎨 Apagando você da lista... Pronto! Como se nunca tivesse estado aqui! 🖌️`,
                        `⚡ Rapidinho! Você já foi removido(a) da lista! 💨`,
                        `🎪 Truque de mágica: agora você vê, agora não vê mais na lista! 🪄`,
                        `🌈 Puf! Você sumiu da lista como um arco-íris depois da chuva! ☁️`,
                        `🎵 Tchau tchau! Você saiu da lista dançando! 💃`,
                        `🎲 Jogada feita! Você foi removido(a) da lista! 🎰`,
                        `🔮 A bola de cristal previu: você não está mais na lista! ✨`,
                        `🎪 Senhoras e senhores, testemunhem o desaparecimento da lista! 🎩`,
                        `🌟 Missão cumprida! Você foi removido(a) da lista com sucesso! ✅`,
                        `🎯 Alvo atingido! Você saiu da lista! 🏹`,
                        `🚁 Evacuação completa! Você foi retirado(a) da lista! 🆘`,
                        `🎪 E para o nosso próximo truque... você não está mais na lista! 🃏`,
                        `⭐ Estrela cadente! Você passou pela lista e já foi! 💫`,
                        `🎢 Que montanha-russa! Você entrou e já saiu da lista! 🎡`
                    ];
                    const texto = mensagens[Math.floor(Math.random() * mensagens.length)];

                    await sock.sendMessage(chatJid, {
                        text: `${texto}\n\n❌ ${nomeUsuario} não vai mais!`,
                        mentions: [senderJid]
                    }, { quoted: msg });

                    await sock.sendPresenceUpdate('composing', chatJid);
                    await delay(1000);
                    await sock.sendPresenceUpdate('paused', chatJid);

                    const listaCommand = commands.get('lista');
                    if (listaCommand && typeof listaCommand.mostrarLista === 'function') {
                        await listaCommand.mostrarLista(sock, chatJid, db);
                    }
                    return; // Interrompe pipeline
                }
            }
        }
    } catch (error) {
        console.error('[Lista Auto-Saída] Erro:', error);
    }

    await next();
};
