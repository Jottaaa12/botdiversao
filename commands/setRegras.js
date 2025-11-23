module.exports = {
    name: 'setregras',
    description: 'Define as regras do grupo e atualiza sua descrição. (!setregras [texto])',
    category: 'adm',
    aliases: ['definirregras', 'setdesc', 'novadesc'],
    permission: 'admin',
    async execute({ sock, chatJid, args, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        if (args.length === 0) {
            return 'Você precisa fornecer o texto das regras/descrição. Exemplo: `!setregras Regra 1: ...`';
        }

        const newText = args.join(' ');

        let dbSuccess = false;
        let descSuccess = false;

        // 1. Salva as regras no banco de dados para o comando !regras
        try {
            db.config.salvarConfiguracaoGrupo(chatJid, 'regras', newText);
            dbSuccess = true;
        } catch (error) {
            console.error('[SetRegras DB Error]', error);
        }

        // 2. Atualiza a descrição do grupo no WhatsApp
        try {
            await sock.groupUpdateDescription(chatJid, newText);
            descSuccess = true;
        } catch (error) {
            console.error('[SetRegras Description Error]', error);
        }

        // 3. Monta a resposta final
        if (dbSuccess && descSuccess) {
            return '✅ As regras foram salvas e a descrição do grupo foi atualizada com sucesso!';
        } else if (dbSuccess && !descSuccess) {
            return '⚠️ As regras foram salvas para o comando `!regras`, mas não foi possível atualizar a descrição do grupo. Verifique se eu sou um administrador.';
        } else if (!dbSuccess && descSuccess) {
            return '⚠️ A descrição do grupo foi atualizada, mas ocorreu um erro ao salvar as regras para o comando `!regras`.';
        } else {
            return '❌ Ocorreu um erro tanto ao salvar as regras quanto ao atualizar a descrição do grupo.';
        }
    },
};
