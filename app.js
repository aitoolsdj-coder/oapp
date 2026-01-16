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

    // Boards
    const reqBoard = document.getElementById('req-board');
    const qBoard = document.getElementById('q-board');

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
        renderRequirements();
        renderQuestions();
        setupGlobalEvents(); // For drag & drop delegation
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

    // --- Forms & Data Handling ---
    function setupForms() {
        formReq.addEventListener('submit', async (e) => {
            e.preventDefault();
            const co = document.getElementById('req-what').value;
            const ilosc = document.getElementById('req-amount').value;
            const producent = document.getElementById('req-producer').value;
            const uwagi = document.getElementById('req-notes').value;
            const settings = Storage.getSettings();

            if (!co || !ilosc) return; // Basic validation

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

            // Local Save
            Storage.addRequirement(newItem);
            renderRequirements();
            modalReq.style.display = 'none';
            formReq.reset();
            showToast('Dodano zapotrzebowanie', 'success');

            // API Sync
            try {
                const response = await API.addRequirement({
                    co, ilosc, producent, autor: settings.author, uwagi
                });

                if (response.id) {
                    const items = Storage.getRequirements();
                    const index = items.findIndex(i => i.createdAt === newItem.createdAt);
                    if (index !== -1) {
                        items[index].id = response.id;
                        Storage.saveRequirements(items);
                        renderRequirements();
                    }
                }
            } catch (err) {
                console.error("Sync error", err);
                markSyncError('req', newItem.id);
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

            try {
                const response = await API.addQuestion({
                    opis, termin_odpowiedzi: termin, priorytet, autor: settings.author
                });
                if (response.id) {
                    const items = Storage.getQuestions();
                    const index = items.findIndex(i => i.createdAt === newItem.createdAt);
                    if (index !== -1) {
                        items[index].id = response.id;
                        Storage.saveQuestions(items);
                        renderQuestions();
                    }
                }
            } catch (err) {
                markSyncError('q', newItem.id);
            }
        });
    }

    function markSyncError(type, id) {
        if (type === 'req') {
            const items = Storage.getRequirements();
            const item = items.find(i => i.id === id);
            if (item) {
                item.syncError = true;
                Storage.saveRequirements(items);
                renderRequirements();
            }
        } else {
            const items = Storage.getQuestions();
            const item = items.find(i => i.id === id);
            if (item) {
                item.syncError = true;
                Storage.saveQuestions(items);
                renderQuestions();
            }
        }
        showToast('Błąd synchronizacji', 'error');
    }

    // --- Rendering ---
    function renderRequirements() {
        const items = Storage.getRequirements();
        // Clear lists
        const listNowe = document.getElementById('req-list-nowe');
        const listW = document.getElementById('req-list-w-toku');
        const listZ = document.getElementById('req-list-zrealizowane');

        if (listNowe) listNowe.innerHTML = '';
        if (listW) listW.innerHTML = '';
        if (listZ) listZ.innerHTML = '';

        items.forEach(item => {
            const card = createCard('req', item);
            const listId = `req-list-${item.status.toLowerCase().replace(' ', '-')}`;
            const list = document.getElementById(listId);
            if (list) list.appendChild(card);
        });
    }

    function renderQuestions() {
        const items = Storage.getQuestions();
        const listNowe = document.getElementById('q-list-nowe');
        const listW = document.getElementById('q-list-w-toku');
        const listZ = document.getElementById('q-list-zrealizowane');

        if (listNowe) listNowe.innerHTML = '';
        if (listW) listW.innerHTML = '';
        if (listZ) listZ.innerHTML = '';

        items.forEach(item => {
            const card = createCard('q', item);
            const listId = `q-list-${item.status.toLowerCase().replace(' ', '-')}`;
            const list = document.getElementById(listId);
            if (list) list.appendChild(card);
        });
    }

    function createCard(type, item) {
        const div = document.createElement('div');
        div.className = 'card';
        // Note: Inline style sync error check was replaced by CSS class in previous approach, 
        // but new CSS might not have .sync-error style. Adding inline to be safe or class.
        if (item.syncError) div.style.borderLeft = '4px solid #FF3B30';
        div.draggable = true;
        div.dataset.id = item.id;
        div.dataset.type = type;

        // Badge Logic - matching the requested style screenshot
        let badgeClass = 'badge-blue';
        let badgeText = item.status;

        if (type === 'q') {
            // Priority handling
            if (item.priorytet === 'Wysoki') badgeClass = 'badge-orange';
            else if (item.priorytet === 'Sredni') badgeClass = 'badge-orange';
            else badgeClass = 'badge-green';
            badgeText = `Priorytet: ${item.priorytet}`;
        } else {
            // Status handling for Requirements
            // Mapping statuses to display names from image if desired, or sticking to logic
            if (item.status === 'Nowe') {
                badgeClass = 'badge-orange';
                badgeText = 'Oczekujące'; // from screenshot 'Oczekujące' matches 'Nowe' bucket
            }
            else if (item.status === 'W toku') {
                badgeClass = 'badge-blue';
                badgeText = 'Zatwierdzone'; // from screenshot 'Zatwierdzone' matches 'W toku' bucket in previous logic
            }
            else if (item.status === 'Zrealizowane') {
                badgeClass = 'badge-green';
                badgeText = 'Zrealizowane';
            }
        }

        const badge = document.createElement('span');
        badge.className = `card-badge ${badgeClass}`;
        badge.textContent = badgeText;
        div.appendChild(badge);

        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = type === 'req' ? item.co : item.opis;
        div.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'card-meta';

        // Helper for SVG
        const iconStyle = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

        if (type === 'req') {
            meta.innerHTML = `
                 <div class="meta-row">
                     <svg ${iconStyle}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                     <span>Ilość: ${item.ilosc}</span>
                 </div>
                 <div class="meta-row">
                     <svg ${iconStyle}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                     <span>Termin: ${item.termin || '2026-01-25'}</span> 
                 </div>
                 <div class="meta-row">
                     <svg ${iconStyle}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                     <span>Zgłaszający: ${item.autor}</span>
                 </div>
             `;
        } else {
            meta.innerHTML = `
                 <div class="meta-row">
                     <svg ${iconStyle}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                     <span>Termin: ${item.termin_odpowiedzi || 'Brak'}</span>
                 </div>
                 <div class="meta-row">
                     <svg ${iconStyle}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                     <span>Autor: ${item.autor}</span>
                 </div>
             `;
        }
        div.appendChild(meta);

        // Actions
        // In the design, actions are buttons at bottom? 
        // Or maybe drag & drop info. 
        // Screenshot implies clean cards. We'll add status buttons for functionality.
        const actions = document.createElement('div');
        actions.className = 'card-actions';

        if (item.status === 'Nowe') {
            const btn = document.createElement('button');
            btn.className = 'status-btn';
            btn.innerHTML = '<span>→ W toku</span>';
            btn.onclick = (e) => { e.stopPropagation(); changeStatus(type, item.id, 'W toku'); };
            actions.appendChild(btn);
        } else if (item.status === 'W toku') {
            const btn = document.createElement('button');
            btn.className = 'status-btn';
            btn.style.backgroundColor = '#10B981'; // Green
            btn.innerHTML = '<span>✓ Zrealizowane</span>';
            btn.onclick = (e) => { e.stopPropagation(); changeStatus(type, item.id, 'Zrealizowane'); };
            actions.appendChild(btn);
        }

        // Sync retry
        if (item.syncError) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'action-btn'; // Needs basic styling if not in new css
            retryBtn.style.border = '1px solid currentColor';
            retryBtn.style.padding = '4px 8px';
            retryBtn.style.borderRadius = '4px';
            retryBtn.textContent = 'Ponów Sync';
            retryBtn.onclick = (e) => {
                e.stopPropagation();
                retrySync(type, item);
            };
            actions.appendChild(retryBtn);
        }

        if (actions.children.length > 0) div.appendChild(actions);

        // Drag Events
        div.addEventListener('dragstart', (e) => {
            currentDragItem = item;
            currentDragType = type;
            e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, type }));
            div.style.opacity = '0.5';
        });

        div.addEventListener('dragend', () => {
            div.style.opacity = '1';
            currentDragItem = null;
            currentDragType = null;
        });

        return div;
    }

    function shortenText(text) {
        return text.length > 40 ? text.substring(0, 40) + '...' : text;
    }

    // --- Actions ---
    async function changeStatus(type, id, newStatus) {
        let item, items;
        if (type === 'req') {
            items = Storage.getRequirements();
            item = items.find(i => i.id == id);
        } else {
            items = Storage.getQuestions();
            item = items.find(i => i.id == id);
        }

        if (!item) return;
        const oldStatus = item.status;
        item.status = newStatus;

        if (type === 'req') {
            Storage.saveRequirements(items);
            renderRequirements();
        } else {
            Storage.saveQuestions(items);
            renderQuestions();
        }

        showToast(`Status zmieniony!`, 'success');

        try {
            if (type === 'req') {
                await API.updateRequirementStatus(item.id, newStatus);
            } else {
                await API.updateQuestionStatus(item.id, newStatus);
            }
        } catch (err) {
            console.error("Status update error", err);
            item.status = oldStatus;
            if (type === 'req') {
                Storage.saveRequirements(items);
                renderRequirements();
            } else {
                Storage.saveQuestions(items);
                renderQuestions();
            }
            showToast('Błąd synchronizacji online', 'error');
        }
    }

    async function retrySync(type, item) {
        item.syncError = false;
        if (type === 'req') Storage.updateRequirement(item);
        else Storage.updateQuestion(item);

        if (type === 'req') renderRequirements();
        else renderQuestions();

        try {
            if (String(item.id).startsWith('local-')) {
                let res;
                if (type === 'req') {
                    res = await API.addRequirement(item);
                } else {
                    res = await API.addQuestion(item);
                }

                if (res && res.id) {
                    item.id = res.id;
                    if (type === 'req') Storage.updateRequirement(item);
                    else Storage.updateQuestion(item);
                    showToast('Zsynchronizowano!', 'success');
                }
            }
        } catch (err) {
            item.syncError = true;
            if (type === 'req') Storage.updateRequirement(item);
            else Storage.updateQuestion(item);
            if (type === 'req') renderRequirements();
            else renderQuestions();
            showToast('Błąd synchronizacji', 'error');
        }
    }

    // --- Drag & Drop ---
    function setupGlobalEvents() {
        const columns = document.querySelectorAll('.kanban-column');
        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                col.classList.add('drag-over');
            });
            col.addEventListener('dragleave', () => {
                col.classList.remove('drag-over');
            });
            col.addEventListener('drop', (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');
                const targetStatus = col.dataset.status;

                if (currentDragItem && currentDragItem.status !== targetStatus) {
                    changeStatus(currentDragType, currentDragItem.id, targetStatus);
                }
            });
        });
    }

    // --- Settings ---
    function setupSettings() {
        const settings = Storage.getSettings();

        // Update display text
        const nameDisplay = document.getElementById('profile-name-display');
        if (nameDisplay) {
            nameDisplay.textContent = settings.author || 'Użytkownik';
        }

        // Logic to edit name using the input (which we will ensure is visible/handled)
        const authorInput = document.getElementById('settings-author');
        if (authorInput) {
            authorInput.value = settings.author;
            authorInput.addEventListener('change', () => {
                const newSettings = { author: authorInput.value };
                Storage.saveSettings(newSettings);
                showToast('Zapisano ustawienia', 'success');
                if (nameDisplay) nameDisplay.textContent = authorInput.value;
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

    // --- Toast ---
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
