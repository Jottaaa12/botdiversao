const axios = require('axios');
const { twitter } = require('ab-downloader');
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
async function downloadFile(url, filepath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
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
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Envie um link válido do Twitter/X!\n\nExemplo: .twitter https://twitter.com/usuario/status/123456789' });
    }

    if (!url.includes('twitter.com') && !url.includes('x.com')) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Link deve ser do Twitter/X!' });
    }

    try {
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        await sock.sendMessage(sender, {
            text: `🐦 *DOWNLOAD TWITTER/X INICIADO*\n\n*Link:* ${url}\n*Status:* Processando mídia...`
        });

        console.log('Iniciando download do Twitter/X com ab-downloader...');
        const data = await twitter(url);
        console.log('Resultado do ab-downloader (Twitter/X):', JSON.stringify(data, null, 2));

        if (!data || (Array.isArray(data) && data.length === 0)) {
            throw new Error('Nenhuma mídia encontrada para o link do Twitter/X.');
        }

        const mediaItems = Array.isArray(data) ? data : [data];

        for (let i = 0; i < mediaItems.length; i++) {
            const mediaItem = mediaItems[i];
            if (mediaItem.url) {
                const isVideo = !!mediaItem.thumbnail;
                const fileExtension = isVideo ? 'mp4' : 'jpg';
                const mimetype = isVideo ? 'video/mp4' : 'image/jpeg';
                const fileName = `twitter_media_${Date.now()}_${i + 1}.${fileExtension}`;
                const filePath = path.join(tempDir, fileName);

                console.log(`Baixando item ${i + 1} de ${mediaItems.length}: ${mediaItem.url}`);
                await downloadFile(mediaItem.url, filePath);

                if (fs.existsSync(filePath)) {
                    if (isVideo) {
                        await sock.sendMessage(sender, {
                            video: { url: filePath },
                            mimetype: mimetype,
                            caption: `🐦 Mídia ${i + 1}/${mediaItems.length} do Twitter/X`
                        });
                    } else { // Assume image
                        await sock.sendMessage(sender, {
                            image: { url: filePath },
                            mimetype: mimetype,
                            caption: `🐦 Mídia ${i + 1}/${mediaItems.length} do Twitter/X`
                        });
                    }
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        } catch (err) {
                            console.error('Erro ao remover arquivo temporário do Twitter/X:', err);
                        }
                    }, 30000);
                }
            }
        }

    } catch (error) {
        console.error('Erro no comando .twitter:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível baixar a mídia do Twitter/X.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'twitter',
    description: 'Baixa vídeos ou imagens do Twitter/X.',
    category: 'Downloads',
    permission: 'user',
    execute,
    aliases: ['x'],
};
