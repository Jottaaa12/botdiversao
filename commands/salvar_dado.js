const db = require('../database');

function execute({ args }) {
    // Comando /salvar_dado categoria valor periodo
    if (args.length >= 3) {
        const categoria = args[0];
        const valor = parseFloat(args[1]);
        const periodo = args[2];

        if (isNaN(valor)) {
            return 'Valor inválido. Use um número.';
        }

        db.salvarDadoFinanceiro(categoria, valor, periodo);
        return `Dado financeiro salvo: ${categoria} R$${valor} para ${periodo}`;
    }
    return 'Uso: /salvar_dado categoria valor periodo\nEx: /salvar_dado vendas 10000 janeiro';
}

module.exports = {
    name: 'salvar_dado',
    description: 'Salva um dado financeiro (categoria, valor, período) no banco de dados.',
    category: 'adm',
    permission: 'admin',
    execute,
};
