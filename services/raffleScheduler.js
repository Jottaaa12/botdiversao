const db = require('../database');

const CHECK_INTERVAL = 60 * 1000; // 1 minuto
const RESERVATION_TIMEOUT = 10 * 60 * 1000; // 10 minutos
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos para sessões de compra inativas

function startRaffleScheduler(sock) {
    console.log('[RaffleScheduler] Iniciando agendador de rifas...');

    setInterval(async () => {
        try {
            checkExpiredReservations(sock);
            checkInactiveSessions();
        } catch (error) {
            console.error('[RaffleScheduler] Erro no ciclo do agendador:', error);
        }
    }, CHECK_INTERVAL);
}

function checkExpiredReservations(sock) {
    // Buscar compras pendentes antigas que ainda não foram pagas.
    const pendentes = db.connection.prepare('SELECT * FROM compras_pendentes WHERE status = ?').all('aguardando_pagamento');
    const now = Date.now();

    for (const compra of pendentes) {
        const createdAt = new Date(compra.created_at).getTime();

        if (now - createdAt > RESERVATION_TIMEOUT) {
            console.log(`[RaffleScheduler] Compra ${compra.id} expirada. Liberando números...`);

            // Liberar números
            const numeros = JSON.parse(compra.numeros);
            for (const numero of numeros) {
                db.raffle.liberarNumero(compra.rifa_id, numero);
            }

            // Atualizar status da compra para expirada
            db.connection.prepare('UPDATE compras_pendentes SET status = ? WHERE id = ?').run('expirada', compra.id);

            // Notificar usuário (se possível)
            if (sock) {
                const msg = `⚠️ *RESERVA EXPIRADA* ⚠️\n\nSua reserva dos números *${numeros.join(', ')}* expirou por falta de pagamento. Eles foram liberados para outros compradores.`;
                sock.sendMessage(compra.comprador_id, { text: msg }).catch(e => console.error('Erro ao notificar expiração:', e));
            }
        }
    }
}

function checkInactiveSessions() {
    // Limpar sessões de compra IA antigas
    const sessoes = db.connection.prepare('SELECT * FROM sessoes_compra_ia').all();
    const now = Date.now();

    for (const sessao of sessoes) {
        const lastUpdate = new Date(sessao.updated_at).getTime();

        if (now - lastUpdate > SESSION_TIMEOUT) {
            console.log(`[RaffleScheduler] Sessão inativa de ${sessao.user_id} removida.`);
            db.connection.prepare('DELETE FROM sessoes_compra_ia WHERE user_id = ?').run(sessao.user_id);
        }
    }
}

module.exports = { startRaffleScheduler };
