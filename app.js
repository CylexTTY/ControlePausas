const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const DEFAULT_SETTINGS = {
    coffeeStart: '10:00',
    coffeeEnd: '10:30',
    bathroomLimit: 10,
    coffeeLimit: 15,
    schedule: {
        0: { enabled: false, start: '08:00', end: '17:00' },
        1: { enabled: true, start: '08:00', end: '19:00' },
        2: { enabled: true, start: '08:00', end: '19:00' },
        3: { enabled: true, start: '08:00', end: '19:00' },
        4: { enabled: true, start: '08:00', end: '19:00' },
        5: { enabled: true, start: '08:00', end: '19:00' },
        6: { enabled: true, start: '08:00', end: '17:00' }
    }
};

let state = {
    workspace: '',
    employees: [],
    records: [],
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
};

let draggedEmployee = null;

function getStorageKey() {
    return `pausas_${state.workspace.toLowerCase().replace(/\s+/g, '_')}`;
}

function loadState() {
    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
        const data = JSON.parse(saved);
        state.employees = data.employees || [];
        state.records = data.records || [];
        state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
        if (data.settings?.schedule) {
            state.settings.schedule = { ...DEFAULT_SETTINGS.schedule, ...data.settings.schedule };
        }
    }
    applySettingsToUI();
}

function saveState() {
    localStorage.setItem(getStorageKey(), JSON.stringify({
        employees: state.employees,
        records: state.records,
        settings: state.settings
    }));
}

function applySettingsToUI() {
    document.getElementById('coffeeStart').value = state.settings.coffeeStart;
    document.getElementById('coffeeEnd').value = state.settings.coffeeEnd;
    document.getElementById('bathroomLimit').value = state.settings.bathroomLimit;
    document.getElementById('coffeeLimit').value = state.settings.coffeeLimit;
    document.getElementById('workspaceCode').value = state.workspace;
    document.getElementById('workspaceDisplay').textContent = state.workspace;
    renderScheduleGrid();
}

function saveSettings() {
    state.settings.coffeeStart = document.getElementById('coffeeStart').value;
    state.settings.coffeeEnd = document.getElementById('coffeeEnd').value;
    state.settings.bathroomLimit = parseInt(document.getElementById('bathroomLimit').value) || 10;
    state.settings.coffeeLimit = parseInt(document.getElementById('coffeeLimit').value) || 15;
    saveState();
}

function renderScheduleGrid() {
    const container = document.getElementById('scheduleGrid');
    container.innerHTML = WEEKDAYS_FULL.map((day, i) => {
        const sched = state.settings.schedule[i];
        return `
            <div class="schedule-item">
                <span class="schedule-day-name">${day}</span>
                <div class="schedule-toggle ${sched.enabled ? 'active' : ''}" onclick="toggleScheduleDay(${i})"></div>
                <div class="schedule-times">
                    <input type="time" class="form-input" value="${sched.start}" 
                           onchange="updateSchedule(${i}, 'start', this.value)" 
                           ${sched.enabled ? '' : 'disabled'}>
                    <span>até</span>
                    <input type="time" class="form-input" value="${sched.end}" 
                           onchange="updateSchedule(${i}, 'end', this.value)" 
                           ${sched.enabled ? '' : 'disabled'}>
                </div>
            </div>
        `;
    }).join('');
}

function toggleScheduleDay(day) {
    state.settings.schedule[day].enabled = !state.settings.schedule[day].enabled;
    saveState();
    renderScheduleGrid();
}

function updateSchedule(day, field, value) {
    state.settings.schedule[day][field] = value;
    saveState();
}

function initWorkspace() {
    const name = document.getElementById('setupWorkspace').value.trim();
    if (!name) {
        alert('Digite o nome da empresa');
        return;
    }
    state.workspace = name;
    localStorage.setItem('pausas_current_workspace', name);
    loadState();
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderAll();
}

