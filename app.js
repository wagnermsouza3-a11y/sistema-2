/* ================================================================
   MINHAS CONTAS — APP.JS
   Gerenciamento de contas recorrentes | 100% offline | LocalStorage
   ================================================================ */

'use strict';

// ================================================================
// STATE
// ================================================================
const STATE = {
  accounts: [],    // [{ id, name, dueDay, observation, createdAt, icon }]
  records: {},     // { 'YYYY-MM': { [accountId]: { status, paidAt } } }
  history: [],     // [{ id, accountId, accountName, month, paidAt, dueDay }]
  settings: {
    darkMode: true,
    notificationsEnabled: false,
    lastResetMonth: null
  },
  ui: {
    currentView: 'dashboard',
    searchQuery: '',
    filterStatus: 'all',
    detailAccountId: null,
    confirmCallback: null
  }
};

// ================================================================
// CONSTANTS
// ================================================================
const STORAGE_KEY = 'minhas_contas_v2';
const ICONS = ['💳','🏠','💡','💧','📱','🌐','🚗','🎓','🏥','🏦','🛒','📺','🎵','🎮','🍕','✈️','⚡','🔑','📰','💈'];

// ================================================================
// UTILITY FUNCTIONS
// ================================================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
}

function getCurrentDay() {
  return new Date().getDate();
}

function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function getAccountStatus(account) {
  const currentMonth = getCurrentMonth();
  const today = getCurrentDay();
  const record = STATE.records[currentMonth]?.[account.id];
  
  if (record?.status === 'paid') return 'paid';
  
  const due = account.dueDay;
  if (today > due)           return 'late';
  if (today === due)          return 'today';
  if (due - today <= 5)      return 'soon';
  return 'pending';
}

function getStatusLabel(status) {
  const labels = {
    late:    '🔴 Atrasada',
    today:   '🟡 Vence Hoje',
    soon:    '🔵 Em Breve',
    paid:    '🟢 Paga',
    pending: '⚪ Pendente'
  };
  return labels[status] || '⚪ Pendente';
}

function getStatusText(status) {
  const labels = {
    late:    'Atrasada',
    today:   'Vence Hoje',
    soon:    'Em Breve',
    paid:    'Paga',
    pending: 'Pendente'
  };
  return labels[status] || 'Pendente';
}

function getAccountIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('aluguel') || n.includes('condomín') || n.includes('casa')) return '🏠';
  if (n.includes('internet') || n.includes('net') || n.includes('fibra'))    return '🌐';
  if (n.includes('luz') || n.includes('energia') || n.includes('enel'))      return '⚡';
  if (n.includes('água') || n.includes('agua') || n.includes('sabesp'))      return '💧';
  if (n.includes('cel') || n.includes('tim') || n.includes('vivo') || n.includes('claro') || n.includes('oi')) return '📱';
  if (n.includes('cartão') || n.includes('cartao') || n.includes('nubank') || n.includes('itaú') || n.includes('bradesco') || n.includes('banco')) return '💳';
  if (n.includes('gás') || n.includes('gas'))    return '🔥';
  if (n.includes('tv') || n.includes('globo') || n.includes('sky') || n.includes('oi tv')) return '📺';
  if (n.includes('saúde') || n.includes('plano') || n.includes('unimed')) return '🏥';
  if (n.includes('escola') || n.includes('faculdade') || n.includes('curso')) return '🎓';
  if (n.includes('mercado') || n.includes('compra')) return '🛒';
  if (n.includes('spotify') || n.includes('deezer')) return '🎵';
  if (n.includes('netflix') || n.includes('amazon') || n.includes('disney') || n.includes('streaming')) return '🎬';
  if (n.includes('seguro') || n.includes('carro') || n.includes('auto')) return '🚗';
  return '💳';
}

