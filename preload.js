const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    updateConfig: (config) => ipcRenderer.invoke('update-config', config),
    resetConfig: () => ipcRenderer.invoke('reset-config'),
    
    // Binaries
    getReleases: () => ipcRenderer.invoke('get-releases'),
    installBinary: (asset, isCudart) => ipcRenderer.invoke('install-binary', asset, isCudart),
    getInstalledBinary: () => ipcRenderer.invoke('get-installed-binary'),
    wipeBinaries: () => ipcRenderer.invoke('wipe-binaries'),
    
    // Models
    getModels: () => ipcRenderer.invoke('get-models'),
    
    // Server
    startServer: (model, params) => ipcRenderer.invoke('start-server', model, params),
    stopServer: () => ipcRenderer.invoke('stop-server'),
    getServerStatus: () => ipcRenderer.invoke('get-server-status'),
    getLogs: () => ipcRenderer.invoke('get-logs'),
    
    // Utils
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    openDevTools: () => ipcRenderer.send('open-dev-tools'),
    
    // Listeners
    onServerStatus: (callback) => ipcRenderer.on('server-status', (event, data) => callback(data)),
    onServerLog: (callback) => ipcRenderer.on('server-log', (event, data) => callback(data)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});