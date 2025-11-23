const axios = require('axios');
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
        return sock.sendMessage(sender, { text: '❌ *ERRO:* Envie um link válido do YouTube!\n\nExemplo: .play https://www.youtube.com/watch?v=VIDEO_ID' });
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

        // Usar yt-dlp via helper
        // Usar yt-dlp via helper
        const { ensureYtDlpBinary } = require('../utils/ytDlpHelper');
        const ytDlpPath = await ensureYtDlpBinary();
        if (!ytDlpPath) {
            throw new Error('yt-dlp não encontrado no sistema ou localmente.');
        }
        const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');

        // Otimização: Baixar M4A diretamente para evitar conversão lenta para MP3
        // Adicionando argumentos para evitar erro de "Sign in to confirm you're not a bot"
        const command = `"${ytDlpPath}" --ffmpeg-location "${path.dirname(ffmpegPath)}" -f "bestaudio[ext=m4a]/bestaudio" --extract-audio --audio-format m4a --extractor-args "youtube:player_client=android" --user-agent "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36" -o "${outputTemplate}" "${url}"`;
        console.log('Executando comando otimizado:', command);
        const { stdout, stderr } = await execAsync(command);
        console.log('yt-dlp stdout:', stdout);
        console.log('yt-dlp stderr:', stderr);


        // Encontrar o arquivo baixado
        const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.m4a'));
        if (files.length === 0) {
            throw new Error('Arquivo de áudio não foi baixado (formato M4A não encontrado)');
        }
        const audioPath = path.join(tempDir, files[0]);

        // Obter título do nome do arquivo
        let title = path.basename(files[0], '.m4a');
        title = title.replace(/.*\[(.*?)\].*/, '$1').trim(); // remove [id]
        title = title.replace(/_/g, ' ');

        // Obter metadados
        const metadata = await getMetadata(audioPath);
        const duration = Math.floor(metadata.format.duration);

        if (duration > 600) { // 10 minutos máximo
            fs.unlinkSync(audioPath);
            return sock.sendMessage(sender, { text: '❌ *ERRO:* Vídeo muito longo! Máximo 10 minutos.' });
        }

        // Enviar mensagem de início
        await sock.sendMessage(sender, {
            text: `🎵 *DOWNLOAD INICIADO*

*Título:* ${title}
*Duração:* ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}
*Status:* Processando áudio...

Aguarde o download terminar!`
        });

        // Obter tamanho do arquivo
        const stats = fs.statSync(audioPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`Enviando áudio: ${audioPath}, Tamanho: ${fileSizeMB} MB`);

        // Enviar arquivo de áudio
        await sock.sendMessage(sender, {
            document: { url: audioPath },
            mimetype: 'audio/m4a',
            fileName: `${title}.m4a`,
            caption: `🎵 *DOWNLOAD CONCLUÍDO*

*Título:* ${title}
*Tamanho:* ${fileSizeMB} MB
*Formato:* M4A (Otimizado)`
        });
        console.log('Envio do áudio concluído.');

        // Limpar arquivo temporário
        setTimeout(() => {
            try {
                fs.unlinkSync(audioPath);
            } catch (err) {
                console.error('Erro ao remover arquivo temporário:', err);
            }
        }, 30000); // Remover após 30 segundos

    } catch (error) {
        console.error('Erro no comando .play:', error);
        console.error('yt-dlp stdout on error:', error.stdout);
        console.error('yt-dlp stderr on error:', error.stderr);
        return sock.sendMessage(sender, { text: `❌ *ERRO:* Não foi possível baixar o áudio.\n\nDetalhes: ${error.message}` });
    }
}

module.exports = {
    name: 'play',
    description: 'Baixa o áudio de um vídeo do YouTube em formato M4A (otimizado).',
    category: 'Downloads',
    permission: 'user',
    execute,
    aliases: ['yt', 'music'],
};
