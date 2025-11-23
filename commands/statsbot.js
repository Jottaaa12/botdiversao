const { getPermissionLevel } = require('../utils/auth');

module.exports = {
    name: 'statsbot',
    aliases: ['stbot', 'botstatus', 'configstatus'],
    description: 'Mostra o status das configurações do bot no grupo atual.',
    category: 'adm',
    permission: 'admin',
    async execute({ sock, chatJid, senderJid, db, permissionLevel }) {
        // Apenas admins podem ver as configs
        if (permissionLevel !== 'admin' && permissionLevel !== 'owner') {
            await sock.sendMessage(chatJid, { text: '❌ Apenas administradores podem usar este comando.' });
            return;
        }

        try {
            // Obter configurações do grupo
            const botAtivo = db.config.obterConfiguracaoGrupo(chatJid, 'bot_ativo') !== 'false'; // Padrão true
            const modoSoAdm = db.config.obterConfiguracaoGrupo(chatJid, 'modo_so_adm') === 'true';
            const antiLink = db.config.obterConfiguracaoGrupo(chatJid, 'antilink') === 'true';
            const antiDelete = db.config.obterConfiguracaoGrupo(chatJid, 'antidelete') === 'true';
            const antiEdit = db.config.obterConfiguracaoGrupo(chatJid, 'antiedit') === 'true';
            const boasVindas = db.config.obterConfiguracaoGrupo(chatJid, 'boasvindas') === 'true';

            // Obter prefixo global
            const prefixo = db.config.obterConfiguracao('prefixo') || '/';

            let statusMsg = `🤖 *STATUS DO BOT - ${chatJid.split('@')[0]}* 🤖\n\n`;

            statusMsg += `🔌 *Bot Ativo:* ${botAtivo ? '✅ Sim' : '❌ Não'}\n`;
            statusMsg += `👮 *Modo Só Adm:* ${modoSoAdm ? '✅ Ativado' : '❌ Desativado'}\n`;
            statusMsg += `🔗 *Anti-Link:* ${antiLink ? '✅ Ativado' : '❌ Desativado'}\n`;
            statusMsg += `🗑️ *Anti-Delete:* ${antiDelete ? '✅ Ativado' : '❌ Desativado'}\n`;
            statusMsg += `✏️ *Anti-Edit:* ${antiEdit ? '✅ Ativado' : '❌ Desativado'}\n`;
            statusMsg += `👋 *Boas-Vindas:* ${boasVindas ? '✅ Ativado' : '❌ Desativado'}\n\n`;

            statusMsg += `⚙️ *Prefixo:* ${prefixo}\n`;
            statusMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;

            await sock.sendMessage(chatJid, { text: statusMsg });

        } catch (error) {
            console.error("Erro ao executar statsbot:", error);
            await sock.sendMessage(chatJid, { text: '❌ Ocorreu um erro ao buscar as configurações.' });
        }
    }
};
