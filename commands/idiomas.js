function execute() {
    return `🌍 *IDIOMAS SUPORTADOS* 🌍

O bot suporta os seguintes idiomas:

• 🇧🇷 Português (Brasil) - Nativo
• 🇺🇸 Inglês - Completo
• 🇪🇸 Espanhol - Básico
• 🇯🇵 Japonês - Anime/Mangá
• 🇰🇷 Coreano - K-pop
• 🇫🇷 Francês - Básico

Para mudar o idioma, use .ConfigurarBot`;
}

module.exports = {
    name: 'idiomas',
    description: 'Exibe a lista de idiomas suportados pelo bot.',
    category: 'Info',
    permission: 'user',
    execute,
};
