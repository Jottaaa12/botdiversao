/**
 * Módulo para gerenciar o estado da conexão do bot com o WhatsApp
 * Centraliza a verificação de conexão para uso em agendadores e outros serviços
 */

let connectionState = {
    isConnected: false,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    reconnectCount: 0
};

/**
 * Atualiza o estado da conexão
 * @param {boolean} connected - Se está conectado ou não
 */
function setConnectionState(connected) {
    const wasConnected = connectionState.isConnected;
    connectionState.isConnected = connected;

    if (connected) {
        connectionState.lastConnectedAt = new Date();
        if (!wasConnected) {
            connectionState.reconnectCount++;
            console.log(`✅ [ConnectionStatus] Conexão estabelecida (Reconexão #${connectionState.reconnectCount})`);
        }
    } else {
        connectionState.lastDisconnectedAt = new Date();
        if (wasConnected) {
            console.log('⚠️ [ConnectionStatus] Conexão perdida');
        }
    }
}

/**
 * Verifica se o bot está conectado
 * @returns {boolean}
 */
function isConnected() {
    return connectionState.isConnected;
}

/**
 * Retorna o estado completo da conexão
 * @returns {Object}
 */
function getConnectionState() {
    return { ...connectionState };
}

/**
 * Verifica se é possível enviar mensagens
 * @param {Object} sock - Instância do socket do Baileys
 * @returns {boolean}
 */
function canSendMessages(sock) {
    // Verifica múltiplas condições para garantir que podemos enviar mensagens
    const hasConnection = connectionState.isConnected;
    const hasSock = sock !== null && sock !== undefined;
    const hasUser = hasSock && sock.user && sock.user.id;

    if (!hasConnection) {
        return false;
    }

    if (!hasSock) {
        console.warn('⚠️ [ConnectionStatus] Socket não disponível');
        return false;
    }

    if (!hasUser) {
        console.warn('⚠️ [ConnectionStatus] Usuário não autenticado');
        return false;
    }

    return true;
}

/**
 * Retorna informações sobre o tempo de conexão/desconexão
 * @returns {Object}
 */
function getConnectionInfo() {
    const now = new Date();
    let info = {
        isConnected: connectionState.isConnected,
        reconnectCount: connectionState.reconnectCount
    };

    if (connectionState.isConnected && connectionState.lastConnectedAt) {
        const uptime = Math.floor((now - connectionState.lastConnectedAt) / 1000);
        info.uptimeSeconds = uptime;
        info.uptimeFormatted = formatUptime(uptime);
    }

    if (!connectionState.isConnected && connectionState.lastDisconnectedAt) {
        const downtime = Math.floor((now - connectionState.lastDisconnectedAt) / 1000);
        info.downtimeSeconds = downtime;
        info.downtimeFormatted = formatUptime(downtime);
    }

    return info;
}

/**
 * Formata tempo em segundos para formato legível
 * @param {number} seconds 
 * @returns {string}
 */
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

module.exports = {
    setConnectionState,
    isConnected,
    getConnectionState,
    canSendMessages,
    getConnectionInfo
};
