// Global State
const state = {
    serverRunning: false,
    currentModel: null,
    currentBinary: null,
    models: [],
    binaries: [],
    config: {}
};

// IPC Communication with Electron Main Process
const ipc = window.electron;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    setupEventListeners();
    startLogWatcher();
});

async function loadInitialData() {
    try {
        // Load config
        state.config = await ipc.getConfig();
        document.getElementById('models-path').value = state.config.modelsPath || './models';
        document.getElementById('binaries-path').value = state.config.binariesPath || './bin';
        
        // Check server status
        const status = await ipc.getServerStatus();
        updateServerStatus(status.running, status.model);
        
        // Load installed binary info
        const binaryInfo = await ipc.getInstalledBinary();
        if (binaryInfo) {
            state.currentBinary = binaryInfo;
            document.getElementById('dashboard-binary-version').textContent = binaryInfo.version || 'Unknown';
        }
        
        // Load models list
        await refreshModelsList();
        
    } catch (error) {
        showToast('Error loading initial data: ' + error.message, 'error');
    }
}

function setupEventListeners() {
    // Listen for server status updates
    ipc.onServerStatus((event, status) => {
        updateServerStatus(status.running, status.model);
    });
    
    // Listen for logs
    ipc.onServerLog((event, log) => {
        appendLog(log.message, log.type);
    });
    
    // Listen for download progress
    ipc.onDownloadProgress((event, progress) => {
        updateDownloadProgress(progress);
    });
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.remove('text-slate-400', 'hover:bg-slate-700/50');
            btn.classList.add('bg-purple-600/20', 'text-purple-400', 'border', 'border-purple-500/30');
        } else {
            btn.classList.add('text-slate-400', 'hover:bg-slate-700/50');
            btn.classList.remove('bg-purple-600/20', 'text-purple-400', 'border', 'border-purple-500/30');
        }
    });
    
    // Refresh data if needed
    if (tabName === 'models') {
        refreshModelsList();
    } else if (tabName === 'binaries') {
        loadBinariesList();
    }
}

function updateServerStatus(running, model) {
    state.serverRunning = running;
    state.currentModel = model;
    
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const dashboardStatus = document.getElementById('dashboard-server-status');
    const dashboardModel = document.getElementById('dashboard-model-name');
    const activeModelName = document.getElementById('active-model-name');
    
    if (running) {
        dot.classList.remove('bg-red-500');
        dot.classList.add('bg-green-500', 'status-online');
        text.textContent = 'Online';
        text.classList.remove('text-slate-300');
        text.classList.add('text-green-400');
        dashboardStatus.textContent = 'Running';
        dashboardStatus.classList.add('text-green-400');
    } else {
        dot.classList.remove('bg-green-500', 'status-online');
        dot.classList.add('bg-red-500');
        text.textContent = 'Offline';
        text.classList.remove('text-green-400');
        text.classList.add('text-slate-300');
        dashboardStatus.textContent = 'Stopped';
        dashboardStatus.classList.remove('text-green-400');
    }
    
    if (model) {
        dashboardModel.textContent = model;
        activeModelName.textContent = model;
    } else {
        dashboardModel.textContent = 'None';
        activeModelName.textContent = 'None';
    }
}

function appendLog(message, type = 'info') {
    const container = document.getElementById('log-container');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type} text-xs font-mono py-1`;
    
    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="text-slate-500">[${timestamp}]</span> <span class="${type === 'error' ? 'text-red-400' : type === 'success' ? 'text-green-400' : 'text-slate-300'}">${message}</span>`;
    
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
    
    // Limit log entries
    while (container.children.length > 100) {
        container.removeChild(container.firstChild);
    }
}

function clearLogs() {
    const container = document.getElementById('log-container');
    container.innerHTML = '<p class="text-slate-500 italic">Logs cleared...</p>';
}

async function refreshModelsList() {
    try {
        state.models = await ipc.getModels();
        // Update model manager component if it exists
        const event = new CustomEvent('models-updated', { detail: state.models });
        document.dispatchEvent(event);
    } catch (error) {
        console.error('Error refreshing models:', error);
    }
}

async function loadBinariesList() {
    try {
        const releases = await ipc.getReleases();
        state.binaries = releases;
        const event = new CustomEvent('binaries-updated', { detail: releases });
        document.dispatchEvent(event);
    } catch (error) {
        console.error('Error loading binaries:', error);
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const colors = {
        info: 'bg-blue-600/90 border-blue-500',
        success: 'bg-green-600/90 border-green-500',
        error: 'bg-red-600/90 border-red-500',
        warning: 'bg-yellow-600/90 border-yellow-500'
    };
    
    const icons = {
        info: 'info',
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle'
    };
    
    toast.className = `toast ${colors[type]} border text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]`;
    toast.innerHTML = `
        <i data-feather="${icons[type]}" class="w-5 h-5"></i>
        <span class="font-medium">${message}</span>
    `;
    
    container.appendChild(toast);
    feather.replace();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Quick Actions
async function quickStartServer() {
    if (!state.currentModel) {
        showToast('Please select a model first', 'warning');
        switchTab('models');
        return;
    }
    try {
        await ipc.startServer(state.currentModel, state.config.defaultParams || {});
        showToast('Server starting...', 'info');
    } catch (error) {
        showToast('Failed to start server: ' + error.message, 'error');
    }
}

async function quickStopServer() {
    try {
        await ipc.stopServer();
        showToast('Server stopped', 'success');
    } catch (error) {
        showToast('Error stopping server: ' + error.message, 'error');
    }
}

// Settings Actions
async function selectModelsDir() {
    const path = await ipc.selectDirectory();
    if (path) {
        document.getElementById('models-path').value = path;
        await ipc.updateConfig({ modelsPath: path });
        showToast('Models directory updated', 'success');
        refreshModelsList();
    }
}

async function selectBinariesDir() {
    const path = await ipc.selectDirectory();
    if (path) {
        document.getElementById('binaries-path').value = path;
        await ipc.updateConfig({ binariesPath: path });
        showToast('Binaries directory updated', 'success');
    }
}

async function resetAll() {
    if (confirm('Are you sure? This will reset all configuration.')) {
        await ipc.resetConfig();
        showToast('Configuration reset', 'success');
        location.reload();
    }
}

async function wipeBinaries() {
    if (confirm('WARNING: This will delete all llama.cpp binaries. Continue?')) {
        try {
            await ipc.wipeBinaries();
            showToast('Binaries wiped successfully', 'success');
            state.currentBinary = null;
            document.getElementById('dashboard-binary-version').textContent = 'Not Installed';
        } catch (error) {
            showToast('Error wiping binaries: ' + error.message, 'error');
        }
    }
}

function updateDownloadProgress(progress) {
    // Dispatch event for binary manager component
    const event = new CustomEvent('download-progress', { detail: progress });
    document.dispatchEvent(event);
}

function startLogWatcher() {
    // Request initial log buffer
    ipc.getLogs().then(logs => {
        const container = document.getElementById('log-container');
        if (logs.length === 0) return;
        container.innerHTML = '';
        logs.forEach(log => appendLog(log.message, log.type));
    });
}

// Global error handler
window.onerror = function(msg, url, line) {
    showToast(`Error: ${msg}`, 'error');
    return false;
};