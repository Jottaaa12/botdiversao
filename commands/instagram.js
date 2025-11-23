const axios = require('axios');
const { igdl } = require('ab-downloader');
const fs = require('fs');
const path = require('path');

// Função auxiliar para validar URLs
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Função auxiliar para baixar arquivo
async function downloadFile(url, filepath, headers = {}) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: headers
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function execute({ sock, msg, args }) {
    const url = args[0];
    const sender = msg.key.remoteJid;

    if (!url || !isValidUrl(url)) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Envie um link válido do Instagram!\n\nExemplo: .instagram https://www.instagram.com/p/POST_ID/' });
    }

    if (!url.includes('instagram.com')) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Link deve ser do Instagram!' });
    }

    try {
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        await sock.sendMessage(sender, {
            text: `📸 *DOWNLOAD INSTAGRAM INICIADO*\n\n*Link:* ${url}\n*Status:* Processando conteúdo...`
        });

        console.log('Iniciando download do Instagram com ab-downloader...');
        const data = await igdl(url);
        console.log('Resultado do ab-downloader:', JSON.stringify(data, null, 2));

        if (!data || (Array.isArray(data) && data.length === 0)) {
            throw new Error('Nenhum conteúdo encontrado para o link do Instagram.');
        }

        const mediaItems = Array.isArray(data) ? data : [data];

        for (let i = 0; i < mediaItems.length; i++) {
            const mediaItem = mediaItems[i];
            if (mediaItem.url) {
                // Inferir tipo de mídia pela presença da thumbnail
                const isVideo = !!mediaItem.thumbnail;
                const fileExtension = isVideo ? 'mp4' : 'jpg';
                const mimetype = isVideo ? 'video/mp4' : 'image/jpeg';
                const fileName = `instagram_media_${Date.now()}_${i + 1}.${fileExtension}`;
                const filePath = path.join(tempDir, fileName);

                console.log(`Baixando item ${i + 1} de ${mediaItems.length}: ${mediaItem.url}`);
                console.log('Keys do mediaItem:', Object.keys(mediaItem));
                if (mediaItem.headers) {
                    console.log('Headers encontrados no mediaItem:', JSON.stringify(mediaItem.headers));
                } else {
                    console.log('Nenhum header encontrado no mediaItem.');
                }

                // Usar headers fornecidos pela API ou um User-Agent padrão
                const headers = mediaItem.headers || { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' };
                console.log('Headers finais usados:', JSON.stringify(headers));

                await downloadFile(mediaItem.url, filePath, headers);

                if (fs.existsSync(filePath)) {
                    if (isVideo) {
                        await sock.sendMessage(sender, {
                            video: { url: filePath },
                            mimetype: mimetype,
                            caption: `📸 Item ${i + 1}/${mediaItems.length} do Instagram`
                        });
                    } else { // É uma imagem
                        await sock.sendMessage(sender, {
                            image: { url: filePath },
                            mimetype: mimetype,
                            caption: `📸 Item ${i + 1}/${mediaItems.length} do Instagram`
                        });
                    }
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        } catch (err) {
                            console.error('Erro ao remover arquivo temporário do Instagram:', err);
                        }
                    }, 30000);
                }
            }
        }

    } catch (error) {
        console.error('Erro no comando .instagram:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível baixar o conteúdo do Instagram.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'instagram',
    description: 'Baixa vídeos ou imagens do Instagram.',
    category: 'Downloads',
    permission: 'user',
    execute,
    aliases: ['ig'],
};
