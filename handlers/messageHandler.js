const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { getPermissionLevel } = require('../utils/auth');
const db = require('../database');
const fs = require('fs');
const path = require('path');
const { generateResponse } = require('../services/geminiService');
const { parseNaturalCommand } = require('../services/naturalCommandParser');
const aiService = require('../services/aiService');
const { parseSaleMessage, parseClosingMessage } = require('../services/salesService');
const { handleAntiDelete, handleAntiMute, handleAntiLink, handleAntiEdit } = require('../services/moderationService');

// --- Armazenamento de estado em memória para jogos ---
const roletaRussaGames = new Map();
const forcaGames = new Map();
const joinInProgress = new Map();
// --- Armazenamento de estado para auto-respostas interativas ---
const autoRespostaSteps = new Map();
// --- Armazenamento de estado para agendamento interativo ---
const agendamentoSteps = new Map();
// --- Armazenamento de estado para lista horário interativa ---
const listaHorarioSteps = new Map();
// --- Armazenamento de pedidos de casamento pendentes ---
const pedidosCasamento = new Map(); // Estrutura: usuarioAlvo -> { solicitante, chatJid, timestamp }
// --- Armazenamento de mensagens para antiedit e antidelete ---
const messageStore = new Map(); // Estrutura: messageId -> { content, sender, chatJid, timestamp }

// --- Carregador Dinâmico de Comandos ---
const commands = new Map();
const commandsPath = path.join(__dirname, '../commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('[Command Loader] Carregando comandos...');
for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if (command.name && typeof command.execute === 'function') {
            commands.set(command.name.toLowerCase(), command);
            console.log(`- Comando '${command.name}' carregado.`);

            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach(alias => {
                    commands.set(alias.toLowerCase(), command);
                    console.log(`  - Alias '${alias}' para '${command.name}' registrado.`);
                });
            }
        }

        else {
            console.warn(`[Aviso] O arquivo '${file}' não exporta um comando no formato esperado (name, execute).`);
        }
    } catch (error) {
        console.error(`[Erro] Não foi possível carregar o comando do arquivo ${file}:`, error);
    }
}
console.log(`[Command Loader] ${commands.size} comandos/aliases carregados com sucesso.`);
// --- Fim do Carregador ---

// Funções de parsing movidas para services/salesService.js

function quickCommandFilter(message) {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = message.match(urlRegex);

    if (!urlMatch) {
        return null;
    }

    const url = urlMatch[0];
    const lowerCaseMessage = message.toLowerCase();
    const normalizedMessage = lowerCaseMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Normalize and remove accents

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        if (normalizedMessage.includes('mp3') || normalizedMessage.includes('audio') || normalizedMessage.includes('musica')) {
            return { command: 'ytmp3', argument: url };
        }
        if (normalizedMessage.includes('video') || normalizedMessage.includes('mp4')) {
            return { command: 'ytmp4', argument: url };
        }
        // Default to audio ('play') if no specific format is requested
        return { command: 'play', argument: url };
    }
    if (url.includes('tiktok.com')) return { command: 'tiktok', argument: url };
    if (url.includes('instagram.com')) return { command: 'instagram', argument: url };
    if (url.includes('twitter.com') || url.includes('x.com')) return { command: 'twitter', argument: url };
    if (url.includes('facebook.com') || url.includes('fb.watch')) return { command: 'facebook', argument: url };

    return null;
}

// --- MAPA DE CONFIRMAÇÕES TXPV ---
const txpvConfirmations = new Map();

