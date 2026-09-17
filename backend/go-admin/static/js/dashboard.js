const MAX_LOGS = 30;

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
    if (fillEl) {
        fillEl.style.width = (status === 'ready' ? '100%' : status === 'running' ? '50%' : '0%');
    }
    
    const countEl = document.getElementById(base + '-count');
    if (countEl && count !== undefined && count !== null) {
        countEl.textContent = count;
    }
}

function addLogEntry(entry) {
    const panel = document.getElementById('log-panel');
    if (!panel) return;
    
    // POPRAWKA KRYTYCZNA: Używamy firstElementChild, żeby zignorować puste entery w HTML
    const firstElement = panel.firstElementChild;
    if (panel.children.length === 1 && firstElement && firstElement.classList.contains('info') && firstElement.innerText.includes('Czekanie')) {
        panel.innerHTML = '';
    }

    const el = document.createElement('div');
    el.className = `log-entry ${entry.level} ${entry.model}`;
    el.innerHTML =
        '<span class="log-time">' + fmtTime(entry.ts) + '</span>' +
        '<span class="log-model">[' + (entry.model || 'SYS') + ']</span>' +
        '<span class="log-level">' + (entry.event || entry.level).toUpperCase() + '</span>' +
        '<span class="log-msg">' + (entry.message || '') + '</span>';
    panel.appendChild(el);
    
    // Ucinanie logów do najnowszych 30 linijek
    while (panel.children.length > MAX_LOGS) {
        panel.removeChild(panel.firstElementChild);
    }
    panel.scrollTop = panel.scrollHeight;
}

function handleEvent(entry) {
    const modelKey = entry.model;
    
    if (entry.event === 'building') {
        setStatus(modelKey, 'running');
    } else if (entry.event === 'built') {
        setStatus(modelKey, entry.ok ? 'ready' : 'error', entry.count);
    }

    addLogEntry({level: entry.level, ts: entry.t, model: modelKey, event: entry.event, message: entry.message});
}

function handleLog(entry) {
    addLogEntry({level: entry.level, ts: entry.t, model: entry.model, event: entry.level, message: entry.message});
}

// Składa stany podczas wejścia na stronę / twardego odświeżenia
function applyModels(data) {
    if (!data) return;
    
    let allLogs = [];
    
    for (const key in data) {
        const model = data[key];
        
        if (model.status) {
            setStatus(key, model.status, model.count);
        }
        
        for (const entry of model.events || []) {
            if (entry.event === 'building' || entry.event === 'built') {
                allLogs.push({level: entry.level, ts: entry.t, model: key, event: entry.event, message: entry.message});
            }
        }
        for (const entry of model.logs || []) {
            allLogs.push({level: entry.level, ts: entry.t, model: key, event: entry.level, message: entry.message});
        }
    }
    
    // Posortuj logi od najstarszych do najnowszych i przytnij do 30
    allLogs.sort((a, b) => a.ts - b.ts);
    const lastLogs = allLogs.slice(-MAX_LOGS);
    
    const panel = document.getElementById('log-panel');
    if (panel) panel.innerHTML = '';
    lastLogs.forEach(log => addLogEntry(log));
}

// 1. Pierwsze załadowanie
fetch('/admin/progress', { cache: 'no-store' })
    .then(r => r.json())
    .then(data => { if (data) applyModels(data); })
    .catch(() => {});

// 2. Ciche synchronizowanie samych pasków i cyferek z szybkiej pamięci Go (omija błąd opóźnienia w Pythonie)
setInterval(() => {
    fetch('/admin/progress', { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
            if (!data) return;
            for (const key in data) {
                if (data[key].status) {
                    setStatus(key, data[key].status, data[key].count);
                }
            }
        })
        .catch(() => {});
}, 2000);

// 3. Nasłuch na żywe zdarzenia z WebSocketa
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
        setTimeout(connectWS, 2000);
    };
}

connectWS();

setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
    }
}, 30000);