// ================================================================
// STORAGE
// ================================================================
function saveState() {
  try {
    const data = {
      accounts: STATE.accounts,
      records:  STATE.records,
      history:  STATE.history,
      settings: STATE.settings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch(e) {
    console.error('Erro ao salvar dados:', e);
    showToast('Erro ao salvar dados!', 'error');
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    // Limpa e repopula cada parte do STATE separadamente (evita bugs com arrays)
    STATE.accounts.length = 0;
    if (Array.isArray(data.accounts)) STATE.accounts.push(...data.accounts);

    // Limpa records
    Object.keys(STATE.records).forEach(k => delete STATE.records[k]);
    if (data.records && typeof data.records === 'object') {
      Object.assign(STATE.records, data.records);
    }

    STATE.history.length = 0;
    if (Array.isArray(data.history)) STATE.history.push(...data.history);

    if (data.settings && typeof data.settings === 'object') {
      Object.assign(STATE.settings, data.settings);
    }
  } catch(e) {
    console.error('Erro ao carregar dados:', e);
    showToast('Erro ao carregar dados!', 'error');
  }
}

// ================================================================
// MONTHLY RESET
// ================================================================
function checkMonthlyReset() {
  const currentMonth = getCurrentMonth();
  if (STATE.settings.lastResetMonth === currentMonth) return;
  
  // Initialize records for current month
  if (!STATE.records[currentMonth]) {
    STATE.records[currentMonth] = {};
  }
  
  // Make sure all accounts have a record this month
  STATE.accounts.forEach(acc => {
    if (!STATE.records[currentMonth][acc.id]) {
      STATE.records[currentMonth][acc.id] = { status: 'pending', paidAt: null };
    }
  });
  
  STATE.settings.lastResetMonth = currentMonth;
  saveState();
}

function ensureCurrentMonthRecords() {
  const currentMonth = getCurrentMonth();
  let dirty = false;
  if (!STATE.records[currentMonth]) {
    STATE.records[currentMonth] = {};
    dirty = true;
  }
  STATE.accounts.forEach(acc => {
    if (!STATE.records[currentMonth][acc.id]) {
      STATE.records[currentMonth][acc.id] = { status: 'pending', paidAt: null };
      dirty = true;
    }
  });
  // Salva apenas se algo foi adicionado
  if (dirty) saveState();
}

// ================================================================
// RENDER FUNCTIONS
// ================================================================

function renderDashboard() {
  const today = getCurrentDay();
  const currentMonth = getCurrentMonth();

  // Garante que os registros do mês existam
  ensureCurrentMonthRecords();

  // Labels do mês
  const monthLabelEl = document.getElementById('month-label');
  const todayLabelEl = document.getElementById('today-label');
  if (monthLabelEl) monthLabelEl.textContent = formatMonthLabel(currentMonth);
  if (todayLabelEl) todayLabelEl.textContent = `Hoje é dia ${today}`;

  // Filtra e busca
  let accounts = [...STATE.accounts];
  if (STATE.ui.searchQuery) {
    const q = STATE.ui.searchQuery.toLowerCase();
    accounts = accounts.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.observation || '').toLowerCase().includes(q)
    );
  }

  // Calcula status de todas as contas
  const withStatus = accounts.map(a => ({ ...a, status: getAccountStatus(a) }));

  // Aplica filtro por chip
  let filtered = withStatus;
  if (STATE.ui.filterStatus && STATE.ui.filterStatus !== 'all') {
    filtered = withStatus.filter(a => a.status === STATE.ui.filterStatus);
  }

  // Ordena: atrasada → hoje → em breve → pendente → paga
  const order = { late: 0, today: 1, soon: 2, pending: 3, paid: 4 };
  filtered.sort((a, b) => {
    const oa = order[a.status] ?? 5;
    const ob = order[b.status] ?? 5;
    if (oa !== ob) return oa - ob;
    return a.dueDay - b.dueDay;
  });

  // Contadores para os cards de resumo (sempre baseado em TODAS as contas)
  const allWithStatus = STATE.accounts.map(a => ({ ...a, status: getAccountStatus(a) }));
  const counts = { late: 0, today: 0, soon: 0, paid: 0, pending: 0 };
  allWithStatus.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });

  const numLate  = document.getElementById('num-late');
  const numToday = document.getElementById('num-today');
  const numSoon  = document.getElementById('num-soon');
  const numPaid  = document.getElementById('num-paid');
  if (numLate)  numLate.textContent  = counts.late;
  if (numToday) numToday.textContent = counts.today;
  if (numSoon)  numSoon.textContent  = counts.soon;
  if (numPaid)  numPaid.textContent  = counts.paid;

  // Barra de progresso
  const total = STATE.accounts.length;
  const paid  = counts.paid;
  const pct   = total > 0 ? Math.round((paid / total) * 100) : 0;
  const fillEl  = document.getElementById('progress-fill');
  const countEl = document.getElementById('progress-count');
  const pctEl   = document.getElementById('progress-pct');
  if (fillEl)  fillEl.style.width    = pct + '%';
  if (countEl) countEl.textContent   = `${paid} de ${total} pagas`;
  if (pctEl)   pctEl.textContent     = pct + '%';

  // Elementos da lista e do empty-state (persistem no DOM, nunca são destruídos)
  const list  = document.getElementById('accounts-list');
  const empty = document.getElementById('empty-state');

  if (!list) return; // segurança

  // Sem contas cadastradas
  if (STATE.accounts.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  // Contas existem mas filtro não retornou nada
  if (filtered.length === 0) {
    if (empty) empty.style.display = 'none';
    list.innerHTML = `
      <div class="empty-state" style="padding:32px 16px">
        <div class="empty-icon">🔍</div>
        <h3>Nenhuma conta encontrada</h3>
        <p>Tente outro filtro ou termo de busca.</p>
      </div>`;
    return;
  }

  // Esconde o empty-state fixo
  if (empty) empty.style.display = 'none';

  // Agrupa por status
  const groups = [
    { key: 'late',    label: '🔴 Atrasadas' },
    { key: 'today',   label: '🟡 Vencem Hoje' },
    { key: 'soon',    label: '🔵 Em Breve (até 5 dias)' },
    { key: 'pending', label: '⚪ Pendentes' },
    { key: 'paid',    label: '🟢 Pagas no Mês' }
  ];

  let html = '';
  let cardIndex = 0;
  groups.forEach(g => {
    const group = filtered.filter(a => a.status === g.key);
    if (group.length === 0) return;
    html += `<div class="group-label">${g.label}</div>`;
    group.forEach(acc => {
      const statusLabel = getStatusText(acc.status);
      const icon = getAccountIcon(acc.name);
      const record = STATE.records[currentMonth]?.[acc.id];
      const paidInfo = record?.paidAt ? `Paga em ${formatDate(record.paidAt)}` : '';
      html += `
        <div class="account-card status-${acc.status}"
             data-id="${acc.id}"
             style="animation-delay:${cardIndex * 0.04}s"
             role="button"
             tabindex="0"
             aria-label="${escapeHtml(acc.name)} — ${statusLabel}">
          <div class="account-card-icon">${icon}</div>
          <div class="account-card-body">
            <div class="account-card-name">${escapeHtml(acc.name)}</div>
            <div class="account-card-due">
              📅 Vence dia ${acc.dueDay}
              ${acc.observation ? ` • ${escapeHtml(acc.observation).substring(0, 30)}` : ''}
              ${paidInfo ? `<br><span style="color:var(--paid);font-size:11px">✅ ${paidInfo}</span>` : ''}
            </div>
          </div>
          <div class="account-card-right">
            <span class="status-badge ${acc.status}">${statusLabel}</span>
            ${acc.status !== 'paid'
              ? `<button class="quick-pay-btn" data-pay-id="${acc.id}" title="Marcar como paga" aria-label="Marcar ${escapeHtml(acc.name)} como paga">✓</button>`
              : ''}
          </div>
        </div>`;
      cardIndex++;
    });
  });

  list.innerHTML = html;

  // Vincula eventos dos cards
  list.querySelectorAll('.account-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.quick-pay-btn')) return;
      addRipple(card, e);
      openDetail(card.dataset.id);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(card.dataset.id);
      }
    });
  });

  // Vincula botões de pagamento rápido
  list.querySelectorAll('.quick-pay-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      markAsPaid(btn.dataset.payId);
    });
  });
}