function changeWorkspace() {
    const name = document.getElementById('workspaceCode').value.trim();
    if (!name) {
        alert('Digite o nome da empresa');
        return;
    }
    if (name !== state.workspace) {
        state.workspace = name;
        state.employees = [];
        state.records = [];
        state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        localStorage.setItem('pausas_current_workspace', name);
        loadState();
        renderAll();
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
}

function calcDuration(start, end) {
    if (!start || !end) return null;
    return Math.floor((new Date(end) - new Date(start)) / 60000);
}

function formatDuration(min) {
    if (min === null) return '-';
    return min < 60 ? `${min}min` : `${Math.floor(min / 60)}h ${min % 60}min`;
}

function getActiveRecord(empId) {
    return state.records.find(r => r.employeeId === empId && !r.endTime);
}

function isLate(record) {
    if (!record.endTime) return false;
    const dur = calcDuration(record.startTime, record.endTime);
    const limit = record.type === 'bathroom' ? state.settings.bathroomLimit : state.settings.coffeeLimit;
    return dur > limit;
}

function isOutsideCoffeeTime(record) {
    if (record.type !== 'coffee') return false;
    const t = new Date(record.startTime);
    const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    return time < state.settings.coffeeStart || time > state.settings.coffeeEnd;
}

function getScheduleHours() {
    const hours = new Set();
    Object.values(state.settings.schedule).forEach(s => {
        if (s.enabled) {
            const start = parseInt(s.start.split(':')[0]);
            const end = parseInt(s.end.split(':')[0]);
            for (let h = start; h <= end; h++) hours.add(h);
        }
    });
    return Array.from(hours).sort((a, b) => a - b);
}

function getEnabledDays() {
    return Object.entries(state.settings.schedule)
        .filter(([_, s]) => s.enabled)
        .map(([d]) => parseInt(d));
}

document.addEventListener('DOMContentLoaded', () => {
    const savedWorkspace = localStorage.getItem('pausas_current_workspace');
    if (savedWorkspace) {
        state.workspace = savedWorkspace;
        loadState();
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        renderAll();
    }
    setupNavigation();
    setInterval(updateTimers, 1000);
});

function setupNavigation() {
    document.querySelectorAll('nav button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.section).classList.add('active');
            if (btn.dataset.section === 'reports') generateReport();
        });
    });
}

function renderAll() {
    document.getElementById('workspaceDisplay').textContent = state.workspace;
    renderEmployeeGrid();
    renderEmployeesTable();
    renderRecords();
    updateSelects();
}

function updateSelects() {
    ['filterEmployee', 'reportEmployee', 'recordEmployee'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const val = sel.value;
        const isFilter = id !== 'recordEmployee';
        sel.innerHTML = isFilter ? '<option value="">Todos</option>' : '';
        state.employees.forEach(e => {
            sel.innerHTML += `<option value="${e.id}">${e.name}</option>`;
        });
        sel.value = val;
    });
}

function renderEmployeeGrid() {
    const grid = document.getElementById('employeeGrid');
    if (!state.employees.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Nenhum funcionário cadastrado</div>';
        return;
    }

    grid.innerHTML = state.employees.map((e, index) => {
        const active = getActiveRecord(e.id);
        const type = active?.type || '';
        const typeLabel = type === 'bathroom' ? 'Banheiro' : type === 'coffee' ? 'Café' : '';
        const statusText = active
            ? `${typeLabel} desde ${formatTime(active.startTime)}`
            : 'Disponível';

        const cardClass = active ? `absent-${type}` : 'available';
        const statusClass = active ? `active-${type}` : 'active-available';
        const timerClass = active ? `active timer-${type}` : '';

        return `
            <div class="employee-card ${cardClass}" 
                 data-employee="${e.id}" 
                 data-index="${index}"
                 draggable="true">
                <div class="employee-header">
                    <div class="employee-info">
                        <div class="employee-name">${e.name}</div>
                        <div class="employee-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="employee-timer ${timerClass}" data-start="${active?.startTime || ''}">00:00</div>
                </div>
                <div class="employee-actions">
                    ${active ? `
                        <button class="btn btn-success" onclick="registerReturn('${e.id}')">Registrar Volta</button>
                    ` : `
                        <button class="btn btn-primary" onclick="registerBreak('${e.id}','bathroom')">Banheiro</button>
                        <button class="btn btn-warning" onclick="registerBreak('${e.id}','coffee')">Café</button>
                    `}
                </div>
            </div>
        `;
    }).join('');

    setupDragAndDrop();
    updateTimers();
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.employee-card[draggable="true"]');

    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragenter', handleDragEnter);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedEmployee = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
}

