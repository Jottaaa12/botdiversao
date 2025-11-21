const { processarAnexo } = require('../utils/attachmentProcessor');
const { analyzeDocument } = require('../services/geminiService');

/**
 * Lê e analisa o conteúdo de um documento anexado (PDF, DOCX).
 * @param {object} context - O objeto de contexto da mensagem.
 * @param {object} context.msg - O objeto da mensagem original da biblioteca Baileys.
 * @param {object} context.sock - O objeto do socket da conexão Baileys.
 * @returns {Promise<string>} Uma string com a análise do documento ou uma mensagem de erro.
 */
async function executeReadDocument({ msg, sock }) {
    if (!msg.message?.documentMessage) {
        return 'Por favor, envie um documento (PDF ou DOCX) para que eu possa analisá-lo.';
    }

    try {
        await sock.sendMessage(msg.key.remoteJid, { text: '📄 Analisando seu documento... Isso pode levar um momento.' });

        const conteudoAnexo = await processarAnexo(msg, sock);

        if (!conteudoAnexo || conteudoAnexo.startsWith('Erro ao processar')) {
            return 'Erro ao processar o documento. Verifique se o arquivo é um PDF ou DOCX válido e não está corrompido.';
        }

        const fileName = msg.message.documentMessage.fileName || 'Documento';
        const textMatch = conteudoAnexo.match(/Conteúdo do (?:PDF|DOCX) "[^"]+":\n([\s\S]*)/);
        const extractedText = textMatch ? textMatch[1] : conteudoAnexo;

        if (!extractedText || extractedText.trim().length === 0) {
            return 'Não foi possível extrair texto do documento. O arquivo pode estar vazio, ser uma imagem ou estar corrompido.';
        }

        const analise = await analyzeDocument(extractedText, fileName);

        return `*Análise do documento "${fileName}":*\n\n${analise}`;

    } catch (error) {
        console.error('Erro ao executar o comando ler_documento:', error);
        return 'Desculpe, um erro inesperado ocorreu ao processar o documento. Tente novamente.';
    }
}

module.exports = {
    name: 'ler_documento',
    description: 'Lê e analisa o conteúdo de um documento anexado (PDF, DOCX).',
    category: 'adm',
    permission: 'user',
    execute: executeReadDocument,
    aliases: ['ler', 'analisar'],
};
