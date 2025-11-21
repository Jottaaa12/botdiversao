const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('ffprobe-static').path;
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

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
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Envie um link válido do YouTube!\n\nExemplo: .ytmp4 https://www.youtube.com/watch?v=VIDEO_ID' });
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Link do YouTube inválido!' });
    }

    try {
        // Criar diretório temp se não existir
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Usar yt-dlp diretamente para ter mais controle
        const ytDlpPath = path.join(__dirname, '..', 'yt-dlp.exe');
        const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');

        const command = `"${ytDlpPath}" --ffmpeg-location "${path.dirname(ffmpegPath)}" -f "best[height<=720]" -o "${outputTemplate}" "${url}"`;
        await execAsync(command);

        // Encontrar o arquivo baixado
        const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.mp4'));
        if (files.length === 0) {
            throw new Error('Arquivo de vídeo não foi baixado');
        }
        const videoPath = path.join(tempDir, files[0]);

        // Obter título do nome do arquivo
        let title = path.basename(files[0], '.mp4');
        title = title.replace(/.*\[(.*?)\].*/, '$1').trim(); // remove [id]
        title = title.replace(/_/g, ' ');

        // Obter metadados
        const metadata = await getMetadata(videoPath);
        const duration = Math.floor(metadata.format.duration);
        const height = metadata.streams.find(s => s.height)?.height || 720;

        if (duration > 300) { // 5 minutos máximo para vídeo
            fs.unlinkSync(videoPath);
            return sock.sendMessage(sender, { text: '❌ *ERRO:* Vídeo muito longo! Máximo 5 minutos.' });
        }

        // Enviar mensagem de início
        await sock.sendMessage(sender, {
            text: `🎥 *DOWNLOAD MP4 INICIADO*

*Título:* ${title}
*Duração:* ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}
*Formato:* MP4 (${height}p)
*Status:* Processando...

Aguarde o download terminar!`
        });

        // Obter tamanho do arquivo
        const stats = fs.statSync(videoPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        // Enviar arquivo de vídeo
        await sock.sendMessage(sender, {
            video: { url: videoPath },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption: `🎥 *DOWNLOAD MP4 CONCLUÍDO*

*Título:* ${title}
*Resolução:* ${height}p
*Tamanho:* ${fileSizeMB} MB
*Formato:* MP4`
        });

        // Limpar arquivo temporário
        setTimeout(() => {
            try {
                fs.unlinkSync(videoPath);
            } catch (err) {
                console.error('Erro ao remover arquivo temporário:', err);
            }
        }, 30000); // Remover após 30 segundos

    } catch (error) {
        console.error('Erro no comando .ytmp4:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível baixar o vídeo MP4.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'ytmp4',
    description: 'Baixa um vídeo do YouTube em formato MP4 (até 720p).',
    category: 'Downloads',
    permission: 'user',
    execute,
};
