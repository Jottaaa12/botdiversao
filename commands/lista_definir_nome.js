module.exports = {
    name: 'lista_definir_nome',
    aliases: [],
    category: 'grupo',
    description: 'Define o título padrão para todas as listas futuras do grupo',
    permission: 'admin',
    async execute({ sock, chatJid, args, db }) {
        // Verifica se é um grupo
        if (!chatJid.endsWith('@g.us')) {
            await sock.sendMessage(chatJid, {
                text: '❌ Este comando só pode ser usado em grupos.'
            });
            return;
        }

        // Verifica se foi fornecido um título
        if (args.length === 0) {
            await sock.sendMessage(chatJid, {
                text: '❌ Você precisa fornecer um título!\n\n📝 Uso: !lista_definir_nome NOME DO TÍTULO\n\nExemplo: !lista_definir_nome Churrasco do Sábado'
            });
            return;
        }

        const titulo = args.join(' ');

        try {
            db.definirTituloPadraoLista(chatJid, titulo);

            await sock.sendMessage(chatJid, {
                text: `✅ Título padrão definido!\n\n📋 Todas as novas listas criadas neste grupo terão o título:\n"${titulo}"`
            });
        } catch (error) {
            console.error('[lista_definir_nome] Erro:', error);
            await sock.sendMessage(chatJid, {
                text: '❌ Erro ao definir título padrão. Tente novamente.'
            });
        }
    }
};
