function execute({ msg }) {
    // O messageTimestamp é em segundos (pode ser um Long), converter para milissegundos
    const messageTimestampMs = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : msg.messageTimestamp.low) * 1000;
    const latency = Date.now() - messageTimestampMs;

    return `🏓 *PONG!*

*Latência:* ${latency}ms
*Servidor:* Online ✅
*Status:* Operacional`;
}

module.exports = {
    name: 'ping',
    description: 'Verifica a latência do bot e o status do servidor.',
    category: 'utilitario',
    permission: 'user',
    execute,
};
