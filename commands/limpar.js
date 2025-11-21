module.exports = {
    name: 'limpar',
    aliases: ['clear'],
    category: 'adm',
    description: 'Limpa o chat enviando mensagens vazias',
    permission: 'admin',
    async execute({ sock, chatJid, args }) {
        const quantidade = parseInt(args[0]) || 50;

        if (quantidade < 1 || quantidade > 100) {
            await sock.sendMessage(chatJid, {
                text: '❌ A quantidade deve ser entre 1 e 100 mensagens.'
            });
            return;
        }

        // Criar mensagem de espaços vazios
        const linhasVazias = '\n'.repeat(quantidade);

        try {
            await sock.sendMessage(chatJid, {
                text: `🧹 *LIMPANDO CHAT*\n${linhasVazias}\n✅ Chat limpo!`
            });
        } catch (error) {
            console.error('[Comando Limpar] Erro ao limpar chat:', error);
            await sock.sendMessage(chatJid, {
                text: '❌ Erro ao limpar o chat. Tente novamente.'
            });
        }
    }
};
