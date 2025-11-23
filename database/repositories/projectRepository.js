const db = require('../connection');

// Prepared statements para projetos
const insertProjeto = db.prepare(`
    INSERT INTO projetos (titulo, descricao, arquivos_anexados, analises_geradas, id_usuario)
    VALUES (?, ?, ?, ?, ?)
`);

const getProjetosUsuario = db.prepare(`
    SELECT * FROM projetos WHERE id_usuario = ? ORDER BY criado_em DESC
`);

const updateProjeto = db.prepare(`
    UPDATE projetos SET titulo = ?, descricao = ?, arquivos_anexados = ?, analises_geradas = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
`);

// Prepared statements para documentos
const insertDocumento = db.prepare(`
    INSERT INTO documentos (resumo, metadados, analises, id_usuario)
    VALUES (?, ?, ?, ?)
`);

const getDocumentosUsuario = db.prepare(`
    SELECT * FROM documentos WHERE id_usuario = ? ORDER BY criado_em DESC
`);

const updateDocumento = db.prepare(`
    UPDATE documentos SET resumo = ?, metadados = ?, analises = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
`);

module.exports = {
    // Projetos
    salvarProjeto: (titulo, descricao, arquivos = [], analises = [], idUsuario) => {
        const arquivosStr = JSON.stringify(arquivos);
        const analisesStr = JSON.stringify(analises);
        return insertProjeto.run(titulo, descricao, arquivosStr, analisesStr, idUsuario);
    },

    obterProjetosUsuario: (idUsuario) => {
        const rows = getProjetosUsuario.all(idUsuario);
        return rows.map(row => ({
            ...row,
            arquivos_anexados: JSON.parse(row.arquivos_anexados || '[]'),
            analises_geradas: JSON.parse(row.analises_geradas || '[]')
        }));
    },

    atualizarProjeto: (id, titulo, descricao, arquivos, analises) => {
        const arquivosStr = JSON.stringify(arquivos);
        const analisesStr = JSON.stringify(analises);
        return updateProjeto.run(titulo, descricao, arquivosStr, analisesStr, id);
    },

    // Documentos
    salvarDocumento: (resumo, metadados = {}, analises = {}, idUsuario) => {
        const metadadosStr = JSON.stringify(metadados);
        const analisesStr = JSON.stringify(analises);
        return insertDocumento.run(resumo, metadadosStr, analisesStr, idUsuario);
    },

    obterDocumentosUsuario: (idUsuario) => {
        const rows = getDocumentosUsuario.all(idUsuario);
        return rows.map(row => ({
            ...row,
            metadados: JSON.parse(row.metadados || '{}'),
            analises: JSON.parse(row.analises || '{}')
        }));
    },

    atualizarDocumento: (id, resumo, metadados, analises) => {
        const metadadosStr = JSON.stringify(metadados);
        const analisesStr = JSON.stringify(analises);
        return updateDocumento.run(resumo, metadadosStr, analisesStr, id);
    }
};
