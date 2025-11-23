module.exports = {
    name: 'limpar_nomes',
    aliases: ['resetar_nomes', 'clear_names'],
    category: 'admin',
    description: 'Remove todos os nomes salvos do banco de dados (apenas para testes)',
    permission: 'owner',
    async execute({ sock, chatJid, senderJid, db, args }) {
        try {
            // Verifica se não tem argumentos
            if (!args[0]) {
                await sock.sendMessage(chatJid, {
                    text: `⚠️ *ATENÇÃO!* Este comando vai remover TODOS os nomes salvos no banco de dados.\n\n` +
                        `Para confirmar, use:\n` +
                        `*!limpar_nomes confirmar*\n\n` +
                        `Ou para limpar apenas um usuário específico:\n` +
                        `*!limpar_nomes [número]*\n` +
                        `Exemplo: !limpar_nomes 558888814260`
                });
                return;
            }

            // Opção 1: Limpar todos os nomes (requer confirmação)
            const confirmacao = args.join(' ').toLowerCase();

            if (confirmacao === 'confirmar') {
                // Busca todos os usuários e limpa os nomes
                const dbConnection = require('../database/connection');
                const todosUsuarios = dbConnection.prepare('SELECT id_whatsapp FROM usuarios WHERE nome IS NOT NULL').all();

                let contador = 0;
                for (const usuario of todosUsuarios) {
                    db.user.atualizarNomeUsuario(usuario.id_whatsapp, null);
                    contador++;
                }

                await sock.sendMessage(chatJid, {
                    text: `✅ Todos os nomes foram removidos do banco de dados!\n\n` +
                        `📊 Total de nomes removidos: ${contador}\n\n` +
                        `Agora quando os usuários usarem !l, o bot vai pegar o pushName do WhatsApp.`
                });
                return;
            }

            // Opção 2: Limpar nome de um usuário específico
            const targetJid = args[0].includes('@') ? args[0] : `${args[0]}@s.whatsapp.net`;

            // Remove o nome do usuário
            db.user.atualizarNomeUsuario(targetJid, null);

            await sock.sendMessage(chatJid, {
                text: `✅ Nome do usuário ${targetJid.split('@')[0]} foi removido do banco de dados!\n\n` +
                    `Na próxima vez que usar !l, o bot vai pegar o pushName do WhatsApp.`
            });

        } catch (error) {
            console.error('[limpar_nomes] Erro:', error);
            await sock.sendMessage(chatJid, {
                text: `❌ Erro ao limpar nomes do banco de dados:\n${error.message}`
            });
        }
    }
};