async function handleMessage(sock, m, { jidNormalizedUser, restartBot }) {
    const msg = m.messages[0];
    if (!msg.message) {
        return;
    }

    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    let senderJid = isGroup ? (msg.participant || msg.key.participant) : msg.key.remoteJid;

    // Normalizar JID para garantir que usamos o número de telefone, não o LID
    if (senderJid && senderJid.includes('@lid')) {
        try {
            // Tenta resolver o LID para PN usando o repositório de sinais do Baileys
            const pnJid = await sock.signalRepository.lidMapping.getPNForLID(senderJid);
            if (pnJid) {
                console.log(`[MessageHandler] Convertendo LID ${senderJid} para PN ${pnJid}`);
                senderJid = pnJid; // Atualiza para o JID do telefone
            } else {
                console.log(`[MessageHandler] Não foi possível resolver o PN para o LID ${senderJid}`);
            }
        } catch (e) {
            console.error(`[MessageHandler] Erro ao normalizar LID ${senderJid}:`, e);
        }
    }

    // Normalizar JID para remover sufixo de dispositivo (:0, :1, etc) e garantir consistência
    if (senderJid) {
        senderJid = jidNormalizedUser(senderJid);
    }

    const chatJid = msg.key.remoteJid;
    const message = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        msg.message?.documentMessage?.caption ||
        '';
    const prefixo = db.config.obterConfiguracao('prefixo') || '/';
    const messageId = msg.key.id;
    const hasAttachment = !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage || msg.message?.audioMessage);

    console.log(`[MessageHandler] Processando mensagem de ${senderJid} em ${chatJid}. Conteúdo: ${message.substring(0, 50)}...`);

    // Debug do mapa de agendamentos
    if (agendamentoSteps.size > 0) {
        console.log(`[Debug Agendamento] Mapa tem ${agendamentoSteps.size} itens. Chaves: ${Array.from(agendamentoSteps.keys()).join(', ')}`);
        console.log(`[Debug Agendamento] SenderJid atual: ${senderJid}. Está no mapa? ${agendamentoSteps.has(senderJid)}`);
    }

    // --- DETECÇÃO DE MENSAGENS DELETADAS (PROTOCOL MESSAGE) ---
    if (await handleAntiDelete(sock, msg, isGroup, chatJid, messageStore, db)) {
        return; // Não processa mais
    }

    // --- ARMAZENAR MENSAGEM PARA ANTIEDIT/ANTIDELETE ---
    if (!msg.key.fromMe) {
        // Detectar tipo de mídia
        const mediaType = msg.message?.imageMessage ? 'image' :
            msg.message?.videoMessage ? 'video' :
                msg.message?.documentMessage ? 'document' :
                    msg.message?.audioMessage ? 'audio' :
                        msg.message?.stickerMessage ? 'sticker' :
                            'text';

        messageStore.set(messageId, {
            content: message || '[Mídia]',
            sender: senderJid,
            chatJid: chatJid,
            timestamp: Date.now(),
            mediaType: mediaType,
            hasMedia: hasAttachment,
            originalMessage: msg.message // Armazena mensagem completa para recuperar mídia
        });

        // Limpar mensagens antigas (mais de 1 hora)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [id, data] of messageStore.entries()) {
            if (data.timestamp < oneHourAgo) {
                messageStore.delete(id);
            }
        }
    }

    // --- VERIFICAÇÃO DE USUÁRIO MUTADO ---
    if (await handleAntiMute(sock, msg, isGroup, chatJid, senderJid, db)) {
        return; // Interrompe o processamento
    }
    // --- FIM DA VERIFICAÇÃO DE USUÁRIO MUTADO ---

    // --- LÓGICA DE TRATAMENTO DE REINICIALIZAÇÃO (PRIORIDADE MÁXIMA) ---
    if (message.toLowerCase().startsWith(prefixo + 'reiniciar')) {
        console.log('[Handler] Comando de reinicialização detectado. Tratamento prioritário.');
        const command = commands.get('reiniciar');
        if (command) {
            const userPermissionLevel = await getPermissionLevel(sock, senderJid);
            const requiredPermission = command.permission || 'user';
            const permissionHierarchy = { 'user': 0, 'admin': 1, 'owner': 2 };

            if (permissionHierarchy[userPermissionLevel] >= permissionHierarchy[requiredPermission]) {
                try {
                    await sock.sendMessage(chatJid, { text: '✅ Comando recebido. O bot será reiniciado...' });
                    // Apenas chama restartBot, que já lida com o fechamento e reinicialização.
                    restartBot();
                } catch (e) {
                    console.error('[Handler] Falha ao enviar confirmação de reinício. O processo de reinicialização pode já ter começado.', e);
                    // Se falhar ao enviar, o restart ainda deve ser tentado.
                    restartBot();
                }
            } else {
                try {
                    await sock.sendMessage(chatJid, { text: '❌ Você não tem permissão para usar este comando.' });
                } catch (e) { /* Ignorar erro de envio se a conexão estiver instável */ }
            }
        }
        return;
    }
    // --- FIM DA LÓGICA DE REINICIALIZAÇÃO ---

    // --- LÓGICA DO JOGO ROLETA RUSSA ---
    const activeGame = roletaRussaGames.get(chatJid);
    if (isGroup && activeGame && senderJid === activeGame.playerJid) {
        const choice = parseInt(message.trim());
        if (!isNaN(choice) && choice >= 1 && choice <= 6) {
            // Limpa o timeout porque o jogador respondeu
            clearTimeout(activeGame.timeoutId);

            if (choice === activeGame.bullet) {
                // O jogador perdeu
                await sock.sendMessage(chatJid, {
                    text: `💥🔫 BANG! O número era *${activeGame.bullet}*.\n\nA sorte não estava com você, @${activeGame.playerJid.split('@')[0]}... Adeus!`,
                    mentions: [activeGame.playerJid]
                });
                await sock.groupParticipantsUpdate(chatJid, [activeGame.playerJid], 'remove');
            } else {
                // O jogador sobreviveu
                await sock.sendMessage(chatJid, {
                    text: `Crick... a câmara estava vazia. O número era *${activeGame.bullet}*.\n\nVocê sobreviveu, @${activeGame.playerJid.split('@')[0]}... por enquanto.`,
                    mentions: [activeGame.playerJid]
                });
            }

            // Limpa o jogo do mapa e encerra o processamento
            roletaRussaGames.delete(chatJid);
            return;
        }
    }
    // --- FIM DA LÓGICA DO JOGO ---

    // --- CORREÇÃO PARA MANTER O BOT "VIVO" ---
    try {
        // Envia o recibo de que a mensagem foi lida.
        const messageKey = {
            remoteJid: msg.key.remoteJid,
            id: msg.key.id,
            participant: msg.key.participant // Necessário para grupos
        };
        await sock.readMessages([messageKey]);
        console.log(`[Receipt] Mensagem ${msg.key.id} de ${messageKey.remoteJid} marcada como lida.`);
    } catch (error) {
        console.error('[Receipt] Erro ao marcar mensagem como lida:', error);
    }
    // --- FIM DA CORREÇÃO ---

    // A variável 'senderJid' agora contém o JID mais confiável que a biblioteca pôde fornecer.
    const permissionLevel = await getPermissionLevel(sock, senderJid);

    // ----------------- INÍCIO: LÓGICA ON/OFF DO BOT -----------------
    if (isGroup) {
        const botAtivo = db.config.obterConfiguracaoGrupo(msg.key.remoteJid, 'bot_ativo');
        // Se a configuração for 'false', o bot está desligado no grupo.
        if (botAtivo === 'false') {
            const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const prefixo = db.config.obterConfiguracao('prefixo') || '/';

            // Verifica se a mensagem é um comando para reativar o bot.
            if (messageText.toLowerCase().startsWith(prefixo)) {
                const commandBody = messageText.substring(prefixo.length).trim();
                const commandName = commandBody.split(' ')[0].toLowerCase();
                const command = commands.get(commandName);

                // Permite apenas que o comando 'on' (e seus aliases) seja executado.
                if (command && command.name === 'on') {
                    // Continua a execução normal, o comando 'on' será processado abaixo.
                } else {
                    // Se o bot estiver desligado e não for o comando 'on', ignora a mensagem.
                    console.log(`[Bot Desativado] Ignorando comando '${commandName}' do grupo ${msg.key.remoteJid}.`);
                    return;
                }
            } else {
                // Ignora qualquer outra mensagem (sem prefixo)
                console.log(`[Bot Desativado] Ignorando mensagem do grupo ${msg.key.remoteJid}.`);
                return;
            }
        }
    }
    // ----------------- FIM: LÓGICA ON/OFF DO BOT -----------------

    // Ignorar mensagens próprias e broadcasts de status
    if (!msg.key.fromMe && (m.type === 'notify' || m.type === 'append') && senderJid !== sock.user.id && msg.key.remoteJid !== 'status@broadcast') {

        // Incrementar contador de mensagens processadas
        db.config.incrementarContador('total_mensagens');

        // Salvar ou atualizar usuário (usando o senderJid real)
        let usuario = db.user.obterUsuario(senderJid);
        if (!usuario) {
            // Novo usuário
            db.user.salvarUsuario(senderJid, msg.pushName || null, []);
            usuario = db.user.obterUsuario(senderJid);
            // Incrementar contador de usuários ativos
            db.config.incrementarContador('usuarios_ativos');
        }

        // Atualizar histórico de interações
        const historico = usuario.historico_interacoes || [];
        historico.push({
            timestamp: new Date().toISOString(),
            mensagem: message || '[Mensagem com anexo]',
            tipo: 'recebida'
        });

        // Manter apenas as últimas 100 interações
        if (historico.length > 100) {
            historico.splice(0, historico.length - 100);
        }

        db.user.atualizarHistoricoUsuario(senderJid, historico);

        // Registrar atividade no grupo (para !ranking e !fantasmas)
        if (isGroup) {
            db.groupInteraction.registrarAtividadeGrupo(chatJid, senderJid);
        }

        // ----------------- INÍCIO: LÓGICA ANTI-LINK (VERSÃO FINAL) -----------------
        if (await handleAntiLink(sock, msg, isGroup, chatJid, senderJid, message, db, getPermissionLevel)) {
            return; // Link detectado e punido
        }
        // ----------------- FIM: LÓGICA ANTI-LINK -----------------

        // Verificar se é uma mensagem de venda e armazenar automaticamente
        if (message) {
            const saleData = parseSaleMessage(message);
            if (saleData) {
                try {
                    db.financial.salvarVenda(
                        saleData.cliente,
                        saleData.pedidoId,
                        saleData.dataHora,
                        saleData.itens,
                        saleData.formaPagamento,
                        saleData.valorPago,
                        saleData.troco,
                        saleData.totalGeral,
                        usuario.id
                    );
                    console.log(`Venda registrada: Pedido ${saleData.pedidoId} - ${saleData.cliente} - R$ ${saleData.totalGeral}`);
                } catch (error) {
                    console.error('Erro ao salvar venda:', error);
                }
            }

            // Verificar se é uma mensagem de fechamento de caixa e armazenar automaticamente
            const closingData = parseClosingMessage(message);
            if (closingData) {
                try {
                    db.financial.salvarFechamentoCaixa(
                        closingData.data,
                        closingData.operador,
                        closingData.horarioInicio,
                        closingData.horarioFim,
                        closingData.sessao,
                        closingData.vendasDinheiro,
                        closingData.qtdVendasDinheiro,
                        closingData.vendasPix,
                        closingData.qtdVendasPix,
                        closingData.totalVendas,
                        closingData.acaiVendido,
                        closingData.movimentacoes,
                        closingData.totalGeral,
                        closingData.fiados,
                        closingData.saldoInicial,
                        closingData.valorEsperado,
                        closingData.valorContado,
                        closingData.diferenca,
                        closingData.tipoDiferenca,
                        usuario.id
                    );
                    console.log(`Fechamento registrado: ${closingData.data} - ${closingData.operador} - Sessão ${closingData.sessao} - R$ ${closingData.totalVendas}`);
                } catch (error) {
                    console.error('Erro ao salvar fechamento:', error);
                }
            }
        }

        // ==================================================================================
        // ÁREA DE INTERCEPTAÇÃO DE FLUXOS INTERATIVOS (PRIORIDADE ALTA)
        // ==================================================================================

        // --- INTERCEPTAÇÃO DE CONFIRMAÇÃO DO TXPV ---
        if (txpvConfirmations.has(senderJid)) {
            const confirmationData = txpvConfirmations.get(senderJid);
            const input = message?.trim().toLowerCase();

            if (Date.now() - confirmationData.timestamp > 120000) {
                txpvConfirmations.delete(senderJid);
                await sock.sendMessage(chatJid, { text: '❌ Tempo de confirmação expirado. Comando cancelado.' });
                return;
            }

            if (input === 'y' || input === 'sim' || input === 's') {
                txpvConfirmations.delete(senderJid);
                const txpvCommand = commands.get('txpv');
                if (txpvCommand && typeof txpvCommand.executeTransmission === 'function') {
                    await txpvCommand.executeTransmission({ sock, chatJid, db }, confirmationData);
                } else {
                    await sock.sendMessage(chatJid, { text: '❌ Erro interno: Comando txpv não encontrado.' });
                }
                return;
            } else if (input === 'n' || input === 'não' || input === 'nao') {
                txpvConfirmations.delete(senderJid);
                await sock.sendMessage(chatJid, { text: '❌ Transmissão cancelada pelo usuário.' });
                return;
            } else {
                await sock.sendMessage(chatJid, { text: '⚠️ Responda com *Y* (Sim) ou *N* (Não) para confirmar a transmissão.' });
                return;
            }
        }

        // --- LÓGICA DE TRATAMENTO DE LISTA HORÁRIO INTERATIVA ---
        if (listaHorarioSteps.has(senderJid)) {
            const command = commands.get('lista_horario');
            if (command) {
                const args = message.trim().split(' ');
                const response = await command.execute({
                    sock,
                    msg,
                    args,
                    senderJid,
                    chatJid,
                    prefixo,
                    db,
                    listaHorarioSteps,
                    isGroup
                });

                if (response && typeof response === 'string') {
                    await sock.sendMessage(chatJid, { text: response });
                }
                return; // Interrompe o processamento normal
            }
        }

        // --- LÓGICA DE TRATAMENTO DE AUTO-RESPOSTA INTERATIVA ---
        if (autoRespostaSteps.has(senderJid)) {
            const command = commands.get('autoresposta');
            if (command) {
                const args = message.trim().split(' ');
                const response = await command.execute({
                    sock,
                    msg,
                    args,
                    senderJid,
                    chatJid,
                    prefixo,
                    db,
                    autoRespostaSteps,
                    isGroup
                });

                if (response && typeof response === 'string') {
                    await sock.sendMessage(chatJid, { text: response });
                }
                return; // Interrompe o processamento normal
            }
        }

        // --- LÓGICA DE TRATAMENTO DE AGENDAMENTO INTERATIVO ---
        if (agendamentoSteps.has(senderJid)) {
            const command = commands.get('agendar');
            if (command) {
                const args = message.trim().split(' ');
                const response = await command.execute({
                    sock,
                    msg,
                    args,
                    senderJid,
                    chatJid,
                    prefixo,
                    db,
                    agendamentoSteps,
                    isGroup
                });

                if (response && typeof response === 'string') {
                    await sock.sendMessage(chatJid, { text: response });
                }
                return; // Interrompe o processamento normal
            }
        }

        // ==================================================================================
        // FIM DA ÁREA DE INTERCEPTAÇÃO
        // ==================================================================================

        // Processar comandos específicos
        let response = '';
        let isCommand = false;

        if (message && message.toLowerCase().startsWith(prefixo)) {
            const commandBody = message.substring(prefixo.length).trim();
            const args = commandBody.split(' ');

            console.log(`[Auth Debug] Verificando permissão para ID: ${senderJid}. Usando a chave: ${senderJid.split('@')[0]}`);

            const commandName = args.shift().toLowerCase();
            console.log(`[Debug] Prefixo: '${prefixo}', Message: '${message}', CommandName: '${commandName}'`);
            console.log(`[Debug] Commands Map Size: ${commands.size}`);
            console.log(`[Debug] Has 'ajuda'? ${commands.has('ajuda')}. Has '${commandName}'? ${commands.has(commandName)}`);

            const command = commands.get(commandName);

            if (command) {
                isCommand = true;
                // Verificação de Permissão
                const requiredPermission = command.permission || 'user'; // 'user' como padrão
                const userPermissionLevel = await getPermissionLevel(sock, senderJid);

                console.log(`[Debug] Comando: ${commandName}, Permissão Necessária: ${requiredPermission}, Nível do Usuário: ${userPermissionLevel}`);

                const permissionHierarchy = {
                    'user': 0,
                    'admin': 1,
                    'owner': 2
                };

                // --- VERIFICAÇÃO DO MODO SO_ADM ---
                if (isGroup) {
                    const modoSoAdm = db.config.obterConfiguracaoGrupo(chatJid, 'modo_so_adm') === 'true';

                    // Se o modo so_adm estiver ativo E o usuário não for admin/owner E não for o próprio comando so_adm
                    if (modoSoAdm &&
                        userPermissionLevel !== 'admin' &&
                        userPermissionLevel !== 'owner' &&
                        command.name !== 'so_adm') {
                        console.log(`[Debug] Modo Só Adm ativo e usuário não é admin. Ignorando.`);
                        // Bot fica silencioso - não dá nenhuma resposta
                        return; // Interrompe o processamento sem enviar mensagem
                    }
                }
                // --- FIM DA VERIFICAÇÃO DO MODO SO_ADM ---

                if (permissionHierarchy[userPermissionLevel] >= permissionHierarchy[requiredPermission]) {
                    try {
                        console.log(`[Debug] Iniciando execução do comando ${commandName}...`);
                        await sock.sendPresenceUpdate('composing', chatJid);
                        // Executa o comando passando um objeto de contexto padronizado
                        response = await command.execute({
                            sock,
                            msg,
                            chatJid,
                            senderJid,
                            message,
                            args,
                            commandName,
                            prefixo,
                            usuario,
                            permissionLevel: userPermissionLevel,
                            db,
                            roletaRussaGames,
                            getPermissionLevel,
                            joinInProgress,
                            restartBot,
                            commands,
                            txpvConfirmations,
                            autoRespostaSteps,
                            agendamentoSteps,
                            forcaGames,
                            listaHorarioSteps,
                            isGroup
                        });
                        console.log(`[Debug] Comando ${commandName} executado. Resposta:`, response ? 'Sim (conteúdo)' : 'Não/Vazia');
                        // Incrementar contador de comandos executados
                        db.config.incrementarContador('comandos_executados');

                        if (response && typeof response === 'string') {
                            await sock.sendMessage(chatJid, { text: response });
                        }
                    } catch (error) {
                        console.error(`[Erro ao Executar Comando] '${commandName}':`, error);
                        response = `😕 Ocorreu um erro ao tentar executar o comando \`${commandName}\`.`;
                    } finally {
                        await sock.sendPresenceUpdate('paused', chatJid);
                    }
                } else {
                    console.log(`[Debug] Permissão negada para ${senderJid} em ${commandName}`);
                    response = "Você não tem permissão para usar este comando.";
                }
            } else {
                isCommand = false;
            }
        }

        if (!message && hasAttachment && msg.message?.documentMessage) {
            // Caso especial para /ler_documento sem texto
            const command = commands.get('ler_documento');
            if (command) {
                isCommand = true;
                try {
                    // O comando 'ler_documento' espera 'msg' e 'sock' no contexto.
                    response = await command.execute({
                        sock,
                        msg,
                        message: '', // message é nulo neste caso
                        args: [],    // sem argumentos
                        commandName: 'ler_documento',
                        prefixo,
                        usuario,
                        permissionLevel,
                        permissionLevel,
                        db,
                        isGroup // Passando isGroup explicitamente
                    });
                } catch (error) {
                    console.error(`[Erro ao Executar Comando] 'ler_documento':`, error);
                    response = `😕 Ocorreu um erro ao tentar analisar o documento.`;
                }
            }
        }

        // --- AUTO-RESPOSTAS ---
        if (!isCommand && isGroup && message) {
            try {
                // Busca todas as respostas do grupo para verificar os tipos de match
                const triggers = db.groupInteraction.listarAutoRespostas(chatJid);
                const msgLower = message.trim().toLowerCase();

                for (const t of triggers) {
                    let match = false;

                    if (t.match_type === 'contains') {
                        if (msgLower.includes(t.gatilho)) match = true;
                    } else {
                        // Default: exact
                        if (msgLower === t.gatilho) match = true;
                    }

                    if (match) {
                        console.log(`[AutoResposta] Gatilho "${t.gatilho}" (${t.match_type}) acionado em ${chatJid}.`);
                        await sock.sendMessage(chatJid, { text: t.resposta }, { quoted: msg });
                        return; // Interrompe o processamento para não acionar IA
                    }
                }
            } catch (error) {
                console.error('[AutoResposta] Erro ao verificar gatilho:', error);
            }
        }
        // --- FIM AUTO-RESPOSTAS ---

        // Se nenhum comando com prefixo foi encontrado, tente identificar comandos de forma inteligente
        if (!isCommand && message) {
            let identifiedCommand = null;
            const urlRegex = /(https?:\/\/[^\s]+)/;
            const hasUrl = urlRegex.test(message);

            // Etapa 1: Tente o filtro rápido, que é otimizado para URLs conhecidas.
            console.log('[MessageHandler] Tentando filtro rápido de links...');
            identifiedCommand = quickCommandFilter(message);

            if (identifiedCommand) {
                console.log('[MessageHandler] Filtro rápido identificou um comando:', identifiedCommand);
            } else if (hasUrl) {
                // Etapa 2: Se o filtro rápido falhou, MAS a mensagem contém uma URL,
                // então vale a pena usar a análise de linguagem natural.
                console.log('[MessageHandler] Filtro rápido não aplicável, mas um link foi detectado. Tentando análise de linguagem natural...');
                identifiedCommand = await parseNaturalCommand(message);
            }
            // Se não houver URL, não fazemos mais nada aqui. A mensagem seguirá para a resposta genérica da IA.

            // Agora, processe o comando identificado (seja do filtro ou da IA)
            if (identifiedCommand && identifiedCommand.command) {
                const commandName = identifiedCommand.command.toLowerCase();
                const command = commands.get(commandName);

                if (command) {
                    isCommand = true;
                    const args = identifiedCommand.argument ? identifiedCommand.argument.split(' ') : [];
                    console.log(`[MessageHandler] Comando identificado. Executando: "${commandName}" com args:`, args);

                    // Verificação de Permissão (reutilizada da lógica de prefixo)
                    const requiredPermission = command.permission || 'user';
                    const userPermissionLevel = await getPermissionLevel(sock, senderJid);
                    const permissionHierarchy = { 'user': 0, 'admin': 1, 'owner': 2 };

                    if (permissionHierarchy[userPermissionLevel] >= permissionHierarchy[requiredPermission]) {
                        try {
                            await sock.sendPresenceUpdate('composing', chatJid);
                            // Executa o comando passando o mesmo objeto de contexto padronizado
                            response = await command.execute({
                                sock,
                                msg,
                                chatJid,
                                senderJid,
                                message, // A mensagem original
                                args,    // Argumentos parseados do comando identificado
                                commandName,
                                prefixo,
                                usuario,
                                permissionLevel: userPermissionLevel,
                                db,
                                roletaRussaGames,
                                getPermissionLevel,
                                joinInProgress,
                                restartBot,
                                commands,
                                agendamentoSteps,
                                isGroup // Passando isGroup explicitamente
                            });
                        } catch (error) {
                            console.error(`[Erro ao Executar Comando Identificado] '${commandName}':`, error);
                            response = `😕 Ocorreu um erro ao tentar executar o comando \`${commandName}\`.`;
                        } finally {
                            await sock.sendPresenceUpdate('paused', chatJid);
                        }
                    } else {
                        response = "Você não tem permissão para usar este comando.";
                    }
                } else {
                    // A IA ou filtro retornou um comando que não existe no mapa.
                    isCommand = false;
                    console.log(`[MessageHandler] Comando identificado "${commandName}" não foi encontrado no mapa de comandos.`);
                }
            } else if (hasUrl) {
                // Se tinha uma URL, tentamos identificar um comando e falhamos (identifiedCommand é nulo ou sem .command).
                // SÓ AGORA podemos mostrar a mensagem de erro específica para links.
                console.log('[MessageHandler] A análise de linguagem natural falhou para uma mensagem com link ou o comando não foi reconhecido.');
                response = `😕 Desculpe, não consegui processar o link fornecido. O serviço de análise pode estar sobrecarregado ou o link não é suportado.\n\nPor favor, tente usar um comando direto. Por exemplo:\n➡️ *${prefixo}play [link do YouTube]*`;
                isCommand = true; // Marcar como comando para evitar a resposta genérica
            }
        }

        // --- RESPOSTA AUTOMÁTICA DA IA EM CONVERSAS PRIVADAS ---
        // A IA só responde automaticamente em conversas privadas (não em grupos)
        // e apenas se o usuário ativou a funcionalidade com /ia on
        if (!isCommand && !isGroup && message) {
            // Verificar se a IA está ativa para este usuário (ativa por padrão)
            const iaAtiva = db.config.obterConfiguracaoUsuario(senderJid, 'ia_ativa');
            const iaHabilitada = iaAtiva === null || iaAtiva === 'true'; // Ativa por padrão se não configurado

            if (iaHabilitada) {
                try {
                    console.log(`[IA] Gerando resposta para ${senderJid} em conversa privada...`);
                    await sock.sendPresenceUpdate('composing', chatJid);

                    // Gerar resposta usando o sistema de histórico
                    response = await aiService.generateResponse(message, usuario, prefixo, senderJid);

                    await sock.sendPresenceUpdate('paused', chatJid);
                } catch (error) {
                    console.error('[IA] Erro ao gerar resposta:', error);
                    response = '🔧 Desculpe, tive um problema ao processar sua mensagem... 😔';
                }
            }
        }

        // Enviar resposta apenas se houver uma resposta a enviar
        if (response && typeof response === 'string') {
            // Atualizar histórico com resposta
            historico.push({
                timestamp: new Date().toISOString(),
                mensagem: response,
                tipo: 'enviada'
            });
            db.user.atualizarHistoricoUsuario(senderJid, historico);

            // Enviar resposta
            await sock.sendMessage(chatJid, { text: response });
            console.log(`Resposta enviada: ${response}`);
        }
    }
}

// Função para lidar com atualizações de mensagens (edições)
async function handleMessageUpdate(sock, updates) {
    await handleAntiEdit(sock, updates, messageStore, db);
}

module.exports = { handleMessage, handleMessageUpdate };
