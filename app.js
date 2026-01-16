document.addEventListener('DOMContentLoaded', () => {
    // --- State & Constants ---
    const STATUSES = ['Nowe', 'W toku', 'Zrealizowane'];
    let currentDragItem = null;
    let currentDragType = null; // 'req' or 'q'

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    // Modals
    const modalReq = document.getElementById('modal-req');
    const modalQ = document.getElementById('modal-q');
    const closeBtns = document.querySelectorAll('.close-modal');

    // Forms
    const formReq = document.getElementById('form-req');
    const formQ = document.getElementById('form-q');

    // Boards & Lists
    // Req
    const reqKanbanNowe = document.getElementById('req-kanban-nowe');
    const reqKanbanW = document.getElementById('req-kanban-w-toku');
    const reqListAll = document.getElementById('req-list-all');
    // Q
    const qKanbanNowe = document.getElementById('q-kanban-nowe');
    const qKanbanW = document.getElementById('q-kanban-w-toku');
    const qListAll = document.getElementById('q-list-all');

    // Buttons
    const refreshReqBtn = document.getElementById('refresh-req-btn');
    const refreshQBtn = document.getElementById('refresh-q-btn');
    const connectionStatus = document.getElementById('connection-status');

    // Settings
    const settingsAuthorInput = document.getElementById('settings-author');
    const clearDataBtn = document.getElementById('clear-data-btn');

    // --- Initialization ---
    init();

    function init() {
        setupTabs();
        setupModals();
        setupForms();
        setupSettings();
        setupSyncLogic();
        renderRequirements();
        renderQuestions();
        updateOnlineStatus(); // Initial check
    }

    // --- Tabs ---
    function setupTabs() {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });
    }

    // --- Modals ---
    function setupModals() {
        if (document.getElementById('add-req-btn')) {
            document.getElementById('add-req-btn').addEventListener('click', () => {
                modalReq.style.display = 'flex';
            });
        }

        if (document.getElementById('add-q-btn')) {
            document.getElementById('add-q-btn').addEventListener('click', () => {
                modalQ.style.display = 'flex';
            });
        }

        closeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    // --- Sync Logic ---
    function setupSyncLogic() {
        window.addEventListener('online', () => {
            updateOnlineStatus();
            performSync();
        });
        window.addEventListener('offline', updateOnlineStatus);

        if (refreshReqBtn) {
            refreshReqBtn.addEventListener('click', performSync);
        }
        if (refreshQBtn) {
            refreshQBtn.addEventListener('click', performSync);
        }

        // Initial sync if online
        if (navigator.onLine) {
            performSync();
        }
    }

    function updateOnlineStatus() {
        if (navigator.onLine) {
            connectionStatus.classList.remove('offline');
            connectionStatus.classList.add('online');
            connectionStatus.innerHTML = '<div class="status-dot"></div><span class="status-text">Online</span>';
        } else {
            connectionStatus.classList.remove('online');
            connectionStatus.classList.add('offline');
            connectionStatus.innerHTML = '<div class="status-dot"></div><span class="status-text">Offline</span>';
        }
    }

    async function performSync() {
        if (!navigator.onLine) {
            showToast('Brak sieci. Tryb offline.', 'error');
            return;
        }

        showToast('Synchronizacja...', 'info');
        try {
            // 1. Fetch Lists
            const [reqs, qs] = await Promise.all([
                API.getRequirements(),
                API.getQuestions()
            ]);

            // 2. Sync Logic (merge with local)
            Storage.syncRequirements(reqs);
            Storage.syncQuestions(qs);

            // 3. Re-render
            renderRequirements();
            renderQuestions();
            showToast('Zsynchronizowano pomyślnie!', 'success');

        } catch (e) {
            console.error(e);
            showToast('Błąd synchronizacji!', 'error');
        }
    }

    // --- Forms & Data Handling ---
    function setupForms() {
        formReq.addEventListener('submit', async (e) => {
            e.preventDefault();
            const co = document.getElementById('req-what').value;
            const ilosc = document.getElementById('req-amount').value;
            const producent = document.getElementById('req-producer').value;
            const uwagi = document.getElementById('req-notes').value;
            const settings = Storage.getSettings();

            if (!co || !ilosc) return;

            const newItem = {
                id: 'local-' + Date.now(),
                co,
                ilosc,
                producent,
                uwagi,
                autor: settings.author,
                status: 'Nowe',
                createdAt: Date.now(),
                syncError: false
            };

            Storage.addRequirement(newItem);
            renderRequirements();
            modalReq.style.display = 'none';
            formReq.reset();
            showToast('Dodano zapotrzebowanie', 'success');

            // Try push to backend immediately if online
            if (navigator.onLine) {
                try {
                    const response = await API.addRequirement({
                        co, ilosc, producent, autor: settings.author, uwagi
                    });
                    if (response.id) {
                        // Update ID from server but keep other local changes if any occurred in split second? 
                        // For now assume simple swap
                        newItem.id = response.id;
                        Storage.updateRequirement(newItem);
                        renderRequirements(); // re-render to update ID in DOM
                    }
                } catch (err) {
                    console.error('Push error', err);
                    // Remains 'local-' id, will be picked up by future merge strategy or similar
                }
            }
        });

        formQ.addEventListener('submit', async (e) => {
            e.preventDefault();
            const opis = document.getElementById('q-desc').value;
            const termin = document.getElementById('q-date').value;
            const priorytet = document.getElementById('q-priority').value;
            const settings = Storage.getSettings();

            if (!opis) return;

            const newItem = {
                id: 'local-' + Date.now(),
                opis,
                termin_odpowiedzi: termin,
                priorytet,
                autor: settings.author,
                status: 'Nowe',
                createdAt: Date.now(),
                syncError: false
            };

            Storage.addQuestion(newItem);
            renderQuestions();
            modalQ.style.display = 'none';
            formQ.reset();
            showToast('Dodano pytanie', 'success');

            if (navigator.onLine) {
                try {
                    const response = await API.addQuestion({
                        opis, termin_odpowiedzi: termin, priorytet, autor: settings.author
                    });
                    if (response.id) {
                        newItem.id = response.id;
                        Storage.updateQuestion(newItem);
                        renderQuestions();
                    }
                } catch (err) {
                    console.error('Push error', err);
                }
            }
        });
    }


    // --- Rendering ---
    function renderRequirements() {
        const items = Storage.getRequirements();

        // Clear containers
        if (reqKanbanNowe) reqKanbanNowe.innerHTML = '';
        if (reqKanbanW) reqKanbanW.innerHTML = '';
        if (reqListAll) reqListAll.innerHTML = '';

        items.forEach(item => {
            if (!item.co) return; // Skip empty

            // 1. Add to Kanban if Status is relevant
            if (item.status === 'Nowe' && reqKanbanNowe) {
                reqKanbanNowe.appendChild(createCard('req', item));
            } else if (item.status === 'W toku' && reqKanbanW) {
                reqKanbanW.appendChild(createCard('req', item));
            }
            // "Zrealizowane" don't show in Kanban (top), only in bottom list usually, 
            // OR if we had a column for it. We removed column from HTML structure to follow "Horizontal scroll" prompt where usually only active stuff is shown?
            // User prompt: "KANBAN (SCROLL POZIOMY)" followed by "LISTA ZBIORCZA".
            // Let's assume Kanban has New + In Progress. 

            // 2. Add to Bottom List (All items)
            if (reqListAll) {
                reqListAll.appendChild(createListItem('req', item));
            }
        });
    }

    function renderQuestions() {
        const items = Storage.getQuestions();

        if (qKanbanNowe) qKanbanNowe.innerHTML = '';
        if (qKanbanW) qKanbanW.innerHTML = '';
        if (qListAll) qListAll.innerHTML = '';

        items.forEach(item => {
            if (!item.opis) return;

            if (item.status === 'Nowe' && qKanbanNowe) {
                qKanbanNowe.appendChild(createCard('q', item));
            } else if (item.status === 'W toku' && qKanbanW) {
                qKanbanW.appendChild(createCard('q', item));
            }

            if (qListAll) {
                qListAll.appendChild(createListItem('q', item));
            }
        });
    }

    // --- Components ---
    function createCard(type, item) {
        const div = document.createElement('div');
        div.className = 'card';
        div.dataset.id = item.id;

        // Badge
        let badgeClass = 'badge-new';
        let badgeText = item.status || 'Nowe';

        if (item.status === 'Nowe') {
            badgeClass = 'badge-new';
            badgeText = 'NOWE';
        } else if (item.status === 'W toku') {
            badgeClass = 'badge-in-progress';
            badgeText = 'W TOKU';
        } else if (item.status === 'Zrealizowane') {
            badgeClass = 'badge-done';
            badgeText = 'ZREALIZOWANE';
        }

        const badge = document.createElement('span');
        badge.className = `card-badge ${badgeClass}`;
        badge.textContent = badgeText;
        div.appendChild(badge);

        // Title
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = type === 'req' ? shortenText(item.co, 50) : shortenText(item.opis, 50);
        div.appendChild(title);

        // Meta
        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const iconStyle = ''; // handled by css

        if (type === 'req') {
            meta.innerHTML = `
                 <div class="meta-row">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                     <span>${item.ilosc}</span>
                 </div>
                 <div class="meta-row">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                     <span>${item.autor || 'Anonim'}</span>
                 </div>
             `;
        } else {
            meta.innerHTML = `
                 <div class="meta-row">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                     <span>${item.termin_odpowiedzi || 'Brak terminu'}</span>
                 </div>
                  <div class="meta-row">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                     <span>${item.autor || 'Anonim'}</span>
                 </div>
             `;
        }
        div.appendChild(meta);

        // Quick Status Actions
        const actions = document.createElement('div');
        actions.className = 'card-actions';

        if (item.status === 'Nowe') {
            const btn = document.createElement('button');
            btn.className = 'status-btn btn-orange'; // -> W toku
            btn.innerHTML = '<span>→ W toku</span>';
            btn.onclick = (e) => { e.stopPropagation(); changeStatus(type, item, 'W toku'); };
            actions.appendChild(btn);
        } else if (item.status === 'W toku') {
            const btn = document.createElement('button');
            btn.className = 'status-btn btn-green'; // -> Zrealizowane
            btn.innerHTML = '<span>✓ Gotowe</span>';
            btn.onclick = (e) => { e.stopPropagation(); changeStatus(type, item, 'Zrealizowane'); };
            actions.appendChild(btn);
        }

        if (actions.children.length > 0) div.appendChild(actions);

        return div;
    }

    function createListItem(type, item) {
        const div = document.createElement('div');
        div.className = 'list-item';

        let statusColor = '#3B82F6';
        if (item.status === 'W toku') statusColor = '#F59E0B';
        if (item.status === 'Zrealizowane') statusColor = '#10B981';

        div.innerHTML = `
            <div class="list-item-content">
                <div class="list-item-title">${type === 'req' ? item.co : item.opis}</div>
                <div class="list-item-meta">${item.autor || 'Anonim'} • ${type === 'req' ? item.ilosc : (item.termin_odpowiedzi || '')}</div>
            </div>
            <div class="list-item-status" style="background-color: ${statusColor}20; color: ${statusColor}">
                ${item.status}
            </div>
        `;
        return div;
    }

    // --- Actions ---
    async function changeStatus(type, item, newStatus) {
        const oldStatus = item.status;
        item.status = newStatus;

        if (type === 'req') {
            Storage.updateRequirement(item);
            renderRequirements();
        } else {
            Storage.updateQuestion(item);
            renderQuestions();
        }

        // API Call
        if (navigator.onLine) {
            try {
                if (type === 'req') {
                    await API.updateRequirementStatus(item.id, newStatus);
                } else {
                    await API.updateQuestionStatus(item.id, newStatus);
                }
                showToast('Status zaktualizowany online', 'success');
            } catch (err) {
                console.error("Status update error", err);
                item.status = oldStatus; // Revert on fail? Or just keep local and retry later. 
                // Currently keeping local change but notifying error.
                // In real app, might want a queue.
                showToast('Zapisano lokalnie (błąd sieci)', 'info');
            }
        } else {
            showToast('Zapisano offline', 'info');
        }
    }

    function shortenText(text, max) {
        if (!text) return '';
        return text.length > max ? text.substring(0, max) + '...' : text;
    }

    function setupSettings() {
        const settings = Storage.getSettings();
        const authorInput = document.getElementById('settings-author');
        if (authorInput) {
            authorInput.value = settings.author;
            authorInput.addEventListener('change', () => {
                const newSettings = { author: authorInput.value };
                Storage.saveSettings(newSettings);
                showToast('Zapisano ustawienia', 'success');
            });
        }

        const clearBtn = document.getElementById('clear-data-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Czy na pewno wyczyścić dane?')) {
                    Storage.clearAll();
                    location.reload();
                }
            });
        }
    }

    function showToast(msg, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast show';
        if (type === 'error') toast.style.backgroundColor = '#DC2626';
        if (type === 'success') toast.style.backgroundColor = '#059669';

        toast.textContent = msg;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
