const db = require('../database');

/**
 * Exibe as estatísticas de uso do bot.
 * @returns {string} Uma string formatada com as estatísticas.
 */
function executeStats() {
  try {
    const stats = db.config.getStats();
    return `*📊 Estatísticas do Bot*

👥 *Usuários:*
- *Totais:* ${stats.totalUsers}
- *Banidos:* ${stats.bannedUsers}
- *Ativos:* ${stats.activeUsers}

💬 *Mensagens:*
- *Processadas:* ${stats.messagesProcessed}
- *Comandos Executados:* ${stats.commandsExecuted}

👥 *Grupos:* ${stats.totalGroups}`;
  } catch (error) {
    console.error('[Comando Stats] Erro ao buscar estatísticas:', error);
    return '❌ Erro ao buscar as estatísticas.';
  }
}

module.exports = {
  name: 'stats',
  description: 'Mostra estatísticas de uso do bot.',
  category: 'adm',
  permission: 'admin', // Apenas admins e donos podem usar
  execute: executeStats,
};
