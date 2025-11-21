const db = require('../database');

function execute({ args }) {
    if (args.length === 0) {
        return `⚙️ *CONFIGURAÇÃO DO BOT* ⚙️

Opções disponíveis:

*PREFIXO:*
• .config prefix <novo_prefixo>

*DONO:*
• .config dono <numero>
• .config contato <numero>

*IDIOMA:*
• .config idioma <pt/en/es>

*ANÚNCIOS:*
• .config anuncios <on/off>

*VERSÃO:*
• .config versao <numero>

Exemplo: .config prefix !`;
    }

    const [opcao, ...valores] = args;
    const valor = valores.join(' ');

    switch (opcao.toLowerCase()) {
        case 'prefix':
            if (!valor) return 'Digite o novo prefixo!';
            db.salvarConfiguracao('prefixo', valor);
            return `✅ Prefixo alterado para: ${valor}`;

        case 'dono':
            if (!valor) return 'Digite o nome do dono!';
            db.salvarConfiguracao('dono', valor);
            return `✅ Dono definido como: ${valor}`;

        case 'contato':
            if (!valor) return 'Digite o contato do dono!';
            db.salvarConfiguracao('contato_dono', valor);
            return `✅ Contato do dono definido como: ${valor}`;

        case 'idioma':
            const idiomasValidos = ['pt', 'en', 'es'];
            if (!idiomasValidos.includes(valor)) {
                return `Idioma inválido! Use: ${idiomasValidos.join(', ')}`;
            }
            db.salvarConfiguracao('idioma', valor);
            return `✅ Idioma alterado para: ${valor}`;

        case 'anuncios':
            if (!['on', 'off'].includes(valor)) {
                return 'Use: on ou off';
            }
            db.salvarConfiguracao('anuncios', valor);
            return `✅ Anúncios ${valor === 'on' ? 'ativados' : 'desativados'}`;

        case 'versao':
            if (!valor) return 'Digite a versão!';
            db.salvarConfiguracao('versao', valor);
            return `✅ Versão definida como: ${valor}`;

        default:
            return 'Opção inválida! Use .config para ver opções.';
    }
}

module.exports = {
    name: 'configurarbot',
    description: 'Configura diversas opções do bot.',
    category: 'adm',
    permission: 'owner',
    execute,
    aliases: ['config'],
};