function renderHistory() {
  const select = document.getElementById('history-month-filter');
  if (!select) return;

  // Salva o filtro selecionado ANTES de recriar as opções
  const previousFilter = select.value || 'all';

  // Reconstrói as opções do select
  const months = [...new Set(STATE.history.map(h => h.month))].sort().reverse();
  select.innerHTML = '<option value="all">Todos os meses</option>';
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = formatMonthLabel(m);
    select.appendChild(opt);
  });

  // Restaura o filtro anterior se ele ainda existir
  if (previousFilter && previousFilter !== 'all' && months.includes(previousFilter)) {
    select.value = previousFilter;
  } else {
    select.value = 'all';
  }

  const filter = select.value;
  let items = [...STATE.history];
  if (filter && filter !== 'all') {
    items = items.filter(h => h.month === filter);
  }

  items.sort((a, b) => b.paidAt - a.paidAt);

  const list = document.getElementById('history-list');
  if (!list) return;

  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>Nenhum histórico</h3>
        <p>${filter && filter !== 'all' ? 'Nenhum pagamento neste mês.' : 'Os pagamentos marcados aparecerão aqui.'}</p>
      </div>`;
    return;
  }

  // Agrupa por mês
  const grouped = {};
  items.forEach(h => {
    if (!grouped[h.month]) grouped[h.month] = [];
    grouped[h.month].push(h);
  });

  let html = '';
  Object.keys(grouped).sort().reverse().forEach(month => {
    html += `<div class="history-month-section">
      <div class="history-month-title">📅 ${formatMonthLabel(month)} <span style="color:var(--text-3);font-size:12px;font-weight:400">(${grouped[month].length} paga${grouped[month].length > 1 ? 's' : ''})</span></div>`;
    grouped[month].forEach(h => {
      const icon = getAccountIcon(h.accountName);
      html += `
        <div class="history-item">
          <div class="history-item-icon">${icon}</div>
          <div class="history-item-body">
            <div class="history-item-name">${escapeHtml(h.accountName)}</div>
            <div class="history-item-date">Dia ${h.dueDay} • Paga em ${formatDateTime(h.paidAt)}</div>
          </div>
          <span class="history-item-badge">✅ Paga</span>
        </div>`;
    });
    html += '</div>';
  });

  list.innerHTML = html;
}

// ================================================================
// DETAIL MODAL
// ================================================================
function openDetail(accountId) {
  const account = STATE.accounts.find(a => a.id === accountId);
  if (!account) return;

  STATE.ui.detailAccountId = accountId;
  const currentMonth = getCurrentMonth();
  const status = getAccountStatus(account);
  const record = STATE.records[currentMonth]?.[account.id];

  document.getElementById('detail-title').textContent = account.name;
  document.getElementById('detail-name').textContent = account.name;
  document.getElementById('detail-due').textContent = `📅 Vence todo dia ${account.dueDay} de cada mês`;
  document.getElementById('detail-obs').textContent = account.observation ? `📝 ${account.observation}` : '';
  document.getElementById('detail-paid-info').textContent = record?.paidAt ? `✅ Paga em ${formatDateTime(record.paidAt)}` : '';

  // Status badge in detail
  const badge = document.getElementById('detail-badge');
  badge.innerHTML = `<span class="status-badge ${status}" style="font-size:14px;padding:6px 16px">${getStatusLabel(status)}</span>`;

  // Mark paid button state
  const payBtn = document.getElementById('btn-mark-paid');
  if (status === 'paid') {
    payBtn.textContent = '✅ Conta já está paga!';
    payBtn.disabled = true;
    payBtn.style.opacity = '0.6';
  } else {
    payBtn.innerHTML = '<span>✅</span> Marcar como Paga';
    payBtn.disabled = false;
    payBtn.style.opacity = '1';
  }

  openModal('modal-detail');
}

// ================================================================
// ACCOUNT MODAL (Add/Edit)
// ================================================================
function openAddModal() {
  document.getElementById('modal-title').textContent = 'Adicionar Conta';
  document.getElementById('account-id').value = '';
  document.getElementById('account-name').value = '';
  document.getElementById('account-due').value = '';
  document.getElementById('account-obs').value = '';
  
  // Clear day picker
  document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
  
  openModal('modal-account');
  setTimeout(() => document.getElementById('account-name').focus(), 100);
}

function openEditModal(accountId) {
  const account = STATE.accounts.find(a => a.id === accountId);
  if (!account) return;

  closeModal('modal-detail');

  document.getElementById('modal-title').textContent = 'Editar Conta';
  document.getElementById('account-id').value = account.id;
  document.getElementById('account-name').value = account.name;
  document.getElementById('account-due').value = account.dueDay;
  document.getElementById('account-obs').value = account.observation || '';

  // Update day picker
  document.querySelectorAll('.day-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.day) === account.dueDay);
  });

  openModal('modal-account');
}

function saveAccount() {
  const id    = document.getElementById('account-id').value;
  const name  = document.getElementById('account-name').value.trim();
  const due   = parseInt(document.getElementById('account-due').value);
  const obs   = document.getElementById('account-obs').value.trim();

  if (!name) {
    shakeElement(document.getElementById('account-name'));
    showToast('Digite o nome da conta!', 'error');
    return;
  }
  if (!due || due < 1 || due > 31) {
    shakeElement(document.getElementById('day-picker'));
    showToast('Selecione o dia de vencimento!', 'error');
    return;
  }

  const currentMonth = getCurrentMonth();

  if (id) {
    // Edit existing
    const idx = STATE.accounts.findIndex(a => a.id === id);
    if (idx >= 0) {
      STATE.accounts[idx].name        = name;
      STATE.accounts[idx].dueDay      = due;
      STATE.accounts[idx].observation = obs;
      STATE.accounts[idx].updatedAt   = Date.now();
      showToast('Conta atualizada! ✅', 'success');
    }
  } else {
    // New account
    const newAccount = {
      id:          generateId(),
      name,
      dueDay:      due,
      observation: obs,
      createdAt:   Date.now()
    };
    STATE.accounts.push(newAccount);

    // Create record for current month
    if (!STATE.records[currentMonth]) STATE.records[currentMonth] = {};
    STATE.records[currentMonth][newAccount.id] = { status: 'pending', paidAt: null };

    showToast('Conta adicionada! 🎉', 'success');
  }

  saveState();
  closeModal('modal-account');
  renderDashboard();
}

// ================================================================
// MARK AS PAID
// ================================================================
function markAsPaid(accountId) {
  const account = STATE.accounts.find(a => a.id === accountId);
  if (!account) return;

  const currentMonth = getCurrentMonth();
  if (!STATE.records[currentMonth]) STATE.records[currentMonth] = {};

  const status = getAccountStatus(account);
  if (status === 'paid') {
    showToast('Conta já está paga!', 'info');
    return;
  }

  const now = Date.now();
  STATE.records[currentMonth][accountId] = { status: 'paid', paidAt: now };

  // Add to history
  STATE.history.push({
    id:          generateId(),
    accountId,
    accountName: account.name,
    month:       currentMonth,
    dueDay:      account.dueDay,
    paidAt:      now
  });

  saveState();
  showToast(`"${account.name}" marcada como paga! ✅`, 'success');

  closeModal('modal-detail');
  renderDashboard();
  scheduleNotifications();
}

// ================================================================
// DELETE ACCOUNT
// ================================================================
function deleteAccount(accountId) {
  const account = STATE.accounts.find(a => a.id === accountId);
  if (!account) return;

  openConfirm(
    'Excluir Conta',
    `Deseja excluir a conta "${account.name}"? Esta ação não pode ser desfeita.`,
    () => {
      // IMPORTANTE: não reatribuir STATE.accounts (quebraria referências)
      // Em vez disso, muta o array no lugar
      const idx = STATE.accounts.findIndex(a => a.id === accountId);
      if (idx !== -1) STATE.accounts.splice(idx, 1);

      // Remove dos registros de todos os meses
      Object.keys(STATE.records).forEach(month => {
        delete STATE.records[month][accountId];
      });
      saveState();
      closeModal('modal-detail');
      renderDashboard();
      showToast('Conta excluída!', 'warning');
    }
  );
}

// ================================================================
// MODAL HELPERS
// ================================================================
function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const firstFocusable = overlay.querySelector('button:not([disabled]), input, textarea, select');
    if (firstFocusable) firstFocusable.focus();
  }, 100);
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

function openConfirm(title, message, callback) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  STATE.ui.confirmCallback = callback;
  openModal('modal-confirm');
}

// ================================================================
// NAVIGATION
// ================================================================
function navigateTo(view) {
  // Ignora views indefinidas (ex: o div espaçador do FAB)
  if (!view) return;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`view-${view}`);
  const navBtn = document.getElementById(`nav-${view}`);

  if (target) target.classList.add('active');
  if (navBtn) navBtn.classList.add('active');

  STATE.ui.currentView = view;

  // Renderiza a view destino
  if (view === 'history')   renderHistory();
  if (view === 'settings')  renderSettings();
  if (view === 'dashboard') renderDashboard();
}

// ================================================================
// SETTINGS RENDER
// ================================================================
function renderSettings() {
  const toggleDark = document.getElementById('toggle-dark');
  if (toggleDark) toggleDark.checked = STATE.settings.darkMode;

  // Guarda: Notification API pode não existir em file:// ou browsers antigos
  const notifSupported = ('Notification' in window);
  const notifStatus    = notifSupported ? Notification.permission : 'unsupported';

  const statusText = {
    'granted':     'Notificações ativadas ✅',
    'denied':      'Notificações bloqueadas ❌',
    'default':     'Receber alertas de vencimento',
    'unsupported': 'Navegador não suporta notificações'
  };

  const notifTextEl = document.getElementById('notif-status-text');
  if (notifTextEl) notifTextEl.textContent = statusText[notifStatus] || statusText['default'];

  const enableBtn = document.getElementById('btn-enable-notif');
  if (enableBtn) {
    if (!notifSupported || notifStatus === 'unsupported') {
      enableBtn.textContent = 'Não suportado';
      enableBtn.disabled = true;
    } else if (notifStatus === 'granted') {
      enableBtn.textContent = 'Ativadas';
      enableBtn.disabled = true;
    } else if (notifStatus === 'denied') {
      enableBtn.textContent = 'Bloqueadas';
      enableBtn.disabled = true;
    } else {
      enableBtn.textContent = 'Ativar';
      enableBtn.disabled = false;
    }
  }
}

// ================================================================
// DARK MODE
// ================================================================
function setTheme(dark) {
  STATE.settings.darkMode = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  
  // Update toggle in settings
  const toggle = document.getElementById('toggle-dark');
  if (toggle) toggle.checked = dark;

  // Update header icons
  document.getElementById('icon-moon').classList.toggle('hidden', !dark);
  document.getElementById('icon-sun').classList.toggle('hidden', dark);
  
  saveState();
}

// ================================================================
// NOTIFICATIONS
// ================================================================
async function requestNotifications() {
  if (!('Notification' in window)) {
    showToast('Seu navegador não suporta notificações', 'error');
    return;
  }
  // Protocolo file:// bloqueia Notifications no Chrome
  if (window.location.protocol === 'file:') {
    showToast('Notificações precisam de servidor HTTP. Abra o arquivo via servidor local ou use no celular.', 'warning');
    return;
  }

  const permission = await Notification.requestPermission();
  STATE.settings.notificationsEnabled = permission === 'granted';
  saveState();

  if (permission === 'granted') {
    showToast('Notificações ativadas! 🔔', 'success');
    scheduleNotifications();
    renderSettings();
  } else if (permission === 'denied') {
    showToast('Notificações bloqueadas. Ative nas configurações do navegador.', 'error');
    renderSettings();
  }
}

function scheduleNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const today = getCurrentDay();
  STATE.accounts.forEach(acc => {
    const status = getAccountStatus(acc);
    if (status === 'late') {
      sendNotification(`🔴 Conta Atrasada: ${acc.name}`,
        `A conta "${acc.name}" venceu no dia ${acc.dueDay} e ainda não foi paga!`);
    } else if (status === 'today') {
      sendNotification(`🟡 Vence Hoje: ${acc.name}`,
        `A conta "${acc.name}" vence hoje! Não esqueça de pagar.`);
    } else if (status === 'soon') {
      const days = acc.dueDay - today;
      sendNotification(`🔵 Vence em Breve: ${acc.name}`,
        `A conta "${acc.name}" vence em ${days} dia${days > 1 ? 's' : ''} (dia ${acc.dueDay}).`);
    }
  });
}

function sendNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💳</text></svg>',
      tag: 'minhas-contas',
      silent: false
    });
  } catch(e) {
    console.warn('Notificação não enviada:', e);
  }
}

// ================================================================
// BACKUP / RESTORE
// ================================================================
function exportBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: 2,
    accounts: STATE.accounts,
    records:  STATE.records,
    history:  STATE.history,
    settings: STATE.settings
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `minhas-contas-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exportado! 📤', 'success');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.accounts) throw new Error('Arquivo inválido');

      openConfirm(
        'Importar Backup',
        'Isso substituirá TODOS os dados atuais. Deseja continuar?',
        () => {
          STATE.accounts.length = 0;
          STATE.accounts.push(...(data.accounts || []));
          Object.keys(STATE.records).forEach(k => delete STATE.records[k]);
          Object.assign(STATE.records, data.records || {});
          STATE.history.length = 0;
          STATE.history.push(...(data.history || []));
          Object.assign(STATE.settings, data.settings || {});

          ensureCurrentMonthRecords();
          saveState();
          setTheme(STATE.settings.darkMode);
          renderDashboard();
          showToast('Backup importado com sucesso! 📥', 'success');
        }
      );
    } catch(err) {
      showToast('Arquivo inválido! Verifique o formato JSON.', 'error');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  openConfirm(
    '⚠️ Limpar Todos os Dados',
    'Isso apagará TODAS as contas, histórico e configurações permanentemente. Tem certeza?',
    () => {
      localStorage.removeItem(STORAGE_KEY);
      STATE.accounts.length = 0;
      Object.keys(STATE.records).forEach(k => delete STATE.records[k]);
      STATE.history.length = 0;
      STATE.settings.lastResetMonth = null;
      saveState();
      renderDashboard();
      showToast('Todos os dados foram apagados.', 'warning');
    }
  );
}

