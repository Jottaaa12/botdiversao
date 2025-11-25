const raffleAIService = require('../../services/raffleAIService');

module.exports = async (context, next) => {
    const { sessionManager, senderJid, commands, message, sock, chatJid, db, isGroup, prefixo, msg } = context;

    // 1. Verifica sessão genérica (Agendamento, Listas, etc.)
    const session = sessionManager.getInteractiveSession(senderJid);

    if (session) {
        const { type, map } = session;
        console.log(`[InteractiveSession] Sessão ativa do tipo '${type}' para ${senderJid}`);

        // Tratamento especial para confirmação de TXPV (não é um comando padrão com execute)
        if (type === 'txpv') {
            const confirmationData = session.data;
            const input = message?.trim().toLowerCase();

            if (Date.now() - confirmationData.timestamp > 120000) {
                map.delete(senderJid);
                await sock.sendMessage(chatJid, { text: '❌ Tempo de confirmação expirado.' });
                return;
            }

            if (['y', 'sim', 's'].includes(input)) {
                map.delete(senderJid);
                const txpvCommand = commands.get('txpv');
                if (txpvCommand && typeof txpvCommand.executeTransmission === 'function') {
                    await txpvCommand.executeTransmission({ sock, chatJid, db }, confirmationData);
                }
                return;
            } else if (['n', 'não', 'nao'].includes(input)) {
                map.delete(senderJid);
                await sock.sendMessage(chatJid, { text: '❌ Transmissão cancelada.' });
                return;
            } else {
                await sock.sendMessage(chatJid, { text: '⚠️ Responda com *Y* (Sim) ou *N* (Não).' });
                return;
            }
        }

        // Tratamento especial para confirmação de RIFA (Admin)
        if (type === 'rifa_confirmation') {
            const input = message.trim().toLowerCase();
            if (['s', 'sim'].includes(input)) {
                await raffleAIService.processarConfirmacaoAdmin(sock, chatJid, senderJid, 'confirmar', db);
                map.delete(senderJid);
                return;
            } else if (['n', 'nao', 'não'].includes(input)) {
                await raffleAIService.processarConfirmacaoAdmin(sock, chatJid, senderJid, 'recusar', db);
                map.delete(senderJid);
                return;
            }
        }

        // Tratamento para comandos padrão (agendar, lista_horario, etc.)
        // Mapeia o tipo de sessão para o nome do comando
        const commandMap = {
            'autoresposta': 'autoresposta',
            'agendar': 'agendar',
            'lista_horario': 'lista_horario',
            'lista_abertura': 'lista_abertura',
            'rifa': 'rifa'
        };

        const commandName = commandMap[type];
        if (commandName) {
            const command = commands.get(commandName);
            if (command) {
                const args = message.trim().split(' ');

                // Injeta os mapas no contexto para compatibilidade com comandos antigos
                const legacyContext = {
                    ...context,
                    args,
                    // Passa os mapas individuais do sessionManager
                    ...sessionManager
                };

                const response = await command.execute(legacyContext);
                if (response && typeof response === 'string') {
                    await sock.sendMessage(chatJid, { text: response });
                }
                return; // Interrompe o pipeline pois a sessão tratou a mensagem
            }
        }
    }

    // Tratamento de Jogo (Roleta Russa)
    // Roleta Russa usa um mapa por CHAT, não por USER (geralmente)
    // Mas o código original verifica: activeGame = roletaRussaGames.get(chatJid)
    const activeGame = sessionManager.roletaRussaGames.get(chatJid);
    if (isGroup && activeGame && senderJid === activeGame.playerJid) {
        const choice = parseInt(message.trim());
        if (!isNaN(choice) && choice >= 1 && choice <= 6) {
            clearTimeout(activeGame.timeoutId);
            if (choice === activeGame.bullet) {
                await sock.sendMessage(chatJid, {
                    text: `💥🔫 BANG! O número era *${activeGame.bullet}*.\n\nAdeus, @${activeGame.playerJid.split('@')[0]}!`,
                    mentions: [activeGame.playerJid]
                });
                await sock.groupParticipantsUpdate(chatJid, [activeGame.playerJid], 'remove');
            } else {
                await sock.sendMessage(chatJid, {
                    text: `Crick... O número era *${activeGame.bullet}*.\n\nVocê sobreviveu!`,
                    mentions: [activeGame.playerJid]
                });
            }
            sessionManager.roletaRussaGames.delete(chatJid);
            return;
        }
    }

    // Tratamento de Foto do Bot (ConfigurarBot)
    if (msg.message?.imageMessage) {
        const configurarbotCommand = commands.get('configurarbot');
        // Verifica se o comando tem photoStates e se o usuário está nele
        // Nota: Isso depende de como configurarbot gerencia seu estado. 
        // Se ele usa um Map interno estático, precisamos acessá-lo.
        if (configurarbotCommand && configurarbotCommand.photoStates && configurarbotCommand.photoStates.has(senderJid)) {
            const photoResponse = await configurarbotCommand.handlePhotoMessage(sock, senderJid, msg);
            if (photoResponse) {
                await sock.sendMessage(chatJid, { text: photoResponse });
                return;
            }
        }
    }

    await next();
};
