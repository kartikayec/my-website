// Indicative Cashflow & Contractual Payment Task Manager
import { state } from './state.js';

export function initCashflow() {
    const grid = document.getElementById('cashflow-grid');
    const totalOutlayElem = document.getElementById('cashflow-total-outlay');
    const pendingCountElem = document.getElementById('cashflow-pending-count');
    const addTaskForm = document.getElementById('cashflow-add-form');

    function renderCashflowGrid() {
        if (!grid) return;
        grid.innerHTML = '';

        const tasks = state.cashflowTasks || [];

        if (tasks.length === 0) {
            grid.innerHTML = '<div class="placeholder-card" style="grid-column: 1 / -1;"><i class="fa-solid fa-file-invoice-dollar"></i><p>No recurring bills or contractual payments scheduled.</p></div>';
            if (totalOutlayElem) totalOutlayElem.textContent = '₹0';
            if (pendingCountElem) pendingCountElem.textContent = '0 Pending';
            return;
        }

        let pendingSum = 0;
        let pendingCount = 0;

        // Sort: Overdue & Pending first, then Completed
        const sortedTasks = [...tasks].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        sortedTasks.forEach(task => {
            const isOverdue = !task.completed && new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0));
            if (!task.completed) {
                pendingSum += Number(task.amount);
                pendingCount++;
            }

            const card = document.createElement('div');
            card.className = `cashflow-card ${task.completed ? 'completed' : (isOverdue ? 'overdue' : 'pending')}`;

            const iconClass = task.category === 'Contractual' ? 'fa-file-signature' : 'fa-bolt';

            card.innerHTML = `
                <div class="cashflow-card-header">
                    <div class="cashflow-title-wrapper">
                        <i class="fa-solid ${iconClass} category-icon"></i>
                        <div>
                            <h4 class="cashflow-title">${escapeHTML(task.title)}</h4>
                            <span class="cashflow-category-badge">${escapeHTML(task.category)} • ${escapeHTML(task.recurrence)}</span>
                        </div>
                    </div>
                    <div class="cashflow-amount">₹${Number(task.amount).toLocaleString('en-IN')}</div>
                </div>
                <div class="cashflow-card-body">
                    <div class="cashflow-due-date">
                        <i class="fa-regular fa-calendar"></i>
                        <span>Due: ${escapeHTML(task.dueDate)}</span>
                        ${isOverdue ? '<span class="status-badge status-offline">OVERDUE</span>' : ''}
                    </div>
                    <button type="button" class="btn ${task.completed ? 'btn-secondary' : 'btn-primary'} btn-sm toggle-task-btn" data-id="${task.id}">
                        <i class="fa-solid ${task.completed ? 'fa-rotate-left' : 'fa-check'}"></i>
                        ${task.completed ? 'Mark Pending' : 'Mark Completed'}
                    </button>
                </div>
            `;

            grid.appendChild(card);
        });

        // Event delegation for toggle buttons
        const toggleBtns = grid.querySelectorAll('.toggle-task-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                toggleTaskStatus(id);
            });
        });

        if (totalOutlayElem) totalOutlayElem.textContent = `₹${pendingSum.toLocaleString('en-IN')}`;
        if (pendingCountElem) pendingCountElem.textContent = `${pendingCount} Pending`;
    }

    function toggleTaskStatus(id) {
        const tasks = [...state.cashflowTasks];
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.lastCompletedDate = task.completed ? new Date().toISOString() : null;
            state.saveCashflowTasks(tasks);
            renderCashflowGrid();
        }
    }

    if (addTaskForm) {
        addTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const titleIn = document.getElementById('cf-title');
            const amountIn = document.getElementById('cf-amount');
            const dateIn = document.getElementById('cf-date');
            const catIn = document.getElementById('cf-category');
            const recIn = document.getElementById('cf-recurrence');

            if (!titleIn || !amountIn || !dateIn) return;

            const newTask = {
                id: 'task-' + Date.now(),
                title: titleIn.value.trim(),
                amount: parseFloat(amountIn.value),
                dueDate: dateIn.value,
                category: catIn ? catIn.value : 'Utility',
                recurrence: recIn ? recIn.value : 'Monthly',
                completed: false,
                lastCompletedDate: null
            };

            const tasks = [...state.cashflowTasks, newTask];
            state.saveCashflowTasks(tasks);
            renderCashflowGrid();

            addTaskForm.reset();
        });
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Subscribe to state changes
    state.on('cashflow', renderCashflowGrid);

    // Initial render
    renderCashflowGrid();

    return { renderCashflowGrid, toggleTaskStatus };
}
