const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

async function execute({ sock, msg, args }) {
    const jid = msg.key.remoteJid;
    const text = args.join(' ');
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    // --- Detecção de Mídia ---
    const imageInQuote = quoted?.imageMessage;
    const videoInQuote = quoted?.videoMessage;
    const imageInCurrent = msg.message?.imageMessage;
    const videoInCurrent = msg.message?.videoMessage;

    let mediaToProcess = null;
    let mediaType = '';

    if (imageInQuote) { mediaToProcess = imageInQuote; mediaType = 'image'; }
    else if (videoInQuote) { mediaToProcess = videoInQuote; mediaType = 'video'; }
    else if (imageInCurrent) { mediaToProcess = imageInCurrent; mediaType = 'image'; }
    else if (videoInCurrent) { mediaToProcess = videoInCurrent; mediaType = 'video'; }

    // --- Paths para arquivos temporários ---
    // Usa o diretório do projeto (um nível acima de commands)
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const inputPath = path.join(tempDir, `sticker_in_${Date.now()}`);
    const outputPath = path.join(tempDir, `sticker_out_${Date.now()}.webp`);

    try {
        // --- Lógica para Sticker de Imagem ---
        if (mediaType === 'image') {
            const stream = await downloadContentFromMessage(mediaToProcess, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const processedImage = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp()
                .toBuffer();

            await sock.sendMessage(jid, { sticker: processedImage }, { quoted: msg });
            return;
        }

        // --- Lógica para Sticker de Vídeo ---
        if (mediaType === 'video') {
            const stream = await downloadContentFromMessage(mediaToProcess, 'video');
            const writeStream = fs.createWriteStream(inputPath);
            for await (const chunk of stream) {
                writeStream.write(chunk);
            }
            writeStream.end();

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-vf', "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,fps=15,pad=512:512:(512-iw)/2:(512-ih)/2:0x00000000",
                        '-loop', '0',
                        '-ss', '00:00:00.0',
                        '-t', '00:00:07.0',
                        '-preset', 'default',
                        '-an',
                        '-vsync', '0',
                    ])
                    .toFormat('webp')
                    .save(outputPath)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err));
            });

            await sock.sendMessage(jid, { sticker: { url: outputPath } }, { quoted: msg });

            // Limpeza
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            return;
        }

        // --- Lógica para Sticker de Texto ---
        if (text) {
            const svgText = `
                <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                    <style>
                        .title {
                            fill: white;
                            font-size: 45px;
                            font-family: 'Helvetica Neue', sans-serif;
                            font-weight: bold;
                            text-anchor: middle;
                            paint-order: stroke;
                            stroke: black;
                            stroke-width: 3px;
                        }
                    </style>
                    <text x="50%" y="50%" dy=".35em" class="title">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
                </svg>
            `;

            const svgBuffer = Buffer.from(svgText);

            const processedImage = await sharp(svgBuffer)
                .webp()
                .toBuffer();

            await sock.sendMessage(jid, { sticker: processedImage }, { quoted: msg });
            return;
        }

        // --- Mensagem de Ajuda ---
        return '🤖 *Como usar o comando sticker:*\n\n- Responda a uma imagem/vídeo com `!s`\n- Envie uma imagem/vídeo com a legenda `!s`\n- Digite `!s seu texto aqui`';

    } catch (error) {
        console.error('Erro ao criar sticker:', error);
        // Limpa os arquivos temporários em caso de erro
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        return '❌ Ocorreu um erro ao tentar criar o sticker. Verifique se o vídeo tem no máximo 7 segundos e se o `ffmpeg` está instalado corretamente.';
    }
}

module.exports = {
    name: 'sticker',
    aliases: ['s', 'fig', 'figurinha'],
    description: 'Cria stickers a partir de imagens, vídeos ou texto.',
    category: 'utilitario',
    permission: 'user',
    execute,
};
