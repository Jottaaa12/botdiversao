const db = require('../connection');

// Prepared statements para contabilidade
const insertContabilidade = db.prepare(`
    INSERT OR REPLACE INTO contabilidade (mes_ano, vendas, custos, lucros)
    VALUES (?, ?, ?, ?)
`);

const getContabilidadeMes = db.prepare(`
    SELECT * FROM contabilidade WHERE mes_ano = ?
`);

const updateContabilidade = db.prepare(`
    UPDATE contabilidade SET vendas = ?, custos = ?, lucros = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE mes_ano = ?
`);

// Prepared statements para dados financeiros
const insertDadoFinanceiro = db.prepare(`
    INSERT INTO dados_financeiros (categoria, valor, periodo)
    VALUES (?, ?, ?)
`);

const getDadosFinanceirosPorPeriodo = db.prepare(`
    SELECT * FROM dados_financeiros WHERE periodo = ? ORDER BY criado_em DESC
`);

const getTodosDadosFinanceiros = db.prepare(`
    SELECT * FROM dados_financeiros ORDER BY periodo DESC, criado_em DESC
`);

// Prepared statements para vendas
const insertVenda = db.prepare(`
    INSERT INTO vendas (cliente, pedido_id, data_hora, itens, forma_pagamento, valor_pago, troco, total_geral, id_usuario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getVendasUsuario = db.prepare(`
    SELECT * FROM vendas WHERE id_usuario = ? ORDER BY criado_em DESC
`);

const getTodasVendas = db.prepare(`
    SELECT * FROM vendas ORDER BY criado_em DESC
`);

// Prepared statements para fechamentos de caixa
const insertFechamentoCaixa = db.prepare(`
    INSERT INTO fechamentos_caixa (
        data, operador, horario_inicio, horario_fim, sessao,
        vendas_dinheiro, qtd_vendas_dinheiro, vendas_pix, qtd_vendas_pix,
        total_vendas, acai_vendido, movimentacoes, total_geral, fiados,
        saldo_inicial, valor_esperado, valor_contado, diferenca, tipo_diferenca,
        id_usuario
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getFechamentosUsuario = db.prepare(`
    SELECT * FROM fechamentos_caixa WHERE id_usuario = ? ORDER BY criado_em DESC
`);

const getTodosFechamentos = db.prepare(`
    SELECT * FROM fechamentos_caixa ORDER BY criado_em DESC
`);

module.exports = {
    // Contabilidade
    salvarContabilidade: (mesAno, vendas, custos, lucros) => {
        return insertContabilidade.run(mesAno, vendas, custos, lucros);
    },

    obterContabilidadeMes: (mesAno) => {
        return getContabilidadeMes.get(mesAno);
    },

    atualizarContabilidade: (mesAno, vendas, custos, lucros) => {
        return updateContabilidade.run(vendas, custos, lucros, mesAno);
    },

    // Dados Financeiros
    salvarDadoFinanceiro: (categoria, valor, periodo) => {
        return insertDadoFinanceiro.run(categoria, valor, periodo);
    },

    obterDadosFinanceirosPorPeriodo: (periodo) => {
        return getDadosFinanceirosPorPeriodo.all(periodo);
    },

    obterTodosDadosFinanceiros: () => {
        return getTodosDadosFinanceiros.all();
    },

    // Vendas
    salvarVenda: (cliente, pedidoId, dataHora, itens, formaPagamento, valorPago, troco, totalGeral, idUsuario) => {
        const itensStr = JSON.stringify(itens);
        return insertVenda.run(cliente, pedidoId, dataHora, itensStr, formaPagamento, valorPago, troco, totalGeral, idUsuario);
    },

    obterVendasUsuario: (idUsuario) => {
        const rows = getVendasUsuario.all(idUsuario);
        return rows.map(row => ({
            ...row,
            itens: JSON.parse(row.itens || '[]')
        }));
    },

    obterTodasVendas: () => {
        const rows = getTodasVendas.all();
        return rows.map(row => ({
            ...row,
            itens: JSON.parse(row.itens || '[]')
        }));
    },

    // Fechamentos de Caixa
    salvarFechamentoCaixa: (data, operador, horarioInicio, horarioFim, sessao,
        vendasDinheiro, qtdVendasDinheiro, vendasPix, qtdVendasPix,
        totalVendas, acaiVendido, movimentacoes, totalGeral, fiados,
        saldoInicial, valorEsperado, valorContado, diferenca, tipoDiferenca, idUsuario) => {
        const movimentacoesStr = JSON.stringify(movimentacoes);
        const fiadosStr = JSON.stringify(fiados);
        return insertFechamentoCaixa.run(data, operador, horarioInicio, horarioFim, sessao,
            vendasDinheiro, qtdVendasDinheiro, vendasPix, qtdVendasPix,
            totalVendas, acaiVendido, movimentacoesStr, totalGeral, fiadosStr,
            saldoInicial, valorEsperado, valorContado, diferenca, tipoDiferenca, idUsuario);
    },

    obterFechamentosUsuario: (idUsuario) => {
        const rows = getFechamentosUsuario.all(idUsuario);
        return rows.map(row => ({
            ...row,
            movimentacoes: JSON.parse(row.movimentacoes || '[]'),
            fiados: JSON.parse(row.fiados || '[]')
        }));
    },

    obterTodosFechamentos: () => {
        const rows = getTodosFechamentos.all();
        return rows.map(row => ({
            ...row,
            movimentacoes: JSON.parse(row.movimentacoes || '[]'),
            fiados: JSON.parse(row.fiados || '[]')
        }));
    }
};
