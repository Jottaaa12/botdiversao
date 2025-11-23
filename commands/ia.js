module.exports = {
    name: 'ia',
    aliases: ['ai', 'conversar'],
    category: 'utilidades',
    description: 'Faz perguntas à IA (grupos) ou ativa/desativa respostas automáticas (PV)',
    permission: 'user',
    async execute({ sock, chatJid, args, senderJid, db, isGroup, prefixo, usuario }) {
        // Obtém o prefixo atual do banco de dados
        const prefix = prefixo || db.config.obterConfiguracao('prefixo') || '/';

        // --- EM GRUPOS: Permite fazer perguntas à IA ---
        if (isGroup) {
            const pergunta = args.join(' ');

            if (!pergunta) {
                await sock.sendMessage(chatJid, {
                    text: `🤖 *Como usar a IA em grupos:*\n\n` +
                        `Use: \`${prefix}ia <sua pergunta>\`\n\n` +
                        `*Exemplos:*\n` +
                        `• ${prefix}ia O que é fotossíntese?\n` +
                        `• ${prefix}ia Me ajuda com matemática\n` +
                        `• ${prefix}ia Qual a capital da França?`
                });
                return;
            }

            // Gerar resposta da IA
            try {
                await sock.sendPresenceUpdate('composing', chatJid);
                const aiService = require('../services/aiService');
                const resposta = await aiService.generateResponse(pergunta, usuario, prefix, senderJid);
                await sock.sendPresenceUpdate('paused', chatJid);

                await sock.sendMessage(chatJid, {
                    text: `🤖 *Resposta da IA:*\n\n${resposta}`
                });
            } catch (error) {
                console.error('[Comando IA] Erro ao gerar resposta:', error);
                await sock.sendMessage(chatJid, {
                    text: '🔧 Desculpe, tive um problema ao processar sua pergunta... 😔'
                });
            }
            return;
        }

        // --- EM PV: Controla ativação/desativação da IA automática ---
        const subcomando = args[0] ? args[0].toLowerCase() : null;

        // Se não passar argumento, mostra status atual
        if (!subcomando) {
            const iaAtiva = db.config.obterConfiguracaoUsuario(senderJid, 'ia_ativa');
            const status = iaAtiva === 'true' || iaAtiva === null; // Ativa por padrão

            await sock.sendMessage(chatJid, {
                text: `🤖 *STATUS DA IA*\n\n` +
                    `Status: ${status ? '✅ Ativa' : '❌ Desativada'}\n\n` +
                    `*Comandos:*\n` +
                    `• \`${prefix}ia on\` - Ativa a IA\n` +
                    `• \`${prefix}ia off\` - Desativa a IA\n` +
                    `• \`${prefix}ia limpar\` - Limpa histórico de conversa\n\n` +
                    `💡 Quando ativa, eu respondo automaticamente suas mensagens aqui no PV!`
            });
            return;
        }

        // Ativar IA
        if (subcomando === 'on' || subcomando === 'ativar' || subcomando === 'ligar') {
            db.config.definirConfiguracaoUsuario(senderJid, 'ia_ativa', 'true');
            await sock.sendMessage(chatJid, {
                text: '🔧 *IA Ativada!* 🤖\n\n' +
                    'Agora vou responder automaticamente suas mensagens aqui no privado.\n\n' +
                    'Pode me perguntar qualquer coisa! 😊\n\n' +
                    `💡 Use \`${prefix}ia off\` para desativar quando quiser.`
            });
            return;
        }

        // Desativar IA
        if (subcomando === 'off' || subcomando === 'desativar' || subcomando === 'desligar') {
            db.config.definirConfiguracaoUsuario(senderJid, 'ia_ativa', 'false');
            await sock.sendMessage(chatJid, {
                text: '😔 *IA Desativada*\n\n' +
                    'Não vou mais responder automaticamente suas mensagens.\n\n' +
                    `Mas ainda posso executar comandos quando você usar o prefixo \`${prefix}\`\n\n` +
                    `💡 Use \`${prefix}ia on\` para me reativar!`
            });
            return;
        }

        // Limpar histórico
        if (subcomando === 'limpar' || subcomando === 'clear' || subcomando === 'reset') {
            const { clearUserHistory } = require('../services/geminiService');
            clearUserHistory(senderJid);

            await sock.sendMessage(chatJid, {
                text: '🧹 *Histórico Limpo!*\n\n' +
                    'Esqueci toda nossa conversa anterior.\n\n' +
                    'Vamos começar do zero! 🔄'
            });
            return;
        }

        // Se não for nenhum subcomando reconhecido, trata como pergunta
        const pergunta = args.join(' ');
        try {
            await sock.sendPresenceUpdate('composing', chatJid);
            const aiService = require('../services/aiService');
            const resposta = await aiService.generateResponse(pergunta, usuario, prefix, senderJid);
            await sock.sendPresenceUpdate('paused', chatJid);

            await sock.sendMessage(chatJid, {
                text: `🤖 *Resposta:*\n\n${resposta}`
            });
        } catch (error) {
            console.error('[Comando IA] Erro ao gerar resposta:', error);
            await sock.sendMessage(chatJid, {
                text: '🔧 Desculpe, tive um problema ao processar sua pergunta... 😔'
            });
        }
    }
};