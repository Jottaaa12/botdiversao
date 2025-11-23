const schema = require('./database/schema');

console.log('--- INICIANDO TESTE LISTA HORÁRIO ---');

// Inicializa o banco de dados (cria tabelas e colunas)
try {
    schema.initializeDatabase();
} catch (e) {
    console.error('❌ FATAL: Erro ao inicializar banco de dados:', e);
    process.exit(1);
}

// Agora carrega o db e os repositórios
const db = require('./database');

const idGrupoTeste = '123456@g.us';

// 1. Definir horário e dias
console.log('\n1. Testando definirHorarioEnvioLista...');
try {
    db.list.definirHorarioEnvioLista(idGrupoTeste, '14:00', [1, 3, 5]);
    const config = db.list.obterConfigLista(idGrupoTeste);
    console.log('Configuração salva:', config);
    if (config.horario_envio === '14:00' && config.dias_envio === '1,3,5') {
        console.log('✅ Sucesso: Horário e dias salvos corretamente.');
    } else {
        console.error('❌ Falha: Dados não correspondem.');
    }
} catch (e) {
    console.error('❌ Erro ao definir horário:', e);
}

// 2. Pausar envio
console.log('\n2. Testando pausarEnvioLista...');
try {
    db.list.pausarEnvioLista(idGrupoTeste);
    const config = db.list.obterConfigLista(idGrupoTeste);
    if (config.envio_ativo === 0) {
        console.log('✅ Sucesso: Envio pausado.');
    } else {
        console.error('❌ Falha: Envio não foi pausado.');
    }
} catch (e) {
    console.error('❌ Erro ao pausar:', e);
}

// 3. Reativar envio
console.log('\n3. Testando ativarEnvioLista...');
try {
    db.list.ativarEnvioLista(idGrupoTeste);
    const config = db.list.obterConfigLista(idGrupoTeste);
    if (config.envio_ativo === 1) {
        console.log('✅ Sucesso: Envio reativado.');
    } else {
        console.error('❌ Falha: Envio não foi reativado.');
    }
} catch (e) {
    console.error('❌ Erro ao reativar:', e);
}

// 4. Registrar histórico (Sucesso)
console.log('\n4. Testando registrarEnvioLista (Sucesso)...');
try {
    db.list.registrarEnvioLista(idGrupoTeste, true);
    const historico = db.list.obterHistoricoEnvios(idGrupoTeste, 1);
    console.log('Último histórico:', historico[0]);
    if (historico.length > 0 && historico[0].sucesso === 1) {
        console.log('✅ Sucesso: Histórico registrado corretamente.');
    } else {
        console.error('❌ Falha: Histórico não encontrado ou incorreto.');
    }
} catch (e) {
    console.error('❌ Erro ao registrar histórico:', e);
}

// 5. Registrar histórico (Erro)
console.log('\n5. Testando registrarEnvioLista (Erro)...');
try {
    db.list.registrarEnvioLista(idGrupoTeste, false, 'Erro de teste');
    const historico = db.list.obterHistoricoEnvios(idGrupoTeste, 1);
    console.log('Último histórico:', historico[0]);
    if (historico.length > 0 && historico[0].sucesso === 0 && historico[0].erro === 'Erro de teste') {
        console.log('✅ Sucesso: Erro registrado corretamente.');
    } else {
        console.error('❌ Falha: Erro não registrado corretamente.');
    }
} catch (e) {
    console.error('❌ Erro ao registrar erro:', e);
}

// 6. Listar grupos ativos
console.log('\n6. Testando listarGruposComListaAtiva...');
try {
    const ativos = db.list.listarGruposComListaAtiva();
    console.log('Grupos ativos:', ativos);
    const grupoTeste = ativos.find(g => g.id_grupo === idGrupoTeste);
    if (grupoTeste) {
        console.log('✅ Sucesso: Grupo de teste encontrado na lista de ativos.');
    } else {
        console.error('❌ Falha: Grupo de teste não encontrado.');
    }
} catch (e) {
    console.error('❌ Erro ao listar ativos:', e);
}

// 7. Cancelar envio (Limpeza)
console.log('\n7. Testando cancelarEnvioLista...');
try {
    db.list.cancelarEnvioLista(idGrupoTeste);
    const config = db.list.obterConfigLista(idGrupoTeste);
    if (!config.horario_envio && !config.dias_envio) {
        console.log('✅ Sucesso: Configuração removida.');
    } else {
        console.error('❌ Falha: Configuração ainda existe.');
    }
} catch (e) {
    console.error('❌ Erro ao cancelar:', e);
}

console.log('\n--- FIM DO TESTE ---');
