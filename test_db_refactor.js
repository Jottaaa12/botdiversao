
const db = require('./database/index');

async function testDatabase() {
    try {
        console.log('Testing Database Connection...');

        // Test User Repository
        console.log('Testing User Repository...');
        const user = db.user.obterUsuario('123456789@s.whatsapp.net');
        console.log('User:', user);

        // Test Config Repository
        console.log('Testing Config Repository...');
        const prefix = db.config.obterConfiguracao('prefixo');
        console.log('Prefix:', prefix);

        // Test Group Interaction Repository
        console.log('Testing Group Interaction Repository...');
        const ranking = db.groupInteraction.obterRankingGrupo('123456789@g.us', 5);
        console.log('Ranking:', ranking);

        // Test Financial Repository
        console.log('Testing Financial Repository...');
        const vendas = db.financial.obterTodasVendas();
        console.log('Vendas:', vendas);

        console.log('✅ Database Refactor Verification Passed!');
    } catch (error) {
        console.error('❌ Database Verification Failed:', error);
    } finally {
        db.close();
    }
}

testDatabase();
