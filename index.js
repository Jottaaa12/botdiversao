const pino = require('pino');
const db = require('./database');
const { handleConnectionUpdate } = require('./handlers/connectionHandler');
const { handleMessage } = require('./handlers/messageHandler');
const { handleGroupUpdate, handleParticipantUpdate } = require('./handlers/groupHandler');

let currentSock = null; // Variável para armazenar a instância do sock
let isRestarting = false; // Flag para controlar o reinício manual

async function initializeBot() {
    const {
        default: makeWASocket,
        DisconnectReason,
        useMultiFileAuthState,
        fetchLatestBaileysVersion,
        jidNormalizedUser
    } = await import('@whiskeysockets/baileys');

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'warn' }),
        browser: ['Baileys', 'Edge', '119.0.0.0'],
    });

    currentSock = sock; // Armazena a instância atual do sock

    sock.ev.on('connection.update', (update) => {
        handleConnectionUpdate(sock, update, initializeBot); // Passa initializeBot para reconexão
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        await handleMessage(sock, m, { jidNormalizedUser, restartBot });
    });

    // Listener para detectar mensagens editadas
    sock.ev.on('messages.update', async (updates) => {
        const { handleMessageUpdate } = require('./handlers/messageHandler');
        await handleMessageUpdate(sock, updates);
    });

    sock.ev.on('groups.upsert', async (groupUpdate) => {
        await handleGroupUpdate(sock, groupUpdate);
    });

    sock.ev.on('group-participants.update', async (update) => {
        await handleParticipantUpdate(sock, update);
    });

    return sock;
}

async function restartBot() {
    isRestarting = true;
    console.log('[Bot Manager] Reiniciando o bot...');
    if (currentSock) {
        console.log('[Bot Manager] Fechando conexão existente...');
        try {
            // Remove listeners para evitar que o handler de 'close' seja chamado durante o reinício manual
            currentSock.ev.removeAllListeners('connection.update');
            await currentSock.end(); // Encerra a conexão atual
            console.log('[Bot Manager] Conexão existente fechada com sucesso.');
        } catch (error) {
            console.error('[Bot Manager] Erro ao fechar conexão existente:', error);
        }
        currentSock = null;
    }
    console.log('[Bot Manager] Iniciando nova conexão...');
    await initializeBot().catch(console.error);
    console.log('[Bot Manager] Bot reiniciado.');
    isRestarting = false;
}

// Inicia a conexão com o WhatsApp
initializeBot().catch(err => console.error("Erro fatal ao iniciar o bot:", err));

// Listeners para fechar o banco de dados de forma segura ao encerrar o processo
process.on('exit', () => {
    if (db && typeof db.fechar === 'function') {
        db.fechar();
        console.log('Banco de dados fechado.');
    }
    if (currentSock) {
        console.log('[Bot Manager] Fechando conexão do WhatsApp ao sair do processo.');
        currentSock.end();
    }
});
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

module.exports = {
    restartBot,
    currentSock,
    isRestarting
};