// ================================================================
// UI HELPERS
// ================================================================
function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', default: '💬' };
  toast.innerHTML = `<span>${icons[type] || icons.default}</span> ${escapeHtml(message)}`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function addRipple(element, event) {
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = (event.clientX - rect.left) - size / 2;
  const y = (event.clientY - rect.top) - size / 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  element.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

function shakeElement(el) {
  el.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(-8px)' },
    { transform: 'translateX(8px)' },
    { transform: 'translateX(-8px)' },
    { transform: 'translateX(0)' }
  ], { duration: 300, easing: 'ease-in-out' });
}

function buildDayPicker() {
  const picker = document.getElementById('day-picker');
  let html = '';
  for (let d = 1; d <= 31; d++) {
    html += `<button type="button" class="day-btn" data-day="${d}" aria-label="Dia ${d}">${d}</button>`;
  }
  picker.innerHTML = html;

  picker.addEventListener('click', e => {
    const btn = e.target.closest('.day-btn');
    if (!btn) return;
    const day = parseInt(btn.dataset.day);
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('account-due').value = day;
  });
}

// ================================================================
// SUMMARY CARD FILTERS (click to filter list)
// ================================================================
function bindSummaryCardFilters() {
  const mapping = {
    'summary-late':  'late',
    'summary-today': 'today',
    'summary-soon':  'soon',
    'summary-paid':  'paid'
  };

  Object.entries(mapping).forEach(([cardId, status]) => {
    document.getElementById(cardId)?.addEventListener('click', () => {
      const wasActive = STATE.ui.filterStatus === status;
      STATE.ui.filterStatus = wasActive ? 'all' : status;
      
      // Update chip
      document.querySelectorAll('.chip').forEach(c => {
        c.classList.toggle('active', c.dataset.filter === STATE.ui.filterStatus);
      });
      
      renderDashboard();
    });
  });
}

