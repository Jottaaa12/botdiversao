const Tiktok = require("@tobyg74/tiktok-api-dl");

async function execute({ sock, msg, args }) {
    const username = args[0];
    const sender = msg.key.remoteJid;

    if (!username) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Digite o nome de usuário!\n\nExemplo: .tiktokprofile @usuario' });
    }

    // Remover @ se presente
    const cleanUsername = username.replace('@', '');

    try {
        console.log('Obtendo perfil do TikTok...');
        const result = await Tiktok.StalkUser(cleanUsername);

        if (result.status !== "success" || !result.result) {
            throw new Error(result.message || 'Erro ao obter perfil');
        }

        const user = result.result.user;
        const stats = result.result.stats;

        let response = `👤 *PERFIL TIKTOK*\n\n`;
        response += `*Nome:* ${user.nickname}\n`;
        response += `*Usuário:* @${user.username}\n`;
        response += `*Bio:* ${user.signature || 'N/A'}\n`;
        response += `*Verificado:* ${user.verified ? '✅' : '❌'}\n`;
        response += `*Região:* ${user.region || 'N/A'}\n\n`;

        response += `📊 *ESTATÍSTICAS*\n`;
        response += `*Seguidores:* ${stats.followerCount?.toLocaleString() || 'N/A'}\n`;
        response += `*Seguindo:* ${stats.followingCount?.toLocaleString() || 'N/A'}\n`;
        response += `*Curtidas:* ${stats.heartCount?.toLocaleString() || 'N/A'}\n`;
        response += `*Vídeos:* ${stats.videoCount?.toLocaleString() || 'N/A'}\n`;

        return sock.sendMessage(sender, { text: response });

    } catch (error) {
        console.error('Erro no comando .tiktokprofile:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível obter o perfil do TikTok.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'tiktokprofile',
    description: 'Exibe o perfil de um usuário do TikTok.',
    category: 'Downloads',
    permission: 'user',
    execute,
    aliases: ['tkprofile'],
};
