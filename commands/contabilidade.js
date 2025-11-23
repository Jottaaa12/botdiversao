const db = require('../database');

function execute({ args }) {
    // Comando para salvar contabilidade: /contabilidade 2023-11 vendas:1000 custos:500
    if (args.length >= 3) {
        const mesAno = args[0];
        const vendas = parseFloat(args.find(p => p.startsWith('vendas:'))?.split(':')[1] || 0);
        const custos = parseFloat(args.find(p => p.startsWith('custos:'))?.split(':')[1] || 0);
        const lucros = vendas - custos;
        db.financial.salvarContabilidade(mesAno, vendas, custos, lucros);
        return `Dados de contabilidade para ${mesAno} salvos: Vendas R$${vendas}, Custos R$${custos}, Lucros R$${lucros}`;
    }
    return 'Uso: /contabilidade AAAA-MM vendas:VALOR custos:VALOR';
}

module.exports = {
    name: 'contabilidade',
    description: 'Salva os dados de contabilidade (vendas, custos, lucros) para um determinado mês.',
    category: 'adm',
    permission: 'admin',
    execute,
};
