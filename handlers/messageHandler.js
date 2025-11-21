const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { getPermissionLevel } = require('../utils/auth');
const db = require('../database');
const fs = require('fs');
const path = require('path');
const { generateResponse } = require('../services/geminiService');
const { parseNaturalCommand } = require('../services/naturalCommandParser');
const aiService = require('../services/aiService');

// --- Armazenamento de estado em memória para jogos ---
const roletaRussaGames = new Map();
const forcaGames = new Map();
const joinInProgress = new Map();
// --- Armazenamento de estado para auto-respostas interativas ---
const autoRespostaSteps = new Map();
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
        } else {
            console.warn(`[Aviso] O arquivo '${file}' não exporta um comando no formato esperado (name, execute).`);
        }
    } catch (error) {
        console.error(`[Erro] Não foi possível carregar o comando do arquivo ${file}:`, error);
    }
}
console.log(`[Command Loader] ${commands.size} comandos/aliases carregados com sucesso.`);
// --- Fim do Carregador ---




// Função para converter formato de data DD/MM/YYYY HH:MM para YYYY-MM-DD HH:MM
function convertDateFormat(dateStr) {
    // "16/11/2025 19:55" -> "2025-11-16 19:55"
    const parts = dateStr.split(' ');
    if (parts.length === 2) {
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
            return `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')} ${parts[1]}`;
        }
    }
    return dateStr; // fallback
}

// Função para parsear mensagem de venda
function parseSaleMessage(message) {
    if (!message.includes('VENDA REALIZADA')) {
        return null;
    }

    const lines = message.split('\n');
    let cliente = '';
    let pedidoId = null;
    let dataHora = '';
    let itens = [];
    let formaPagamento = '';
    let valorPago = 0;
    let troco = 0;
    let totalGeral = 0;

    let currentSection = '';

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.includes('Cliente:')) {
            const index = trimmed.indexOf('Cliente:') + 'Cliente:'.length;
            cliente = trimmed.substring(index).trim().replace(/^\*|\*$/g, '').trim();
        } else if (trimmed.includes('Pedido:')) {
            const index = trimmed.indexOf('Pedido:') + 'Pedido:'.length;
            pedidoId = parseInt(trimmed.substring(index).trim().replace(/^\*|\*$/g, '').trim());
        } else if (trimmed.includes('Data/Hora:')) {
            const index = trimmed.indexOf('Data/Hora:') + 'Data/Hora:'.length;
            dataHora = trimmed.substring(index).trim().replace(/^\*|\*$/g, '').trim();
        } else if (trimmed.includes('ITENS')) {
            currentSection = 'itens';
        } else if (trimmed.includes('PAGAMENTO')) {
            currentSection = 'pagamento';
        } else if (trimmed.includes('TOTAL GERAL:')) {
            const index = trimmed.indexOf('TOTAL GERAL:') + 'TOTAL GERAL:'.length;
            const totalStr = trimmed.substring(index).replace('R$', '').trim().replace(/^\*|\*$/g, '').trim();
            totalGeral = parseFloat(totalStr.replace(',', '.'));
        } else if (currentSection === 'itens' && trimmed.startsWith('-')) {
            // Parse item: "AÇAI NO KG (0.248 kg) - R$ 12.40"
            const itemText = trimmed.substring(1).trim();
            const parts = itemText.split(' - R$ ');
            if (parts.length === 2) {
                const descricao = parts[0].trim();
                const preco = parseFloat(parts[1].replace(',', '.'));
                itens.push({ descricao, preco });
            }
        } else if (currentSection === 'pagamento') {
            if (trimmed.includes('Forma:')) {
                const index = trimmed.indexOf('Forma:') + 'Forma:'.length;
                formaPagamento = trimmed.substring(index).trim().replace(/^\*|\*$/g, '').trim();
            } else if (trimmed.includes('Valor Pago:')) {
                const index = trimmed.indexOf('Valor Pago:') + 'Valor Pago:'.length;
                const valorStr = trimmed.substring(index).replace('R$', '').trim().replace(/^\*|\*$/g, '').trim();
                valorPago = parseFloat(valorStr.replace(',', '.'));
            } else if (trimmed.includes('Troco:')) {
                const index = trimmed.indexOf('Troco:') + 'Troco:'.length;
                const trocoStr = trimmed.substring(index).replace('R$', '').trim().replace(/^\*|\*$/g, '').trim();
                troco = parseFloat(trocoStr.replace(',', '.'));
            }
        }
    }

    // Validar se todos os campos essenciais foram encontrados
    if (!cliente || !pedidoId || !dataHora || itens.length === 0 || !formaPagamento || totalGeral === 0) {
        return null;
    }

    // Converter formato da data para YYYY-MM-DD HH:MM
    dataHora = convertDateFormat(dataHora);

    return {
        cliente,
        pedidoId,
        dataHora,
        itens,
        formaPagamento,
        valorPago,
        troco,
        totalGeral
    };
}

