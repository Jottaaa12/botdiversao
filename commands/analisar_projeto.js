const db = require('../database');
const { model } = require('../config/gemini');
const { processarAnexo } = require('../utils/attachmentProcessor');

/**
 * Analisa um projeto de marketing usando o Gemini.
 * O projeto pode ser descrito no comando, enviado como anexo, ou ser um projeto existente (usando seu ID).
 * @param {object} context - O objeto de contexto da mensagem.
 * @returns {Promise<string>} Uma string com a análise do projeto ou uma mensagem de erro.
 */
async function executeAnalyzeProject({ args, msg, sock, usuario }) {
    const commandBody = args.join(' ');
    let projetoDescricao = commandBody;

    await sock.sendMessage(msg.key.remoteJid, { text: '🔎 Analisando seu projeto... Isso pode levar alguns instantes.' });

    // 1. Processar anexo, se houver
    let conteudoAnexo = '';
    if (msg.message?.documentMessage || msg.message?.imageMessage) {
        try {
            conteudoAnexo = await processarAnexo(msg, sock);
        } catch (error) {
            console.error('[Comando Analisar] Erro ao processar anexo:', error);
            // Não retorna erro, apenas avisa no log e continua sem o anexo
        }
    }

    // 2. Combinar descrição do comando com conteúdo do anexo
    if (conteudoAnexo) {
        projetoDescricao = projetoDescricao
            ? `${projetoDescricao}\n\n--- CONTEÚDO DO ANEXO ---\n${conteudoAnexo}`
            : conteudoAnexo;
    }

    // 3. Verificar se o argumento é um ID de um projeto existente
    const projetosUsuario = db.project.obterProjetosUsuario(usuario.id);
    const projetoExistente = projetosUsuario.find(p => p.id == parseInt(commandBody));

    // Se for um ID válido e não havia outra descrição, usa a descrição do projeto salvo
    if (projetoExistente && !conteudoAnexo && args.length === 1) {
        projetoDescricao = projetoExistente.descricao;
    }

    // 4. Gerar e executar a análise
    if (projetoDescricao) {
        try {
            const prompt = `Você é um especialista em marketing de açaí. Analise o seguinte projeto e forneça recomendações detalhadas, incluindo uma análise SWOT (Forças, Fraquezas, Oportunidades, Ameaças), previsões de sucesso e sugestões práticas de melhoria. Projeto: "${projetoDescricao}"`;
            const result = await model.generateContent(prompt);
            const analise = result.response.text();

            // 5. Salvar a análise no projeto, se ele já existia
            if (projetoExistente) {
                const analises = projetoExistente.analises_geradas || [];
                analises.push({
                    tipo: 'analise_gemini',
                    timestamp: new Date().toISOString(),
                    conteudo: analise
                });
                db.project.atualizarProjeto(projetoExistente.id, projetoExistente.titulo, projetoExistente.descricao, projetoExistente.arquivos_anexados, analises);
            }

            return `*Análise de Projeto:*

${analise}`;
        } catch (error) {
            console.error('[Comando Analisar] Erro ao chamar a API Gemini:', error);
            return 'Desculpe, houve um erro ao contatar o serviço de análise. Tente novamente mais tarde.';
        }
    } else {
        return 'Por favor, forneça uma descrição, um anexo, ou o ID de um projeto existente.\nEx: `/analisar_projeto Nova campanha de marketing para o verão`\nOu: `/analisar_projeto 1`';
    }
}

module.exports = {
    name: 'analisar_projeto',
    description: 'Usa IA para analisar um projeto (descrito, anexado ou por ID).',
    category: 'adm',
    permission: 'user',
    execute: executeAnalyzeProject,
    aliases: ['analisarprojeto', 'analiseprojeto'],
};
