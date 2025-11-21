const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de configuração
const configPath = path.join(__dirname, '..', 'config.json');

/**
 * Lista todos os administradores configurados no bot.
 * @returns {string} Uma lista formatada dos administradores ou uma mensagem de erro.
 */
function executeListAdmins() {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        if (!config.admins || config.admins.length === 0) {
            return 'Não há administradores configurados.';
        }

        let adminList = `*Lista de Administradores:*

`;
        config.admins.forEach(admin => {
            adminList += `- ${admin}\n`;
        });
        return adminList;

    } catch (error) {
        console.error(`[Comando ListAdmins] Erro ao listar admins:`, error);
        return '❌ Ocorreu um erro ao tentar listar os administradores.';
    }
}

module.exports = {
    name: 'listadmins',
    description: 'Lista todos os administradores do bot.',
    category: 'adm',
    permission: 'owner', // Apenas o dono pode usar
    execute: async ({ sock, msg }) => {
        const adminList = executeListAdmins();
        await sock.sendMessage(msg.key.remoteJid, { text: adminList }, { quoted: msg });
    }
};