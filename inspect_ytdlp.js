const YTDlpWrap = require('yt-dlp-wrap').default;

console.log('--- Inspecting yt-dlp-wrap ---');
console.log('Static methods:', Object.getOwnPropertyNames(YTDlpWrap));
console.log('Prototype methods:', Object.getOwnPropertyNames(YTDlpWrap.prototype));

try {
    const instance = new YTDlpWrap();
    console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
    console.log('Instance keys:', Object.keys(instance));

    if (typeof YTDlpWrap.downloadFromGithub === 'function') {
        console.log('YTDlpWrap.downloadFromGithub exists (static).');
    }
    if (typeof instance.downloadFromGithub === 'function') {
        console.log('instance.downloadFromGithub exists.');
    }
} catch (e) {
    console.error('Error instantiating:', e);
}
