module.exports = {
    name: 'reiniciar',
    aliases: ['restart'],
    description: 'Reinicia o processo do bot.',
    category: 'adm',
    permission: 'owner', // Apenas o owner pode usar este comando
    async execute({ sock, chatJid, restartBot }) {
        try {
            await sock.sendMessage(chatJid, { text: '⏳ Reiniciando o bot... Isso pode levar alguns segundos.' });
            const result = await restartBot();
            // A mensagem de sucesso ou falha será tratada pela função restartBot ou pelo tratamento de erro.
            // Não é necessário retornar 'result' aqui, pois o bot reiniciará.
            // Se a função restartBot retornar algo, pode ser logado ou tratado, mas não enviado como resposta.
        } catch (error) {
            console.error('[Comando Reiniciar] Erro ao tentar reiniciar o bot:', error);
            // Envia uma mensagem de erro se a tentativa de reinício falhar.
            await sock.sendMessage(chatJid, { text: '❌ Ocorreu um erro ao tentar reiniciar o bot.' });
        }
    },
};