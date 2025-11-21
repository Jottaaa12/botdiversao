const db = require('../database');

/**
 * Cria um novo projeto para o usuário.
 * @param {object} context - O objeto de contexto da mensagem.
 * @param {string[]} context.args - Argumentos do comando, no formato "Título: Descrição".
 * @param {object} context.usuario - O objeto do usuário que enviou o comando.
 * @returns {string} Uma mensagem de confirmação ou erro.
 */
function executeCreateProject({ args, usuario }) {
    const commandBody = args.join(' ');
    const parts = commandBody.split(':');

    if (parts.length < 2) {
        return 'Formato incorreto. Use: `/projeto Título do Projeto: Descrição detalhada do projeto`';
    }

    const titulo = parts[0].trim();
    const descricao = parts.slice(1).join(':').trim();

    if (!titulo || !descricao) {
        return 'Título e descrição não podem estar vazios. Use: `/projeto Título: Descrição`';
    }

    try {
        db.salvarProjeto(titulo, descricao, [], [], usuario.id);
        return `✅ Projeto "${titulo}" criado com sucesso!`;
    } catch (error) {
        console.error(`[Comando Projeto] Erro ao criar projeto para ${usuario.id}:`, error);
        return '❌ Ocorreu um erro ao tentar criar seu projeto.';
    }
}

module.exports = {
    name: 'projeto',
    description: 'Cria um novo projeto. Formato: /projeto Título: Descrição',
    category: 'adm',
    permission: 'admin',
    execute: executeCreateProject,
};
