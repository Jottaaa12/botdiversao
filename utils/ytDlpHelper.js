const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getYtDlpPath() {
    // 1. Tentar usar do PATH do sistema (Linux/Docker/Windows com PATH configurado)
    try {
        execSync('yt-dlp --version', { stdio: 'ignore' });
        return 'yt-dlp';
    } catch (e) {
        // Ignora erro e tenta o próximo
    }

    // 2. Tentar usar o binário local (Windows legacy)
    const localPath = path.join(__dirname, '..', 'yt-dlp.exe');
    if (fs.existsSync(localPath)) {
        return localPath;
    }

    // 3. Retornar null ou lançar erro se não encontrar
    console.warn('[yt-dlp] Executável não encontrado no PATH nem localmente.');
    return null;
}

module.exports = { getYtDlpPath };
