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
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Envie um link válido do YouTube!\n\nExemplo: .ytmp3 https://www.youtube.com/watch?v=VIDEO_ID' });
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Link do YouTube inválido!' });
    }

    try {
        console.log('[.ytmp3] Iniciando o comando.');
        // Criar diretório temp se não existir
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Usar yt-dlp via helper
        const { getYtDlpPath } = require('../utils/ytDlpHelper');
        const ytDlpPath = getYtDlpPath();
        if (!ytDlpPath) {
            throw new Error('yt-dlp não encontrado no sistema ou localmente.');
        }
        const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');

        const command = `"${ytDlpPath}" --ffmpeg-location "${path.dirname(ffmpegPath)}" -x --audio-format mp3 --audio-quality 128K -o "${outputTemplate}" "${url}"`;
        console.log('[.ytmp3] Executando yt-dlp para conversão em MP3...');
        await execAsync(command);
        console.log('[.ytmp3] Comando yt-dlp concluído.');

        // Encontrar o arquivo baixado
        const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.mp3'));
        if (files.length === 0) {
            throw new Error('Arquivo de áudio não foi baixado');
        }
        const audioPath = path.join(tempDir, files[0]);

        // Obter título do nome do arquivo
        let title = path.basename(files[0], '.mp3');
        title = title.replace(/.*\[(.*?)\].*/, '$1').trim(); // remove [id]
        title = title.replace(/_/g, ' ');

        // Obter metadados
        const metadata = await getMetadata(audioPath);
        const duration = Math.floor(metadata.format.duration);

        if (duration > 600) {
            fs.unlinkSync(audioPath);
            return sock.sendMessage(sender, { text: '❌ *ERRO:* Vídeo muito longo! Máximo 10 minutos.' });
        }

        // Enviar mensagem de início
        console.log('[.ytmp3] Enviando mensagem de "DOWNLOAD INICIADO"...');
        await sock.sendMessage(sender, {
            text: `🎵 *DOWNLOAD MP3 INICIADO*

*Título:* ${title}
*Duração:* ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}
*Formato:* MP3 (128kbps)
*Status:* Processando...

Aguarde o download terminar!`
        });

        // Obter tamanho do arquivo
        const stats = fs.statSync(audioPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        // Enviar arquivo de áudio
        console.log('[.ytmp3] Enviando o arquivo de áudio como documento...');
        await sock.sendMessage(sender, {
            document: { url: audioPath },
            mimetype: 'audio/mp3',
            fileName: `${title}.mp3`,
            caption: `🎵 *DOWNLOAD MP3 CONCLUÍDO*

*Título:* ${title}
*Tamanho:* ${fileSizeMB} MB
*Formato:* MP3 (128kbps)`
        });
        console.log('[.ytmp3] Envio do documento de áudio concluído.');

        // Limpar arquivo temporário
        setTimeout(() => {
            try {
                fs.unlinkSync(audioPath);
            } catch (err) {
                console.error('Erro ao remover arquivo temporário:', err);
            }
        }, 30000); // Remover após 30 segundos

    } catch (error) {
        console.error('Erro no comando .ytmp3:', error);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível baixar o MP3.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'ytmp3',
    description: 'Baixa o áudio de um vídeo do YouTube em formato MP3.',
    category: 'Downloads',
    permission: 'user',
    execute,
};
