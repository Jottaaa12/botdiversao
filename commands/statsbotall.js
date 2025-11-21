const { getPermissionLevel } = require('../utils/auth');
const os = require('os');

module.exports = {
    name: 'statsbotall',
    aliases: ['fullstats', 'botinfo', 'debugbot'],
    description: 'Exibe estatísticas completas do bot, do grupo e do sistema.',
    category: 'adm',
    permission: 'admin',
    async execute({ sock, chatJid, senderJid, db, permissionLevel, msg }) {
        // Apenas admins podem ver as configs
        if (permissionLevel !== 'admin' && permissionLevel !== 'owner') {
            await sock.sendMessage(chatJid, { text: '❌ Apenas administradores podem usar este comando.' });
            return;
        }

        try {
            await sock.sendMessage(chatJid, { react: { text: "📊", key: msg.key } });

            // 1. Informações do Grupo
            let groupStats = '';
            if (chatJid.endsWith('@g.us')) {
                const metadata = await sock.groupMetadata(chatJid);
                const admins = metadata.participants.filter(p => p.admin).length;
                const members = metadata.participants.length;
                const creationDate = new Date(metadata.creation * 1000).toLocaleDateString('pt-BR');
                const creator = metadata.owner ? `@${metadata.owner.split('@')[0]}` : 'Desconhecido';
                const desc = metadata.desc ? metadata.desc.toString().slice(0, 50) + (metadata.desc.toString().length > 50 ? '...' : '') : 'Sem descrição';

                groupStats = `🏢 *GRUPO*\n` +
                    `Nome: ${metadata.subject}\n` +
                    `Membros: ${members} (Admins: ${admins})\n` +
                    `Criado em: ${creationDate}\n` +
                    `Criador: ${creator}\n` +
                    `Descrição: ${desc}\n`;
            } else {
                groupStats = `🏢 *GRUPO*\nEste comando não foi executado em um grupo.\n`;
            }

            // 2. Configurações Atuais (Resumo)
            const botAtivo = db.obterConfiguracaoGrupo(chatJid, 'bot_ativo') !== 'false';
            const antilink = db.obterConfiguracaoGrupo(chatJid, 'antilink') === 'true';
            const antidelete = db.obterConfiguracaoGrupo(chatJid, 'antidelete') === 'true';
            const antiedit = db.obterConfiguracaoGrupo(chatJid, 'antiedit') === 'true';

            const configStats = `⚙️ *CONFIGURAÇÕES*\n` +
                `Bot Ativo: ${botAtivo ? '✅' : '❌'} | Anti-Link: ${antilink ? '✅' : '❌'}\n` +
                `Anti-Delete: ${antidelete ? '✅' : '❌'} | Anti-Edit: ${antiedit ? '✅' : '❌'}\n`;

            // 3. Dados de Moderação (DB)
            const warnings = db.obterAdvertenciasGrupo(chatJid).length;
            const mutes = db.obterMutadosGrupo(chatJid).length;
            const autoResponses = db.listarAutoRespostas(chatJid).length;
            // Estatísticas Globais
            const globalStats = db.getStats();

            const dbStats = `🛡️ *MODERAÇÃO & DADOS*\n` +
                `Advertências Ativas: ${warnings}\n` +
                `Usuários Mutados: ${mutes}\n` +
                `Auto-Respostas: ${autoResponses}\n` +
                `Total Usuários (Global): ${globalStats.totalUsers}\n` +
                `Banidos (Global): ${globalStats.bannedUsers}\n`;

            // 4. Informações do Sistema
            const uptimeSeconds = process.uptime();
            const uptime = formatUptime(uptimeSeconds);
            const memoryUsage = process.memoryUsage();
            const ramUsed = (memoryUsage.rss / 1024 / 1024).toFixed(2); // MB
            const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2); // GB
            const platform = os.platform();
            const cpu = os.cpus()[0].model;

            // Ping estimado
            const messageTimestamp = msg.messageTimestamp;
            // Se messageTimestamp for Long (objeto), converta para número, senão use direto
            const msgTime = typeof messageTimestamp === 'object' ? messageTimestamp.low : messageTimestamp;
            const now = Math.floor(Date.now() / 1000);
            const ping = now - msgTime;

            const systemStats = `💻 *SISTEMA*\n` +
                `Uptime: ${uptime}\n` +
                `RAM: ${ramUsed} MB / ${totalMem} GB\n` +
                `OS: ${platform}\n` +
                `Ping: ~${ping}s\n`;

            // Montar mensagem final
            const finalMessage = `📊 *RELATÓRIO COMPLETO DO BOT* 📊\n\n` +
                `${groupStats}\n` +
                `${configStats}\n` +
                `${dbStats}\n` +
                `${systemStats}\n` +
                `_Gerado em: ${new Date().toLocaleString('pt-BR')}_`;

            await sock.sendMessage(chatJid, {
                text: finalMessage,
                mentions: chatJid.endsWith('@g.us') ? [await sock.groupMetadata(chatJid).then(m => m.owner).catch(() => null)].filter(Boolean) : []
            });

        } catch (error) {
            console.error("Erro ao executar statsbotall:", error);
            await sock.sendMessage(chatJid, { text: '❌ Ocorreu um erro ao gerar o relatório completo.' });
        }
    }
};

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);

    const dDisplay = d > 0 ? d + (d == 1 ? " dia, " : " dias, ") : "";
    const hDisplay = h > 0 ? h + (h == 1 ? " hora, " : " horas, ") : "";
    const mDisplay = m > 0 ? m + (m == 1 ? " minuto, " : " minutos, ") : "";
    const sDisplay = s > 0 ? s + (s == 1 ? " segundo" : " segundos") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}