function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.employee-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    draggedEmployee = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== draggedEmployee) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (this === draggedEmployee) return;

    const fromIndex = parseInt(draggedEmployee.dataset.index);
    const toIndex = parseInt(this.dataset.index);

    const [moved] = state.employees.splice(fromIndex, 1);
    state.employees.splice(toIndex, 0, moved);

    saveState();
    renderEmployeeGrid();
}

function updateTimers() {
    document.querySelectorAll('.employee-timer[data-start]').forEach(el => {
        if (!el.dataset.start) {
            el.textContent = '00:00';
            return;
        }
        const diff = Date.now() - new Date(el.dataset.start).getTime();
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        el.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    });
}

function registerBreak(empId, type) {
    state.records.unshift({
        id: generateId(),
        employeeId: empId,
        type,
        startTime: new Date().toISOString(),
        endTime: null
    });
    saveState();
    renderEmployeeGrid();
    renderRecords();
}

function registerReturn(empId) {
    const rec = getActiveRecord(empId);
    if (rec) {
        rec.endTime = new Date().toISOString();
        saveState();
        renderEmployeeGrid();
        renderRecords();
    }
}

function renderEmployeesTable() {
    const tbody = document.getElementById('employeesTable');
    if (!state.employees.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:32px;">Nenhum funcionário</td></tr>';
        return;
    }
    tbody.innerHTML = state.employees.map(e => {
        const recs = state.records.filter(r => r.employeeId === e.id && r.endTime);
        const total = recs.length;
        const totalTime = recs.reduce((s, r) => s + calcDuration(r.startTime, r.endTime), 0);
        const avg = total ? Math.round(totalTime / total) : 0;
        const last = state.records.find(r => r.employeeId === e.id);
        return `
            <tr>
                <td><strong>${e.name}</strong></td>
                <td>${total}</td>
                <td>${formatDuration(avg)}</td>
                <td>${last ? formatDateTime(last.startTime) : '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editEmployee('${e.id}')">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDelete('employee','${e.id}','${e.name}')">Excluir</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderRecords() {
    const tbody = document.getElementById('recordsTable');
    let data = [...state.records];

    const empF = document.getElementById('filterEmployee').value;
    const typeF = document.getElementById('filterType').value;
    const dateS = document.getElementById('filterDateStart').value;
    const dateE = document.getElementById('filterDateEnd').value;
    const statusF = document.getElementById('filterStatus').value;

    if (empF) data = data.filter(r => r.employeeId === empF);
    if (typeF) data = data.filter(r => r.type === typeF);
    if (dateS) data = data.filter(r => new Date(r.startTime) >= new Date(dateS));
    if (dateE) {
        const end = new Date(dateE);
        end.setHours(23, 59, 59);
        data = data.filter(r => new Date(r.startTime) <= end);
    }
    if (statusF === 'pending') data = data.filter(r => !r.endTime);
    else if (statusF === 'completed') data = data.filter(r => r.endTime);
    else if (statusF === 'late') data = data.filter(r => isLate(r));

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:32px;">Nenhum registro</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(r => {
        const emp = state.employees.find(e => e.id === r.employeeId);
        const dur = calcDuration(r.startTime, r.endTime);
        const late = isLate(r);
        const outside = isOutsideCoffeeTime(r);

        let status = '';
        if (!r.endTime) status = '<span class="badge badge-pending">Pendente</span>';
        else if (late) status = '<span class="badge badge-late">Atrasado</span>';
        else status = '<span class="badge badge-ok">OK</span>';
        if (outside) status += ' <span class="badge badge-late">Fora horário</span>';

        return `
            <tr>
                <td>${emp?.name || 'Removido'}</td>
                <td><span class="badge badge-${r.type}">${r.type === 'bathroom' ? 'Banheiro' : 'Café'}</span></td>
                <td>${formatDateTime(r.startTime)}</td>
                <td>${formatDateTime(r.endTime)}</td>
                <td>${formatDuration(dur)}</td>
                <td>${status}</td>
                <td>
                    ${!r.endTime ? `<button class="btn btn-success btn-sm" onclick="markReturn('${r.id}')">Volta</button>` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="editRecord('${r.id}')">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDelete('record','${r.id}')">Excluir</button>
                </td>
            </tr>
        `;
    }).join('');
}

function markReturn(id) {
    const r = state.records.find(x => x.id === id);
    if (r) {
        r.endTime = new Date().toISOString();
        saveState();
        renderAll();
    }
}

function clearFilters() {
    ['filterEmployee', 'filterType', 'filterDateStart', 'filterDateEnd', 'filterStatus'].forEach(id => {
        document.getElementById(id).value = '';
    });
    renderRecords();
}

function openEmployeeModal(id = null) {
    document.getElementById('modalEmployeeTitle').textContent = id ? 'Editar Funcionário' : 'Adicionar Funcionário';
    document.getElementById('employeeId').value = id || '';
    document.getElementById('employeeName').value = id ? state.employees.find(e => e.id === id)?.name || '' : '';
    document.getElementById('modalEmployee').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function saveEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('employeeId').value;
    const name = document.getElementById('employeeName').value.trim();
    if (id) {
        const emp = state.employees.find(x => x.id === id);
        if (emp) emp.name = name;
    } else {
        state.employees.push({ id: generateId(), name });
    }
    saveState();
    closeModal('modalEmployee');
    renderAll();
}

function editEmployee(id) {
    openEmployeeModal(id);
}

function editRecord(id) {
    const r = state.records.find(x => x.id === id);
    if (!r) return;
    updateSelects();
    document.getElementById('recordId').value = r.id;
    document.getElementById('recordEmployee').value = r.employeeId;
    document.getElementById('recordType').value = r.type;
    const start = new Date(r.startTime);
    document.getElementById('recordDateStart').value = start.toISOString().split('T')[0];
    document.getElementById('recordTimeStart').value = start.toTimeString().slice(0, 5);
    if (r.endTime) {
        const end = new Date(r.endTime);
        document.getElementById('recordDateEnd').value = end.toISOString().split('T')[0];
        document.getElementById('recordTimeEnd').value = end.toTimeString().slice(0, 5);
    } else {
        document.getElementById('recordDateEnd').value = '';
        document.getElementById('recordTimeEnd').value = '';
    }
    document.getElementById('modalRecord').classList.add('active');
}

function saveRecord(e) {
    e.preventDefault();
    const id = document.getElementById('recordId').value;
    const r = state.records.find(x => x.id === id);
    if (!r) return;
    r.employeeId = document.getElementById('recordEmployee').value;
    r.type = document.getElementById('recordType').value;
    const ds = document.getElementById('recordDateStart').value;
    const ts = document.getElementById('recordTimeStart').value;
    r.startTime = new Date(`${ds}T${ts}`).toISOString();
    const de = document.getElementById('recordDateEnd').value;
    const te = document.getElementById('recordTimeEnd').value;
    r.endTime = de && te ? new Date(`${de}T${te}`).toISOString() : null;
    saveState();
    closeModal('modalRecord');
    renderAll();
}

function confirmDelete(type, id, name = '') {
    document.getElementById('confirmTitle').textContent = type === 'employee' ? 'Excluir Funcionário' : 'Excluir Registro';
    document.getElementById('confirmMessage').textContent = type === 'employee'
        ? `Excluir "${name}"? Os registros serão mantidos.`
        : 'Excluir este registro?';
    document.getElementById('confirmAction').onclick = () => {
        if (type === 'employee') state.employees = state.employees.filter(e => e.id !== id);
        else state.records = state.records.filter(r => r.id !== id);
        saveState();
        closeModal('modalConfirm');
        renderAll();
    };
    document.getElementById('modalConfirm').classList.add('active');
}

function confirmClearData() {
    document.getElementById('confirmTitle').textContent = 'Limpar Dados';
    document.getElementById('confirmMessage').textContent = 'Excluir TODOS os funcionários e registros desta empresa?';
    document.getElementById('confirmAction').onclick = () => {
        state.employees = [];
        state.records = [];
        saveState();
        closeModal('modalConfirm');
        renderAll();
    };
    document.getElementById('modalConfirm').classList.add('active');
}

function generateReport() {
    const empF = document.getElementById('reportEmployee').value;
    const dateS = document.getElementById('reportDateStart').value;
    const dateE = document.getElementById('reportDateEnd').value;

    let data = state.records.filter(r => r.endTime);
    if (empF) data = data.filter(r => r.employeeId === empF);
    if (dateS) data = data.filter(r => new Date(r.startTime) >= new Date(dateS));
    if (dateE) {
        const end = new Date(dateE);
        end.setHours(23, 59, 59);
        data = data.filter(r => new Date(r.startTime) <= end);
    }

    const total = data.length;
    const bathroom = data.filter(r => r.type === 'bathroom').length;
    const coffee = data.filter(r => r.type === 'coffee').length;
    const totalTime = data.reduce((s, r) => s + calcDuration(r.startTime, r.endTime), 0);
    const avg = total ? Math.round(totalTime / total) : 0;
    const lateCount = data.filter(r => isLate(r)).length;
    const outsideCount = data.filter(r => isOutsideCoffeeTime(r)).length;

    document.getElementById('reportStats').innerHTML = `
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div>
        <div class="stat-card"><div class="stat-value">${bathroom}</div><div class="stat-label">Banheiro</div></div>
        <div class="stat-card"><div class="stat-value">${coffee}</div><div class="stat-label">Café</div></div>
        <div class="stat-card"><div class="stat-value">${formatDuration(totalTime)}</div><div class="stat-label">Tempo Total</div></div>
        <div class="stat-card"><div class="stat-value">${formatDuration(avg)}</div><div class="stat-label">Média</div></div>
        <div class="stat-card"><div class="stat-value ${lateCount ? 'text-danger' : ''}">${lateCount}</div><div class="stat-label">Atrasos</div></div>
        <div class="stat-card"><div class="stat-value ${outsideCount ? 'text-warning' : ''}">${outsideCount}</div><div class="stat-label">Fora Horário</div></div>
    `;

    const weekdayData = [0, 0, 0, 0, 0, 0, 0];
    data.forEach(r => weekdayData[new Date(r.startTime).getDay()]++);
    const maxW = Math.max(...weekdayData, 1);
    document.getElementById('weekdayChart').innerHTML = WEEKDAYS.map((d, i) => `
        <div class="bar-item">
            <div class="bar-value">${weekdayData[i]}</div>
            <div class="bar" style="height:${(weekdayData[i] / maxW) * 120}px"></div>
            <div class="bar-label">${d}</div>
        </div>
    `).join('');

    const hours = getScheduleHours();
    const hourData = {};
    hours.forEach(h => hourData[h] = 0);
    data.forEach(r => {
        const h = new Date(r.startTime).getHours();
        if (hourData[h] !== undefined) hourData[h]++;
    });
    const maxH = Math.max(...Object.values(hourData), 1);
    document.getElementById('hourChart').innerHTML = hours.map(h => `
        <div class="bar-item">
            <div class="bar-value">${hourData[h]}</div>
            <div class="bar" style="height:${(hourData[h] / maxH) * 120}px"></div>
            <div class="bar-label">${h}h</div>
        </div>
    `).join('');

    const enabledDays = getEnabledDays();
    const heatData = {};
    hours.forEach(h => enabledDays.forEach(d => heatData[`${h}-${d}`] = 0));
    data.forEach(r => {
        const dt = new Date(r.startTime);
        const key = `${dt.getHours()}-${dt.getDay()}`;
        if (heatData[key] !== undefined) heatData[key]++;
    });
    const maxHeat = Math.max(...Object.values(heatData), 1);

    let heatHtml = `<div class="heatmap-cell heatmap-header"></div>`;
    enabledDays.forEach(d => heatHtml += `<div class="heatmap-cell heatmap-header">${WEEKDAYS[d]}</div>`);
    hours.forEach(h => {
        heatHtml += `<div class="heatmap-cell heatmap-label">${String(h).padStart(2, '0')}h</div>`;
        enabledDays.forEach(d => {
            const count = heatData[`${h}-${d}`];
            const level = count === 0 ? 0 : Math.min(5, Math.max(1, Math.ceil((count / maxHeat) * 5)));
            heatHtml += `<div class="heatmap-cell data heat-${level}" title="${WEEKDAYS[d]} ${h}h: ${count}">${count || ''}</div>`;
        });
    });
    const heatmap = document.getElementById('heatmap');
    heatmap.style.gridTemplateColumns = `50px repeat(${enabledDays.length}, 1fr)`;
    heatmap.innerHTML = heatHtml;

    const ranking = state.employees.map(e => {
        const recs = data.filter(r => r.employeeId === e.id);
        const t = recs.length;
        const time = recs.reduce((s, r) => s + calcDuration(r.startTime, r.endTime), 0);
        return {
            name: e.name,
            total: t,
            time,
            avg: t ? Math.round(time / t) : 0,
            late: recs.filter(r => isLate(r)).length
        };
    }).sort((a, b) => b.total - a.total);

    document.getElementById('rankingTable').innerHTML = ranking.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${r.name}</strong></td>
            <td>${r.total}</td>
            <td>${formatDuration(r.time)}</td>
            <td>${formatDuration(r.avg)}</td>
            <td class="${r.late ? 'text-danger' : ''}">${r.late}</td>
        </tr>
    `).join('');
}

function exportCSV() {
    if (!state.records.length) return alert('Nenhum registro');
    const rows = state.records.map(r => {
        const emp = state.employees.find(e => e.id === r.employeeId);
        const dur = calcDuration(r.startTime, r.endTime);
        return [
            emp?.name || 'Removido',
            r.type === 'bathroom' ? 'Banheiro' : 'Café',
            formatDate(r.startTime),
            formatTime(r.startTime),
            r.endTime ? formatDate(r.endTime) : '',
            r.endTime ? formatTime(r.endTime) : '',
            dur ?? '',
            isLate(r) ? 'Sim' : 'Não',
            isOutsideCoffeeTime(r) ? 'Sim' : 'Não'
        ].join(';');
    });
    const csv = ['Funcionario;Tipo;Data Saida;Hora Saida;Data Retorno;Hora Retorno;Duracao Min;Atrasado;Fora Horario', ...rows].join('\n');
    const safeName = state.workspace.replace(/[^a-zA-Z0-9]/g, '_');
    download(`registros_${safeName}_${new Date().toISOString().split('T')[0]}.csv`, '\ufeff' + csv, 'text/csv');
}

function exportBackup() {
    const backup = {
        version: '2.0',
        workspace: state.workspace,
        exported: new Date().toISOString(),
        data: { employees: state.employees, records: state.records, settings: state.settings }
    };
    const safeName = state.workspace.replace(/[^a-zA-Z0-9]/g, '_');
    download(`backup_${safeName}_${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const backup = JSON.parse(e.target.result);
            if (backup.data?.employees && backup.data?.records) {
                state.employees = backup.data.employees;
                state.records = backup.data.records;
                if (backup.data.settings) state.settings = { ...DEFAULT_SETTINGS, ...backup.data.settings };
                saveState();
                applySettingsToUI();
                renderAll();
                alert('Backup restaurado!');
            } else {
                alert('Arquivo inválido');
            }
        } catch {
            alert('Erro ao ler arquivo');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}
