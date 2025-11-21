const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('ffprobe-static').path;
const fs = require('fs');
const path = require('path');
const Tiktok = require("@tobyg74/tiktok-api-dl");

// Configurar caminho do FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

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

// Função auxiliar para obter metadados do arquivo
async function getMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
        });
    });
}

async function execute({ sock, msg, args }) {
    const url = args[0];
    const sender = msg.key.remoteJid;

    if (!url || !isValidUrl(url)) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Envie um link válido do TikTok!\n\nExemplo: .tiktok https://www.tiktok.com/@usuario/video/123456789' });
    }

    if (!url.includes('tiktok.com')) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Link deve ser do TikTok!' });
    }

    try {
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        console.log('Iniciando download com @tobyg74/tiktok-api-dl...');

        let result;
        let versionUsed;

        try {
            versionUsed = "v1";
            console.log("Tentando com a versão v1...");
            result = await Tiktok.Downloader(url, { version: "v1" });
        } catch (e) {
            console.log("v1 falhou, tentando com v2...");
            try {
                versionUsed = "v2";
                result = await Tiktok.Downloader(url, { version: "v2" });
            } catch (e2) {
                console.log("v2 falhou, tentando com v3...");
                versionUsed = "v3";
                result = await Tiktok.Downloader(url, { version: "v3" });
            }
        }
        
        console.log(`Resultado (v${versionUsed}):`, JSON.stringify(result, null, 2));

        if (result.status !== "success" || !result.result) {
            throw new Error(result.message || `Falha ao obter dados do TikTok com as versões v1, v2 e v3.`);
        }

        const data = result.result;
        const title = (data.desc || 'tiktok_video').substring(0, 50).replace(/[^a-zA-Z0-9\s]/g, '');
        const author = data.author?.nickname || 'Desconhecido';

        if (data.type === 'video') {
            let videoUrl;
            if (versionUsed === 'v1') {
                videoUrl = data.video?.playAddr?.[0] || data.video?.downloadAddr?.[0];
            } else if (versionUsed === 'v2') {
                videoUrl = data.video?.playAddr || data.direct;
            } else { // v3
                videoUrl = data.videoHD || data.videoWatermark;
            }

            if (!videoUrl) {
                console.error('URLs de vídeo disponíveis:', data);
                throw new Error('URL de vídeo não encontrada na resposta da API após tentar todas as versões.');
            }

            const videoPath = path.join(tempDir, `${title}.mp4`);
            console.log(`Baixando vídeo de: ${videoUrl}`);
            await downloadFile(videoUrl, videoPath);

            if (!fs.existsSync(videoPath)) {
                throw new Error('Falha ao baixar o arquivo de vídeo.');
            }

            const metadata = await getMetadata(videoPath);
            const duration = Math.floor(metadata.format.duration);
            const height = metadata.streams.find(s => s.height)?.height || 'N/A';

            if (duration > 300) { // 5 minutos
                fs.unlinkSync(videoPath);
                return sock.sendMessage(sender, { text: '❌ *ERRO:* Vídeo muito longo! Máximo 5 minutos.' });
            }
            
            await sock.sendMessage(sender, {
                text: `🎥 *DOWNLOAD TIKTOK INICIADO*\n\n*Título:* ${title}\n*Autor:* ${author}\n*Status:* Processando...`
            });

            const stats = fs.statSync(videoPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            await sock.sendMessage(sender, {
                video: { url: videoPath },
                mimetype: 'video/mp4',
                fileName: `${title}.mp4`,
                caption: `🎥 *DOWNLOAD TIKTOK CONCLUÍDO*\n\n*Título:* ${title}\n*Resolução:* ${height}p\n*Tamanho:* ${fileSizeMB} MB\n*Autor:* ${author}`
            });

            setTimeout(() => {
                try {
                    if (fs.existsSync(videoPath)) {
                        fs.unlinkSync(videoPath);
                    }
                } catch (err) {
                    console.error('Erro ao remover arquivo de vídeo temporário:', err);
                }
            }, 30000);

        } else if (data.type === 'image') {
            const imageUrls = data.images;
            if (!imageUrls || imageUrls.length === 0) {
                throw new Error('Nenhuma imagem encontrada para este post de slideshow.');
            }

            await sock.sendMessage(sender, {
                text: `🖼️ *DOWNLOAD TIKTOK SLIDESHOW INICIADO*\n\n*Título:* ${title}\n*Autor:* ${author}\n*Total de imagens:* ${imageUrls.length}\n*Status:* Baixando...`
            });

            for (let i = 0; i < imageUrls.length; i++) {
                const imageUrl = imageUrls[i];
                const imagePath = path.join(tempDir, `${title}_${i + 1}.jpeg`);
                
                console.log(`Baixando imagem ${i + 1} de: ${imageUrl}`);
                await downloadFile(imageUrl, imagePath);

                if (fs.existsSync(imagePath)) {
                    await sock.sendMessage(sender, {
                        image: { url: imagePath },
                        caption: `🖼️ Imagem ${i + 1}/${imageUrls.length} de "${title}"`
                    });
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(imagePath)) {
                                fs.unlinkSync(imagePath);
                            }
                        } catch (err) {
                            console.error('Erro ao remover arquivo de imagem temporário:', err);
                        }
                    }, 30000);
                }
            }
        } else {
            return sock.sendMessage(sender, { text: '❌ *ERRO:* Este conteúdo não é um vídeo ou slideshow de imagens. Apenas esses formatos são suportados.' });
        }

    } catch (error) {
        console.error('Erro no comando .tiktok:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível baixar o conteúdo do TikTok.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'tiktok',
    description: 'Baixa vídeos ou slideshows de imagens do TikTok.',
    category: 'Downloads',
    permission: 'user',
    execute,
};