// ================================================================
// EVENT BINDINGS
// ================================================================
function bindEvents() {
  // Navigation — só nos botões que têm data-view definido
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  // FAB
  document.getElementById('btn-add').addEventListener('click', openAddModal);

  // Theme toggle (header)
  document.getElementById('btn-theme').addEventListener('click', () => {
    setTheme(!STATE.settings.darkMode);
  });

  // Theme toggle (settings)
  document.getElementById('toggle-dark').addEventListener('change', e => {
    setTheme(e.target.checked);
  });

  // Search toggle
  document.getElementById('btn-search-toggle').addEventListener('click', () => {
    const bar = document.getElementById('search-bar');
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) {
      document.getElementById('search-input').focus();
    }
  });

  // Search input
  document.getElementById('search-input').addEventListener('input', e => {
    STATE.ui.searchQuery = e.target.value;
    renderDashboard();
  });

  // Search clear
  document.getElementById('btn-search-clear').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    STATE.ui.searchQuery = '';
    renderDashboard();
  });

  // Filter chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.ui.filterStatus = chip.dataset.filter;
      renderDashboard();
    });
  });

  // Modal close buttons
  document.getElementById('btn-modal-close').addEventListener('click', () => closeModal('modal-account'));
  document.getElementById('btn-cancel-account').addEventListener('click', () => closeModal('modal-account'));
  document.getElementById('btn-detail-back').addEventListener('click', () => closeModal('modal-detail'));

  // Close modals by clicking overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Save account
  document.getElementById('btn-save-account').addEventListener('click', saveAccount);

  // Enter to save
  document.getElementById('account-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveAccount();
  });

  // Detail actions
  document.getElementById('btn-mark-paid').addEventListener('click', () => {
    markAsPaid(STATE.ui.detailAccountId);
  });

  document.getElementById('btn-edit-account').addEventListener('click', () => {
    openEditModal(STATE.ui.detailAccountId);
  });

  document.getElementById('btn-delete-account').addEventListener('click', () => {
    deleteAccount(STATE.ui.detailAccountId);
  });

  // Confirm modal
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => closeModal('modal-confirm'));
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    if (STATE.ui.confirmCallback) STATE.ui.confirmCallback();
    STATE.ui.confirmCallback = null;
    closeModal('modal-confirm');
  });

  // Settings
  document.getElementById('btn-enable-notif').addEventListener('click', requestNotifications);
  document.getElementById('btn-notif').addEventListener('click', requestNotifications);

  document.getElementById('btn-test-notif').addEventListener('click', () => {
    if (Notification.permission !== 'granted') {
      showToast('Ative as notificações primeiro!', 'warning');
      return;
    }
    sendNotification('🔔 Teste — Minhas Contas', 'As notificações estão funcionando! ✅');
    showToast('Notificação de teste enviada!', 'info');
  });

  document.getElementById('btn-export').addEventListener('click', exportBackup);

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) {
      importBackup(e.target.files[0]);
      e.target.value = '';
    }
  });

  document.getElementById('btn-clear-all').addEventListener('click', clearAllData);

  // History filter
  document.getElementById('history-month-filter').addEventListener('change', renderHistory);

  // Keyboard: ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['modal-account', 'modal-detail', 'modal-confirm'].forEach(id => {
        if (!document.getElementById(id).classList.contains('hidden')) {
          closeModal(id);
        }
      });
    }
  });

  // Summary card filter
  bindSummaryCardFilters();
}

