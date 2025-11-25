const { generateResponse } = require('../../services/geminiService');
const raffleAIService = require('../../services/raffleAIService');

module.exports = async (context, next) => {
    const { isGroup, message, msg, senderJid, db, prefixo, sock, chatJid, sessionManager } = context;
    const { rifaConfirmationSteps } = sessionManager;

    // A IA só responde em privado (não grupo) e se não for comando
    if (isGroup) return; // Se for grupo, ignora (ou implementa lógica de menção ao bot)

    const isMedia = msg.message?.imageMessage || msg.message?.documentMessage;

    if (message || isMedia) {
        const iaAtiva = db.config.obterConfiguracaoUsuario(senderJid, 'ia_ativa');
        const iaHabilitada = iaAtiva === null || iaAtiva === 'true';

        if (iaHabilitada) {
            try {
                console.log(`[IA] Gerando resposta para ${senderJid}...`);
                await sock.sendPresenceUpdate('composing', chatJid);

                let response = '';

                // Verifica sessão de rifa
                const sessaoRifa = db.raffle.obterSessaoCompra(senderJid, null);
                if (sessaoRifa) {
                    const rifaResponse = await raffleAIService.continuarProcessoCompra(sock, chatJid, senderJid, message, msg, db, rifaConfirmationSteps);
                    if (rifaResponse) response = rifaResponse;
                } else if (message) {
                    // Tenta detectar rifa
                    if (raffleAIService.detectarInteresseRifa(message)) {
                        const rifaResponse = await raffleAIService.processarInteresse(sock, chatJid, senderJid, db, message);
                        if (rifaResponse) response = rifaResponse;
                    } else {
                        // Gemini
                        // Coletar contexto da rifa (opcional)
                        let contextoRifa = null;
                        try {
                            let rifa = db.raffle.obterRifaAtiva(chatJid);
                            if (!rifa) rifa = db.raffle.obterRifaAtivaGlobal();
                            if (rifa) {
                                contextoRifa = {
                                    rifa,
                                    numerosUsuario: db.raffle.obterNumerosComprados(rifa.id, senderJid),
                                    compraPendente: db.raffle.obterCompraPendenteAguardandoConfirmacao(senderJid)
                                };
                            }
                        } catch (e) { }

                        const usuario = db.user.obterUsuario(senderJid);
                        const aiResponse = await generateResponse(message, usuario, prefixo, senderJid, contextoRifa);

                        if (aiResponse === "##RIFA_DETECTED##") {
                            const rifaResponse = await raffleAIService.processarInteresse(sock, chatJid, senderJid, db, message);
                            if (rifaResponse) response = rifaResponse;
                        } else {
                            response = aiResponse;
                        }
                    }
                }

                if (response && typeof response === 'string') {
                    await sock.sendMessage(chatJid, { text: response });

                    // Atualiza histórico
                    const usuario = db.user.obterUsuario(senderJid);
                    if (usuario) {
                        const historico = usuario.historico_interacoes || [];
                        historico.push({
                            timestamp: new Date().toISOString(),
                            mensagem: response,
                            tipo: 'enviada'
                        });
                        db.user.atualizarHistoricoUsuario(senderJid, historico);
                    }
                }

            } catch (error) {
                console.error('[IA] Erro:', error);
            } finally {
                await sock.sendPresenceUpdate('paused', chatJid);
            }
        }
    }

    await next();
};
