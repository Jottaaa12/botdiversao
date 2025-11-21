const axios = require('axios');
const { fbdown } = require('ab-downloader');
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
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Envie um link válido do Facebook!\n\nExemplo: .facebook https://www.facebook.com/watch?v=VIDEO_ID' });
    }

    if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Link deve ser do Facebook!' });
    }

    try {
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        await sock.sendMessage(sender, {
            text: `📘 *DOWNLOAD FACEBOOK INICIADO*\n\n*Link:* ${url}\n*Status:* Processando vídeo...`
        });

        console.log('Iniciando download do Facebook com ab-downloader...');
        const data = await fbdown(url);
        console.log('Resultado do ab-downloader (Facebook):', JSON.stringify(data, null, 2));

        if (!data || (Array.isArray(data) && data.length === 0)) {
            throw new Error('Nenhum vídeo encontrado para o link do Facebook.');
        }

        const mediaItems = Array.isArray(data) ? data : [data];

        for (let i = 0; i < mediaItems.length; i++) {
            const mediaItem = mediaItems[i];
            if (mediaItem.url) {
                const fileExtension = 'mp4';
                const mimetype = 'video/mp4';
                const fileName = `facebook_video_${Date.now()}_${i + 1}.${fileExtension}`;
                const filePath = path.join(tempDir, fileName);

                console.log(`Baixando vídeo ${i + 1} de ${mediaItems.length}: ${mediaItem.url}`);
                await downloadFile(mediaItem.url, filePath);

                if (fs.existsSync(filePath)) {
                    await sock.sendMessage(sender, {
                        video: { url: filePath },
                        mimetype: mimetype,
                        caption: `📘 Vídeo ${i + 1}/${mediaItems.length} do Facebook`
                    });
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        } catch (err) {
                            console.error('Erro ao remover arquivo temporário do Facebook:', err);
                        }
                    }, 30000);
                }
            }
        }

    } catch (error) {
        console.error('Erro no comando .facebook:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível baixar o vídeo do Facebook.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'facebook',
    description: 'Baixa vídeos do Facebook.',
    category: 'diversao',
    permission: 'user',
    execute,
    aliases: ['fb'],
};
