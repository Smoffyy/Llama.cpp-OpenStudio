// Global State
const state = {
    serverRunning: false,
    currentModel: null,
    currentBinary: null,
    models: [],
    config: {}
};

const ipc = window.electron;

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();
    await loadInitialData();
    setupEventListeners();
    startLogWatcher();
    initializeTabSwitching();
});

async function loadInitialData() {
    try {
        state.config = await ipc.getConfig();
        document.getElementById('models-path').value = state.config.modelsPath || './models';
        document.getElementById('binaries-path').value = state.config.binariesPath || './bin';
        
        const status = await ipc.getServerStatus();
        updateServerStatus(status.running, status.model);
        
        const binaryInfo = await ipc.getInstalledBinary();
        if (binaryInfo) {
            state.currentBinary = binaryInfo;
            document.getElementById('dashboard-binary-version').textContent = binaryInfo.version || 'Unknown';
        } else {
            document.getElementById('dashboard-binary-version').textContent = 'Not Installed';
        }
        
        await refreshModelsList();
    } catch (error) {
        console.error('Error loading initial data:', error);
        showToast('Error loading initial data: ' + error.message, 'error');
    }
}

function setupEventListeners() {
    ipc.onServerStatus((data) => {
        console.log('Server status update:', data);
        updateServerStatus(data.running, data.model);
    });
    
    ipc.onServerLog((data) => {
        console.log('Log entry:', data);
        appendLog(data.message, data.type);
    });
    
    ipc.onDownloadProgress((data) => {
        console.log('Download progress:', data);
        updateDownloadProgress(data);
    });
}

function updateServerStatus(running, model) {
    state.serverRunning = running;
    state.currentModel = model;
    
    const text = document.getElementById('status-text');
    const dot = document.getElementById('status-dot');
    const dashboardStatus = document.getElementById('dashboard-server-status');
    const dashboardModel = document.getElementById('dashboard-model-name');
    
    if (running) {
        text.textContent = 'Online';
        dot.classList.remove('bg-red-500', 'animate-pulse');
        dot.classList.add('bg-green-500');
        dashboardStatus.textContent = 'Running';
        dashboardModel.textContent = model || 'None';
    } else {
        text.textContent = 'Offline';
        dot.classList.add('bg-red-500', 'animate-pulse');
        dot.classList.remove('bg-green-500');
        dashboardStatus.textContent = 'Stopped';
        dashboardModel.textContent = 'None';
    }
}

function appendLog(message, type = 'info') {
    const container = document.getElementById('log-container');
    if (!container) return;
    
    // Clear placeholder if needed
    const placeholder = container.querySelector('p.italic');
    if (placeholder) placeholder.remove();
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="text-slate-500">[${time}]</span> <span class="text-slate-300">${escapeHtml(message)}</span>`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function refreshModelsList() {
    try {
        state.models = await ipc.getModels();
        console.log('Models loaded:', state.models);
        const event = new CustomEvent('models-updated', { detail: state.models });
        document.dispatchEvent(event);
    } catch (error) {
        console.error('Error loading models:', error);
        showToast('Error loading models: ' + error.message, 'error');
    }
}

function showToast(message, type = 'info') {
    console.log(`Toast (${type}): ${message}`);
    
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2`;
    
    let bgClass = 'bg-blue-600/80';
    let icon = 'info';
    
    if (type === 'success') {
        bgClass = 'bg-green-600/80';
        icon = 'check-circle';
    } else if (type === 'error') {
        bgClass = 'bg-red-600/80';
        icon = 'alert-circle';
    } else if (type === 'warning') {
        bgClass = 'bg-yellow-600/80';
        icon = 'alert-triangle';
    }
    
    toast.className += ` ${bgClass}`;
    toast.innerHTML = `
        <i data-feather="${icon}" class="w-4 h-4"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    feather.replace();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function updateDownloadProgress(progress) {
    console.log('Download progress event:', progress);
    showToast(`${progress.name}: ${progress.progress}%`, 'info');
}

async function quickStartServer() {
    if (!state.currentModel) {
        showToast('Please load a model first using the Models tab', 'warning');
        return;
    }
    
    try {
        showToast('Starting server...', 'info');
        await ipc.startServer(state.currentModel, state.config.defaultParams || {});
        showToast('Server started successfully', 'success');
    } catch (error) {
        console.error('Error starting server:', error);
        showToast('Error starting server: ' + error.message, 'error');
    }
}

async function quickStopServer() {
    try {
        showToast('Stopping server...', 'info');
        await ipc.stopServer();
        showToast('Server stopped', 'success');
    } catch (error) {
        console.error('Error stopping server:', error);
        showToast('Error stopping server: ' + error.message, 'error');
    }
}

function startLogWatcher() {
    ipc.getLogs().then(logs => {
        logs.forEach(log => appendLog(log.message, log.type));
    }).catch(error => {
        console.error('Error loading logs:', error);
    });
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Show selected tab
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) {
        tab.classList.remove('hidden');
    }
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-purple-600/20', 'text-purple-400', 'border-purple-500/30');
        btn.classList.add('text-slate-400', 'hover:bg-slate-700/50');
    });
    
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-400', 'hover:bg-slate-700/50');
        activeBtn.classList.add('bg-purple-600/20', 'text-purple-400', 'border-purple-500/30');
    }
}

function initializeTabSwitching() {
    // Set dashboard as default active tab
    switchTab('dashboard');
}

async function selectModelsDir() {
    const dir = await ipc.selectDirectory();
    if (dir) {
        state.config.modelsPath = dir;
        await ipc.updateConfig(state.config);
        document.getElementById('models-path').value = dir;
        await refreshModelsList();
        showToast('Models directory updated', 'success');
    }
}

async function selectBinariesDir() {
    const dir = await ipc.selectDirectory();
    if (dir) {
        state.config.binariesPath = dir;
        await ipc.updateConfig(state.config);
        document.getElementById('binaries-path').value = dir;
        showToast('Binaries directory updated', 'success');
    }
}

async function resetAll() {
    const confirmed = confirm('Are you sure you want to reset all configuration? This cannot be undone.');
    if (confirmed) {
        try {
            state.config = await ipc.resetConfig();
            document.getElementById('models-path').value = state.config.modelsPath || './models';
            document.getElementById('binaries-path').value = state.config.binariesPath || './bin';
            showToast('Configuration reset', 'success');
        } catch (error) {
            showToast('Error resetting configuration: ' + error.message, 'error');
        }
    }
}

async function wipeBinaries() {
    const confirmed = confirm('Are you sure you want to wipe the binaries folder? This will delete all installed llama.cpp binaries.');
    if (confirmed) {
        try {
            await ipc.wipeBinaries();
            state.currentBinary = null;
            document.getElementById('dashboard-binary-version').textContent = 'Not Installed';
            showToast('Binaries wiped', 'success');
        } catch (error) {
            showToast('Error wiping binaries: ' + error.message, 'error');
        }
    }
}

function clearLogs() {
    const container = document.getElementById('log-container');
    if (container) {
        container.innerHTML = '<p class="text-slate-500 italic">Waiting for server activity...</p>';
    }
}