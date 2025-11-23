const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getYtDlpPath() {
    // 1. Tentar usar o pacote yt-dlp-wrap (funciona em Windows e Linux)
    try {
        const YTDlpWrap = require('yt-dlp-wrap').default;
        const ytDlpWrap = new YTDlpWrap();
        return ytDlpWrap.binaryPath;
    } catch (e) {
        console.warn('[yt-dlp] Pacote yt-dlp-wrap não encontrado:', e.message);
    }

    // 2. Tentar usar do PATH do sistema (Linux/Docker/Windows com PATH configurado)
    try {
        execSync('yt-dlp --version', { stdio: 'ignore' });
        return 'yt-dlp';
    } catch (e) {
        // Ignora erro e tenta o próximo
    }

    // 3. Tentar usar o binário local (Windows legacy)
    const localPath = path.join(__dirname, '..', 'yt-dlp.exe');
    if (fs.existsSync(localPath)) {
        return localPath;
    }

    // 4. Retornar null ou lançar erro se não encontrar
    console.warn('[yt-dlp] Executável não encontrado no PATH nem localmente.');
    return null;
}

async function ensureYtDlpBinary() {
    try {
        const YTDlpWrap = require('yt-dlp-wrap').default;

        // Definir caminho do binário
        const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
        const binaryPath = path.join(__dirname, '..', binaryName);

        // Verificar se o binário já existe
        if (fs.existsSync(binaryPath)) {
            return binaryPath;
        }

        console.log('[yt-dlp] Baixando binário yt-dlp mais recente para:', binaryPath);

        // Tentar usar método estático (versões mais recentes)
        if (typeof YTDlpWrap.downloadFromGithub === 'function') {
            await YTDlpWrap.downloadFromGithub(binaryPath);
        } else {
            // Fallback: tentar instanciar e usar método (se existir) ou lançar erro
            const ytDlpWrap = new YTDlpWrap();
            if (typeof ytDlpWrap.downloadFromGithub === 'function') {
                await ytDlpWrap.downloadFromGithub(binaryPath);
            } else {
                throw new Error('Método downloadFromGithub não encontrado no yt-dlp-wrap');
            }
        }

        console.log('[yt-dlp] Download concluído com sucesso!');

        // Dar permissão de execução (Linux/Mac)
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(binaryPath, '755');
            } catch (e) {
                console.error('[yt-dlp] Erro ao dar permissão de execução:', e);
            }
        }

        return binaryPath;
    } catch (error) {
        console.error('[yt-dlp] Erro ao garantir binário:', error);
        // Fallback para tentar encontrar no sistema
        return getYtDlpPath();
    }
}

module.exports = { getYtDlpPath, ensureYtDlpBinary };
