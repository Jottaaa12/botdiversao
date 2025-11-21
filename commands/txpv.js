const { delay } = require('@whiskeysockets/baileys');

/**
 * Executa a lógica de transmissão após a confirmação.
 * @param {object} context - Contexto da execução.
 * @param {object} data - Dados da transmissão preparados anteriormente.
 */
async function executeTransmission(context, data) {
    const { sock, chatJid, db } = context;
    const { targets, messageText } = data;

    await sock.sendMessage(chatJid, { text: `🚀 Iniciando transmissão para ${targets.length} contatos...\n⏳ Tempo estimado: ${Math.ceil((targets.length * 8.5) / 60)} minutos.` });

    let successCount = 0;
    let failCount = 0;

    for (const targetJid of targets) {
        try {
            // Salvar contato no banco de dados para evitar erros
            // O segundo argumento é o nome (null se não soubermos) e o terceiro é histórico (vazio)
            db.salvarUsuario(targetJid, null, []);

            // Enviar mensagem
            await sock.sendMessage(targetJid, { text: messageText });
            successCount++;

            // Delay aleatório entre 7 e 10 segundos
            const waitTime = Math.floor(Math.random() * (10000 - 7000 + 1) + 7000);
            await new Promise(resolve => setTimeout(resolve, waitTime));

        } catch (error) {
            console.error(`[TXPV] Erro ao enviar para ${targetJid}:`, error);
            failCount++;
        }
    }

    await sock.sendMessage(chatJid, {
        text: `✅ Transmissão concluída!\n\n📤 Enviados: ${successCount}\n❌ Falhas: ${failCount}`
    });
}

/**
 * Comando principal para preparar a transmissão.
 */
async function execute({ sock, msg, args, senderJid, chatJid, txpvConfirmations, prefixo }) {
    // Verificar se é admin (já verificado pelo handler, mas reforçando lógica de negócio se necessário)
    // O handler já verifica a permissão baseada na propriedade 'permission' exportada abaixo.

    const isGroup = chatJid.endsWith('@g.us');
    let targets = [];
    let messageText = '';

    // --- LÓGICA DE SELEÇÃO DE ALVOS ---

    if (isGroup) {
        // Caso 1: Usado dentro de um grupo -> Enviar para membros deste grupo
        messageText = args.join(' ');
        if (!messageText && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            messageText = quoted.conversation || quoted.extendedTextMessage?.text || '';
        }

        if (!messageText) {
            return '❌ Por favor, forneça o texto da mensagem ou responda a uma mensagem.\nEx: `' + prefixo + 'txpv Olá membros!`';
        }

        const groupMetadata = await sock.groupMetadata(chatJid);
        // Filtrar o próprio bot e o remetente (opcional, mas bom para não receber a própria msg)
        targets = groupMetadata.participants
            .map(p => p.id)
            .filter(id => id !== sock.user.id && id !== senderJid);

    } else {
        // Caso 2: Usado no PV (Admin/Dono)

        // Reconstruir a string de argumentos original para fazer um split mais robusto
        // Isso é necessário porque o messageHandler faz split(' ') simples
        const fullArgs = args.join(' ');
        const cleanArgs = fullArgs.split(/\s+/).filter(arg => arg.trim() !== '');

        if (cleanArgs.length === 0) {
            // Listar grupos
            const groups = await sock.groupFetchAllParticipating();
            let list = '*Grupos Disponíveis:*\n\n';
            for (const [id, metadata] of Object.entries(groups)) {
                list += `📌 *${metadata.subject}*\n🆔 \`${id}\`\n\n`;
            }
            list += `_Para enviar, use:_\n\`${prefixo}txpv [ID_DO_GRUPO] [MENSAGEM]\`\nOu \`${prefixo}txpv todos [MENSAGEM]\` (Cuidado!)`;
            return list;
        }

        const targetId = cleanArgs[0];
        messageText = cleanArgs.slice(1).join(' ');

        if (!messageText && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            messageText = quoted.conversation || quoted.extendedTextMessage?.text || '';
        }

        if (!messageText) {
            return '❌ Por favor, forneça o texto da mensagem.';
        }

        if (targetId.toLowerCase() === 'todos') {
            // Enviar para TODOS os grupos
            const groups = await sock.groupFetchAllParticipating();
            let allParticipants = new Set();

            for (const metadata of Object.values(groups)) {
                const groupMetadata = await sock.groupMetadata(metadata.id);
                groupMetadata.participants.forEach(p => allParticipants.add(p.id));
            }

            targets = Array.from(allParticipants).filter(id => id !== sock.user.id && id !== senderJid);

        } else if (targetId.endsWith('@g.us')) {
            // Enviar para grupo específico
            try {
                const groupMetadata = await sock.groupMetadata(targetId);
                targets = groupMetadata.participants
                    .map(p => p.id)
                    .filter(id => id !== sock.user.id && id !== senderJid);
            } catch (e) {
                return '❌ Não foi possível encontrar o grupo com este ID. Verifique se o bot está nele.';
            }
        } else {
            return '❌ ID de grupo inválido ou comando incorreto. Certifique-se de que o ID termina com @g.us';
        }
    }

    if (targets.length === 0) {
        return '❌ Nenhum destinatário encontrado.';
    }

    // --- CONFIRMAÇÃO ---

    const estimatedTimeSeconds = targets.length * 8.5; // Média entre 7 e 10
    const estimatedTimeMinutes = (estimatedTimeSeconds / 60).toFixed(1);

    // Salvar estado de confirmação
    txpvConfirmations.set(senderJid, {
        targets,
        messageText,
        timestamp: Date.now()
    });

    return `⚠️ *CONFIRMAÇÃO DE TRANSMISSÃO* ⚠️
    
👥 *Destinatários:* ${targets.length} usuários
⏳ *Tempo Estimado:* ~${estimatedTimeMinutes} minutos
📜 *Mensagem:* "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"

Você tem certeza que deseja enviar?
Responda com *Y* (Sim) ou *N* (Não).`;
}

module.exports = {
    name: 'txpv',
    description: 'Envia mensagem no privado de membros de grupos (Broadcast).',
    category: 'adm',
    permission: 'admin', // Requer ser admin do grupo ou dono do bot
    execute,
    executeTransmission // Exportado para ser chamado pelo handler
};