// Função para parsear mensagem de fechamento de caixa
function parseClosingMessage(message) {
    if (!message.includes('❌ FECHAMENTO DE CAIXA ❌')) {
        return null;
    }

    const lines = message.split('\n');
    let data = '';
    let operador = '';
    let horarioInicio = '';
    let horarioFim = '';
    let sessao = '';
    let vendasDinheiro = 0;
    let qtdVendasDinheiro = 0;
    let vendasPix = 0;
    let qtdVendasPix = 0;
    let totalVendas = 0;
    let acaiVendido = 0;
    let movimentacoes = [];
    let totalGeral = 0;
    let fiados = [];
    let saldoInicial = 0;
    let valorEsperado = 0;
    let valorContado = 0;
    let diferenca = 0;
    let tipoDiferenca = '';

    let currentSection = '';

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('📅 Data:')) {
            data = trimmed.replace('📅 Data:', '').trim();
        } else if (trimmed.startsWith('👤 Operador:')) {
            operador = trimmed.replace('👤 Operador:', '').trim();
        } else if (trimmed.startsWith('🕐 Horário:')) {
            const horarioStr = trimmed.replace('🕐 Horário:', '').trim();
            const partes = horarioStr.split(' às ');
            if (partes.length === 2) {
                horarioInicio = partes[0].trim();
                horarioFim = partes[1].trim();
            }
        } else if (trimmed.startsWith('🆔 Sessão:')) {
            sessao = trimmed.replace('🆔 Sessão:', '').trim();
        } else if (trimmed.startsWith('VENDAS REALIZADAS:')) {
            currentSection = 'vendas';
        } else if (trimmed.startsWith('💰 TOTAL DAS VENDAS:')) {
            const totalStr = trimmed.replace('💰 TOTAL DAS VENDAS:', '').replace('R$', '').trim();
            totalVendas = parseFloat(totalStr.replace(',', '.'));
        } else if (trimmed.startsWith('⚖ Açaí Vendido:')) {
            const acaiStr = trimmed.replace('⚖ Açaí Vendido:', '').replace('kg', '').trim();
            acaiVendido = parseFloat(acaiStr.replace(',', '.'));
        } else if (trimmed.startsWith('💸 MOVIMENTAÇÕES DE CAIXA:')) {
            currentSection = 'movimentacoes';
        } else if (trimmed.startsWith('💵 TOTAL GERAL')) {
            currentSection = 'total_geral';
        } else if (trimmed.startsWith('📝 FIADO (CRÉDITO):')) {
            currentSection = 'fiados';
        } else if (trimmed.startsWith('💵 RESUMO FINAL:')) {
            currentSection = 'resumo';
        } else if (currentSection === 'vendas' && trimmed.startsWith('• Dinheiro:')) {
            const dinheiroStr = trimmed.replace('• Dinheiro:', '').replace('R$', '').trim();
            const partes = dinheiroStr.split('(');
            if (partes.length === 2) {
                vendasDinheiro = parseFloat(partes[0].trim().replace(',', '.'));
                qtdVendasDinheiro = parseInt(partes[1].replace('vendas)', '').trim());
            }
        } else if (currentSection === 'vendas' && trimmed.startsWith('• PIX:')) {
            const pixStr = trimmed.replace('• PIX:', '').replace('R$', '').trim();
            const partes = pixStr.split('(');
            if (partes.length === 2) {
                vendasPix = parseFloat(partes[0].trim().replace(',', '.'));
                qtdVendasPix = parseInt(partes[1].replace('vendas)', '').trim());
            }
        } else if (currentSection === 'movimentacoes' && trimmed.startsWith('•')) {
            const movText = trimmed.substring(1).trim();
            if (movText !== 'Nenhuma movimentação registrada.') {
                movimentacoes.push({ descricao: movText });
            }
        } else if (currentSection === 'total_geral' && trimmed.includes('Vendas ± Movimentações):')) {
            const totalStr = trimmed.split(':')[1].replace('R$', '').trim();
            totalGeral = parseFloat(totalStr.replace(',', '.'));
        } else if (currentSection === 'fiados' && trimmed.startsWith('•')) {
            const fiadoText = trimmed.substring(1).trim();
            const partes = fiadoText.split(': R$ ');
            if (partes.length === 2) {
                const cliente = partes[0].trim();
                const valor = parseFloat(partes[1].replace(',', '.'));
                fiados.push({ cliente, valor });
            }
        } else if (currentSection === 'resumo' && trimmed.startsWith('• Saldo Inicial:')) {
            const saldoStr = trimmed.replace('• Saldo Inicial:', '').replace('R$', '').trim();
            saldoInicial = parseFloat(saldoStr.replace(',', '.'));
        } else if (currentSection === 'resumo' && trimmed.startsWith('• Valor Esperado:')) {
            const esperadoStr = trimmed.replace('• Valor Esperado:', '').replace('R$', '').trim();
            valorEsperado = parseFloat(esperadoStr.replace(',', '.'));
        } else if (currentSection === 'resumo' && trimmed.startsWith('• Valor Contado:')) {
            const contadoStr = trimmed.replace('• Valor Contado:', '').replace('R$', '').trim();
            valorContado = parseFloat(contadoStr.replace(',', '.'));
        } else if (currentSection === 'resumo' && trimmed.startsWith('⚠ Diferença:')) {
            const diferencaStr = trimmed.replace('⚠ Diferença:', '').trim();
            if (diferencaStr.includes('Sobra:')) {
                tipoDiferenca = 'sobra';
                const valorStr = diferencaStr.replace('Sobra:', '').replace('+R$', '').trim();
                diferenca = parseFloat(valorStr.replace(',', '.'));
            } else if (diferencaStr.includes('Falta:')) {
                tipoDiferenca = 'falta';
                const valorStr = diferencaStr.replace('Falta:', '').replace('-R$', '').trim();
                diferenca = -parseFloat(valorStr.replace(',', '.'));
            }
        }
    }

    // Validar se todos os campos essenciais foram encontrados
    if (!data || !operador || !sessao || totalVendas === 0) {
        return null;
    }

    return {
        data,
        operador,
        horarioInicio,
        horarioFim,
        sessao,
        vendasDinheiro,
        qtdVendasDinheiro,
        vendasPix,
        qtdVendasPix,
        totalVendas,
        acaiVendido,
        movimentacoes,
        totalGeral,
        fiados,
        saldoInicial,
        valorEsperado,
        valorContado,
        diferenca,
        tipoDiferenca
    };
}

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
    const senderJid = isGroup ? (msg.participant || msg.key.participant) : msg.key.remoteJid;
    const chatJid = msg.key.remoteJid;
    const message = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const prefixo = db.obterConfiguracao('prefixo') || '/';
    const messageId = msg.key.id;
    const hasAttachment = !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage || msg.message?.audioMessage);

    // --- DETECÇÃO DE MENSAGENS DELETADAS (PROTOCOL MESSAGE) ---
    if (msg.message?.protocolMessage?.type === 0) { // Type 0 = REVOKE (delete)
        const deletedMessageId = msg.message.protocolMessage.key.id;
        const antideleteEnabled = isGroup && db.obterConfiguracaoGrupo(chatJid, 'antidelete') === 'true';

        if (antideleteEnabled && messageStore.has(deletedMessageId)) {
            const deletedMsg = messageStore.get(deletedMessageId);
            const senderName = deletedMsg.sender.split('@')[0];

            try {
                await sock.sendMessage(chatJid, {
                    text: `🗑️ *@${senderName}* deletou esta mensagem:\n\n"${deletedMsg.content}"`,
                    mentions: [deletedMsg.sender]
                });
                console.log(`[ANTIDELETE] Mensagem deletada recuperada em ${chatJid}`);
            } catch (error) {
                console.error('[ANTIDELETE] Erro ao reenviar mensagem deletada:', error);
            }
        }
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

    // --- INTERCEPTAÇÃO DE CONFIRMAÇÃO TXPV (REMOVIDA DAQUI) ---
    // (Movida para após a verificação de fromMe para evitar loop infinito)

    // --- VERIFICAÇÃO DE USUÁRIO MUTADO ---
    if (isGroup && await db.isMuted(senderJid, chatJid)) {
        console.log(`[MUTE] Mensagem de usuário mutado (${senderJid}) no grupo (${chatJid}) detectada. Apagando mensagem.`);
        try {
            await sock.sendMessage(chatJid, { delete: msg.key });
            return; // Interrompe o processamento da mensagem mutada
        } catch (error) {
            console.error('[MUTE] Erro ao apagar mensagem de usuário mutado:', error);
            // Continua a execução para evitar que o bot trave, mas a mensagem não será apagada
        }
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
        // Encerra a função aqui para evitar qualquer processamento adicional.
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
        // Isso é crucial para o WhatsApp continuar enviando eventos de mensagem em tempo real.
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
        const botAtivo = db.obterConfiguracaoGrupo(msg.key.remoteJid, 'bot_ativo');
        // Se a configuração for 'false', o bot está desligado no grupo.
        if (botAtivo === 'false') {
            const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const prefixo = db.obterConfiguracao('prefixo') || '/';

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



    // Obter prefixo atual (já declarado no início da função)

    // Ignorar mensagens próprias e broadcasts de status
    if (!msg.key.fromMe && (m.type === 'notify' || m.type === 'append') && senderJid !== sock.user.id && msg.key.remoteJid !== 'status@broadcast') {
        const chatJid = msg.key.remoteJid;
        const message = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        // Verificar se há anexos na mensagem
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
                // Carrega o comando txpv dinamicamente para evitar dependência circular ou problemas de carregamento
                const txpvCommand = commands.get('txpv');
                if (txpvCommand && typeof txpvCommand.executeTransmission === 'function') {
                    await txpvCommand.executeTransmission({ sock, chatJid, db }, confirmationData);
                } else {
                    await sock.sendMessage(chatJid, { text: '❌ Erro interno: Comando txpv não encontrado.' });
                }
                return; // Interrompe o processamento normal
            } else if (input === 'n' || input === 'não' || input === 'nao') {
                txpvConfirmations.delete(senderJid);
                await sock.sendMessage(chatJid, { text: '❌ Transmissão cancelada pelo usuário.' });
                return; // Interrompe o processamento normal
            } else {
                // Se não for Y nem N, ignora e deixa o usuário tentar novamente ou o timeout expirar
                // Ou pode retornar aqui para evitar que o bot processe como outro comando
                // Vamos retornar para forçar a decisão
                await sock.sendMessage(chatJid, { text: '⚠️ Responda com *Y* (Sim) ou *N* (Não) para confirmar a transmissão.' });
                return;
            }
        }
        // --- FIM DA INTERCEPTAÇÃO ---

        // Incrementar contador de mensagens processadas
        db.incrementarContador('total_mensagens');

        // Salvar ou atualizar usuário (usando o senderJid real)
        let usuario = db.obterUsuario(senderJid);
        if (!usuario) {
            // Novo usuário
            db.salvarUsuario(senderJid, msg.pushName || null, []);
            usuario = db.obterUsuario(senderJid);
            // Incrementar contador de usuários ativos
            db.incrementarContador('usuarios_ativos');
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

        db.atualizarHistoricoUsuario(senderJid, historico);

        // ----------------- INÍCIO: LÓGICA ANTI-LINK (VERSÃO FINAL) -----------------
        if (isGroup && message) {
            const antilinkEnabled = db.obterConfiguracaoGrupo(chatJid, 'antilink') === 'true';
            if (antilinkEnabled) {
                const urlRegex = /https?:\/\/[^\s]+/;
                if (urlRegex.test(message)) {
                    try {
                        const groupMetadata = await sock.groupMetadata(chatJid);

                        // Verifica se o remetente é admin
                        const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
                        const isSenderGroupAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
                        const userBotPermission = await getPermissionLevel(sock, senderJid);
                        const isSenderBotAdmin = userBotPermission === 'owner' || userBotPermission === 'admin';

                        // Se o remetente NÃO for admin, aplicar a punição
                        if (!isSenderGroupAdmin && !isSenderBotAdmin) {
                            // --- Verificação de Admin do Bot (Lógica Corrigida) ---
                            const botPnJid = jidNormalizedUser(sock.user.id);
                            let botIsAdmin = false;
                            for (const p of groupMetadata.participants) {
                                if (p.admin === 'admin' || p.admin === 'superadmin') {
                                    let adminId = p.id;
                                    if (adminId.endsWith('@lid')) {
                                        try {
                                            const resolved = await sock.signalRepository.lidMapping.getPNForLID(adminId);
                                            if (resolved) adminId = resolved;
                                        } catch (e) { /* Ignora se não conseguir resolver */ }
                                    }
                                    if (jidNormalizedUser(adminId) === botPnJid) {
                                        botIsAdmin = true;
                                        break;
                                    }
                                }
                            }
                            // --- Fim da Verificação ---

                            if (botIsAdmin) {
                                console.log(`[Anti-Link] Link detectado de não-admin (${senderJid}). Removendo...`);
                                await sock.sendMessage(chatJid, { delete: msg.key });
                                await sock.groupParticipantsUpdate(chatJid, [senderJid], 'remove');
                                await sock.sendMessage(chatJid, {
                                    text: `🚫 *@${senderJid.split('@')[0]}* foi removido por enviar um link.`,
                                    mentions: [senderJid]
                                });
                                return;
                            } else {
                                console.log(`[Anti-Link] Ação cancelada. O bot não tem permissões de admin no grupo para remover membros.`);
                            }
                        } else {
                            console.log(`[Anti-Link] Link enviado por um administrador (${senderJid}). Nenhuma ação foi tomada.`);
                        }
                    } catch (error) {
                        console.error('[Anti-Link] Erro na execução do anti-link:', error);
                    }
                }
            }
        }
        // ----------------- FIM: LÓGICA ANTI-LINK -----------------
        // ----------------- FIM: LÓGICA ANTI-LINK -----------------

        // Verificar se é uma mensagem de venda e armazenar automaticamente
        if (message) {
            const saleData = parseSaleMessage(message);
            if (saleData) {
                try {
                    db.salvarVenda(
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
                    db.salvarFechamentoCaixa(
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

        // --- LÓGICA DE TRATAMENTO DE AUTO-RESPOSTA INTERATIVA ---
        const autoRespostaStep = autoRespostaSteps.get(senderJid);
        if (autoRespostaStep && autoRespostaStep.chatJid === chatJid) {
            const resposta = message.trim();
            if (resposta) {
                try {
                    db.adicionarAutoResposta(autoRespostaStep.trigger, resposta, chatJid, senderJid);
                    await sock.sendMessage(chatJid, {
                        text: `✅ Auto-resposta configurada!\n\n🗣️ *Gatilho:* "${autoRespostaStep.trigger}"\n🤖 *Resposta:* "${resposta}"`
                    });
                } catch (error) {
                    console.error('Erro ao salvar auto-resposta interativa:', error);
                    await sock.sendMessage(chatJid, { text: '❌ Erro ao salvar auto-resposta. Tente novamente.' });
                }
                autoRespostaSteps.delete(senderJid);
                return; // Interrompe o processamento
            }
        }

        // Processar comandos específicos
        let response = '';
        let isCommand = false;

        if (message && message.toLowerCase().startsWith(prefixo)) {
            const commandBody = message.substring(prefixo.length).trim();
            const args = commandBody.split(' ');

            console.log(`[Auth Debug] Verificando permissão para ID: ${senderJid}. Usando a chave: ${senderJid.split('@')[0]}`);

            const commandName = args.shift().toLowerCase();

            const command = commands.get(commandName);

            if (command) {
                isCommand = true;
                // Verificação de Permissão
                const requiredPermission = command.permission || 'user'; // 'user' como padrão
                const userPermissionLevel = await getPermissionLevel(sock, senderJid);

                const permissionHierarchy = {
                    'user': 0,
                    'admin': 1,
                    'owner': 2
                };

                // --- VERIFICAÇÃO DO MODO SO_ADM ---
                if (isGroup) {
                    const modoSoAdm = db.obterConfiguracaoGrupo(chatJid, 'modo_so_adm') === 'true';

                    // Se o modo so_adm estiver ativo E o usuário não for admin/owner E não for o próprio comando so_adm
                    if (modoSoAdm &&
                        userPermissionLevel !== 'admin' &&
                        userPermissionLevel !== 'owner' &&
                        command.name !== 'so_adm') {
                        // Bot fica silencioso - não dá nenhuma resposta
                        return; // Interrompe o processamento sem enviar mensagem
                    }
                }
                // --- FIM DA VERIFICAÇÃO DO MODO SO_ADM ---

                if (permissionHierarchy[userPermissionLevel] >= permissionHierarchy[requiredPermission]) {
                    try {
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
                            forcaGames
                        });
                        // Incrementar contador de comandos executados
                        db.incrementarContador('comandos_executados');
                    } catch (error) {
                        console.error(`[Erro ao Executar Comando] '${commandName}':`, error);
                        response = `😕 Ocorreu um erro ao tentar executar o comando \`${commandName}\`.`;
                    } finally {
                        await sock.sendPresenceUpdate('paused', chatJid);
                    }
                } else {
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
                        db
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
                const autoResponse = db.obterAutoResposta(message.trim(), chatJid);
                if (autoResponse) {
                    console.log(`[AutoResposta] Gatilho "${autoResponse.gatilho}" acionado em ${chatJid}.`);
                    await sock.sendMessage(chatJid, { text: autoResponse.resposta }, { quoted: msg });
                    return; // Interrompe o processamento para não acionar IA
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
                                restartBot, // Adicionado aqui
                                commands
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

        // A lógica de resposta genérica da IA foi removida para ser ativada apenas por comando.

        // Enviar resposta apenas se houver uma resposta a enviar
        if (response && typeof response === 'string') {
            // Atualizar histórico com resposta
            historico.push({
                timestamp: new Date().toISOString(),
                mensagem: response,
                tipo: 'enviada'
            });
            db.atualizarHistoricoUsuario(senderJid, historico);

            // Enviar resposta
            await sock.sendMessage(chatJid, { text: response });
            console.log(`Resposta enviada: ${response}`);
        }
    }
}

// Função para lidar com atualizações de mensagens (edições)
async function handleMessageUpdate(sock, updates) {
    for (const update of updates) {
        const { key, update: messageUpdate } = update;

        // Verificar se é uma edição de mensagem
        if (messageUpdate?.message) {
            const messageId = key.id;
            const chatJid = key.remoteJid;
            const isGroup = chatJid.endsWith('@g.us');

            console.log('[ANTIEDIT DEBUG] Mensagem editada detectada!');
            console.log('[ANTIEDIT DEBUG] Message ID:', messageId);

            // Verificar se o antiedit está ativo
            const antieditEnabled = isGroup && db.obterConfiguracaoGrupo(chatJid, 'antiedit') === 'true';
            console.log('[ANTIEDIT DEBUG] Anti-edit ativo?', antieditEnabled);
            console.log('[ANTIEDIT DEBUG] Mensagem está no store?', messageStore.has(messageId));

            if (antieditEnabled && messageStore.has(messageId)) {
                const originalMsg = messageStore.get(messageId);
                const senderJid = key.participant || key.remoteJid;
                const senderName = senderJid.split('@')[0];

                // Extrair o novo conteúdo da mensagem editada
                // O conteúdo editado está em editedMessage.message, não diretamente em message
                const editedContent = messageUpdate.message?.editedMessage?.message?.conversation ||
                    messageUpdate.message?.editedMessage?.message?.extendedTextMessage?.text ||
                    '';

                console.log('[ANTIEDIT DEBUG] Conteúdo original:', originalMsg.content);
                console.log('[ANTIEDIT DEBUG] Conteúdo editado:', editedContent);

                // Verificar se houve mudança no conteúdo
                if (originalMsg.content !== editedContent && editedContent) {
                    try {
                        await sock.sendMessage(chatJid, {
                            text: `✏️ *@${senderName}* editou a mensagem!\n\n📜 *Original:*\n"${originalMsg.content}"\n\n📝 *Editada para:*\n"${editedContent}"`,
                            mentions: [senderJid]
                        });
                        console.log(`[ANTIEDIT] Edição revelada em ${chatJid}`);

                        // Atualizar o conteúdo armazenado
                        messageStore.set(messageId, {
                            ...originalMsg,
                            content: editedContent
                        });
                    } catch (error) {
                        console.error('[ANTIEDIT] Erro ao revelar mensagem editada:', error);
                    }
                }
            }
        }
    }
}

module.exports = { handleMessage, handleMessageUpdate };
