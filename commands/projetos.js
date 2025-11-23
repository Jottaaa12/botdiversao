const db = require('../database');

/**
 * Lista todos os projetos de um usuário.
 * @param {object} context - O objeto de contexto da mensagem.
 * @param {object} context.usuario - O objeto do usuário que enviou o comando.
 * @returns {string} Uma lista dos projetos do usuário ou uma mensagem informativa.
 */
function executeListProjects({ usuario }) {
    try {
        const projetos = db.project.obterProjetosUsuario(usuario.id);

        if (!projetos || projetos.length === 0) {
            return 'Você ainda não tem nenhum projeto cadastrado. Use `/projeto Título: Descrição` para criar um.';
        }

        let projectList = '*Seus Projetos:*\n\n';
        projetos.forEach(p => {
            projectList += `*▶️ ${p.titulo}*\n`;
            projectList += `   - _${p.descricao}_\n\n`;
        });
        return projectList;

    } catch (error) {
        console.error(`[Comando Projetos] Erro ao listar projetos para ${usuario.id}:`, error);
        return '❌ Ocorreu um erro ao tentar listar seus projetos.';
    }
}

module.exports = {
    name: 'projetos',
    description: 'Lista todos os seus projetos cadastrados.',
    category: 'adm',
    permission: 'admin',
    execute: executeListProjects,
    aliases: ['meusprojetos'],
};