// ================================================================
// SAMPLE DATA (first time)
// ================================================================
function addSampleData() {
  const samples = [
    { name: 'Aluguel',           dueDay: 3,  observation: '' },
    { name: 'Cartão Nubank',     dueDay: 5,  observation: '' },
    { name: 'Internet Casa',     dueDay: 1,  observation: 'Vivo Fibra' },
    { name: 'Água',              dueDay: 10, observation: '' },
    { name: 'Energia Elétrica',  dueDay: 15, observation: '' }
  ];

  const currentMonth = getCurrentMonth();
  if (!STATE.records[currentMonth]) STATE.records[currentMonth] = {};

  samples.forEach(s => {
    const acc = { id: generateId(), name: s.name, dueDay: s.dueDay, observation: s.observation, createdAt: Date.now() };
    STATE.accounts.push(acc);
    STATE.records[currentMonth][acc.id] = { status: 'pending', paidAt: null };
  });

  saveState();
}

// ================================================================
// INIT
// ================================================================
function init() {
  // Load data
  loadState();

  // Monthly reset check
  checkMonthlyReset();
  ensureCurrentMonthRecords();

  // First-time setup: add sample data
  if (STATE.accounts.length === 0) {
    addSampleData();
  }

  // Apply theme
  setTheme(STATE.settings.darkMode);

  // Build day picker
  buildDayPicker();

  // Bind all events
  bindEvents();

  // Initial render
  renderDashboard();

  // Splash screen dismiss
  setTimeout(() => {
    const splash = document.getElementById('splash');
    const app    = document.getElementById('app');
    splash.classList.add('fade-out');
    app.classList.remove('hidden');
    setTimeout(() => splash.remove(), 600);
  }, 1400);

  // Auto-schedule notifications on startup
  if (STATE.settings.notificationsEnabled || Notification.permission === 'granted') {
    setTimeout(scheduleNotifications, 2000);
  }

  // PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install hint after 5 seconds
    setTimeout(() => {
      showToast('📲 Adicione ao seu celular: menu do navegador → "Adicionar à tela inicial"', 'info');
    }, 5000);
  });
}

// ================================================================
// START
// ================================================================
document.addEventListener('DOMContentLoaded', init);
