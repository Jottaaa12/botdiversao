const { getYtDlpPath } = require('./utils/ytDlpHelper');
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');

console.log('--- Debugging yt-dlp path ---');

try {
    const ytDlpWrap = new YTDlpWrap();
    console.log('yt-dlp-wrap binaryPath:', ytDlpWrap.binaryPath);
} catch (e) {
    console.log('Error instantiating yt-dlp-wrap:', e.message);
}

const resolvedPath = getYtDlpPath();
console.log('Resolved yt-dlp path:', resolvedPath);

if (resolvedPath) {
    if (resolvedPath === 'yt-dlp') {
        console.log('Path is "yt-dlp" (assumed global).');
    } else {
        console.log('Path is absolute. Exists?', fs.existsSync(resolvedPath));
    }
} else {
    console.log('Resolved path is null.');
}
