const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { model } = require('../config/gemini');

// Função para processar anexos (documentos ou imagens)
async function processarAnexo(msg, sock) {
    let conteudo = '';

    if (msg.message.documentMessage) {
        // Documento
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, sock);
        const mimeType = msg.message.documentMessage.mimetype;
        const fileName = msg.message.documentMessage.fileName || 'Arquivo';

        try {
            if (mimeType === 'application/pdf') {
                // Extrair texto de PDF
                const parser = new PDFParse({ data: buffer });
                const result = await parser.getText();
                conteudo = `Conteúdo do PDF "${fileName}":\n${result.text}`;
            } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                // Extrair texto de DOCX
                const result = await mammoth.extractRawText({ buffer });
                conteudo = `Conteúdo do DOCX "${fileName}":\n${result.value}`;
            } else if (mimeType.startsWith('text/')) {
                // Arquivo de texto
                conteudo = `Conteúdo do arquivo "${fileName}":\n${buffer.toString('utf-8')}`;
            } else {
                // Outros tipos, usar Gemini para analisar
                conteudo = `Arquivo "${fileName}" de tipo ${mimeType}. Conteúdo não extraído diretamente.`;
            }
        } catch (error) {
            console.error('Erro ao processar documento:', error);
            conteudo = `Erro ao processar o arquivo "${fileName}".`;
        }
    } else if (msg.message.imageMessage) {
        // Imagem
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, sock);
        // Usar Gemini para descrever a imagem
        const imagePart = {
            inlineData: {
                data: buffer.toString('base64'),
                mimeType: msg.message.imageMessage.mimetype
            }
        };
        const result = await model.generateContent([`Descreva esta imagem relacionada a um projeto de marketing para açai:`, imagePart]);
        conteudo = `Descrição da imagem:\n${result.response.text()}`;
    }

    return conteudo;
}

module.exports = { processarAnexo };
