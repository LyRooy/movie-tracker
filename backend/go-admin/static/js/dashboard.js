function fmtTime(ms) {
    const d = new Date(ms);
    if (isNaN(d)) return '---';
    const p = n => String(n).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function setStatus(model, status, count) {
    const map = {
        not_started: {text: 'oczekuje', cls: 'oczekuje'},
        running: {text: 'budowanie...', cls: 'running'},
        ready: {text: 'gotowy', cls: 'ready'},
        error: {text: 'błąd', cls: 'error'},
    };
    const info = map[status] || map.not_started;
    const base = model === 'cf' ? 'cf' : 'cb';
    const statusEl = document.getElementById(base + '-status');
    if (statusEl) {
        statusEl.textContent = info.text;
        statusEl.className = 'status-value ' + info.cls;
    }
    const fillEl = document.getElementById(base + '-fill');
    if (fillEl) fillEl.style.width = (status === 'ready' ? '100%' : status === 'running' ? '50%' : '0%');
    const countEl = document.getElementById(base + '-count');
    if (countEl && count !== undefined) countEl.textContent = count;
}

let currentModel = 'cf';

function addLogEntry(entry) {
    const panel = document.getElementById('log-panel');
    if (!panel) return;
    const el = document.createElement('div');
    el.className = 'log-entry ' + entry.level;
    el.innerHTML =
        '<span class="log-time">' + fmtTime(entry.ts) + '</span>' +
        '<span class="log-model">' + (entry.model || '—') + '</span>' +
        '<span class="log-level">' + entry.event || entry.level.toUpperCase() + '</span>' +
        '<span class="log-msg">' + (entry.message || '') + '</span>';
    panel.appendChild(el);
    panel.scrollTop = panel.scrollHeight;
}

function updateChip(model) {
    const dot = document.getElementById('chip-dot-' + model);
    if (!dot) return;
    dot.className = 'status-dot ' + modelsStatus[model];
    const chip = dot.closest('.model-chip');
    if (chip) chip.classList.toggle('active', model === currentModel);
}

let modelsStatus = { cf: 'not_started', cb: 'not_started' };

function handleEvent(entry) {
    const modelKey = entry.model;
    
    modelsStatus[modelKey] = entry.event === 'built' ? (entry.ok ? 'ready' : 'error') : 'running';
    updateChip(modelKey);
    
    if (entry.event === 'building') {
        setStatus(modelKey, 'running');
    } else if (entry.event === 'built') {
        setStatus(modelKey, entry.ok ? 'ready' : 'error', entry.count);
    }

    if (modelKey === currentModel) {
        addLogEntry({level: entry.level, ts: entry.t, model: modelKey, event: entry.event, message: entry.message});
    }
}

function handleLog(entry) {
    if (entry.model === currentModel) {
        addLogEntry({level: entry.level, ts: entry.t, model: entry.model, event: entry.level, message: entry.message});
    }
}

function applyModels(data) {
    if (!data) return;
    for (const key in data) {
        const model = data[key];
        
        if (model.status) {
            setStatus(key, model.status, model.count);
            modelsStatus[key] = model.status;
            updateChip(key);
        }
        
        for (const entry of model.events || []) {
            if (entry.event === 'building' || entry.event === 'built') handleEvent(entry);
        }
        for (const entry of model.logs || []) {
            handleLog(entry);
        }
    }
}

fetch('/admin/progress')
    .then(r => r.json())
    .then(data => {
        if (data) applyModels(data);
    })
    .catch(() => {});

const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
let ws;

function connectWS() {
    ws = new WebSocket(wsProto + "://" + window.location.host + "/admin/ws");

    ws.onmessage = function(event) {
        let data;
        try { data = JSON.parse(event.data); } catch (e) { return; }
        if (!data || data.type === 'ping') return;
        
        if (data.type === 'event') handleEvent(data);
        else if (data.type === 'log') handleLog(data);
    };

    ws.onclose = function() {
        console.warn("Live push rozłączony, próba ponownego połączenia...");
        fetch('/admin/progress')
            .then(r => r.json())
            .then(data => { if (data) applyModels(data); })
            .catch(() => {});
        setTimeout(connectWS, 2000);
    };
}

connectWS();

setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
    }
}, 30000);

document.querySelectorAll('.model-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const model = chip.getAttribute('data-model');
        currentModel = model;
        
        document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        renderLogs(model);
    });
});

function renderLogs(model) {
    const panel = document.getElementById('log-panel');
    if (!panel) return;
    
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    addLogEntry({ts: Date.now(), level: 'info', model: model, event: 'filter', message: `Pokaż logi dla modelu: ${model.toUpperCase()}`});
    
    fetch('/admin/progress')
        .then(r => r.json())
        .then(data => {
            if (data && data[model]) {
                const m = data[model];
                for (const entry of m.events || []) {
                    if (entry.event === 'building' || entry.event === 'built') handleEvent(entry);
                }
                for (const entry of m.logs || []) {
                    handleLog(entry);
                }
            }
        })
        .catch(() => {});
}
