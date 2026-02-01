const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn, exec } = require('child_process');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');
const tar = require('tar');
const extractZip = require('extract-zip');
const os = require('os');

// Paths
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');
const logsPath = path.join(userDataPath, 'logs.json');
const binPath = path.join(userDataPath, 'bin');
const modelsPath = path.join(userDataPath, 'models');

// State
let mainWindow = null;
let serverProcess = null;
let currentModel = null;
let logBuffer = [];
const MAX_LOGS = 1000;

// Config management
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf8');
        return JSON.parse(data);
    } catch {
        const defaultConfig = {
            modelsPath: modelsPath,
            binariesPath: binPath,
            defaultParams: {
                ctxSize: 4096,
                gpuLayers: 0,
                port: 8080,
                host: '127.0.0.1',
                threads: os.cpus().length,
                batchSize: 512
            },
            installedBinary: null
        };
        await saveConfig(defaultConfig);
        return defaultConfig;
    }
}

async function saveConfig(config) {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

// Logging
function log(message, type = 'info') {
    const entry = { timestamp: Date.now(), message, type };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();
    
    if (mainWindow) {
        mainWindow.webContents.send('server-log', entry);
    }
    
    // Also save to file occasionally
    if (logBuffer.length % 10 === 0) {
        fs.writeFile(logsPath, JSON.stringify(logBuffer)).catch(() => {});
    }
}

// Binary Management
async function getLatestReleases() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/ggml-org/llama.cpp/releases/latest',
            headers: {
                'User-Agent': 'Llama-Control-Center'
            }
        };
        
        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    const assets = release.assets.map(asset => ({
                        name: asset.name,
                        url: asset.browser_download_url,
                        size: asset.size,
                        created: asset.created_at,
                        id: asset.id
                    }));
                    resolve({
                        version: release.tag_name,
                        assets: assets
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(dest);
        let downloaded = 0;
        
        https.get(url, { headers: { 'User-Agent': 'Llama-Control-Center' } }, (response) => {
            const total = parseInt(response.headers['content-length'], 10);
            
            response.on('data', (chunk) => {
                downloaded += chunk.length;
                if (total && onProgress) {
                    onProgress(Math.round((downloaded / total) * 100));
                }
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                resolve();
            });
            
            file.on('error', (err) => {
                require('fs').unlink(dest, () => {});
                reject(err);
            });
        }).on('error', reject);
    });
}

async function extractArchive(archivePath, dest) {
    if (archivePath.endsWith('.zip')) {
        await extractZip(archivePath, { dir: dest });
    } else if (archivePath.endsWith('.tar.gz')) {
        await tar.extract({
            file: archivePath,
            cwd: dest,
            strip: 1
        });
    }
    await fs.unlink(archivePath);
}

async function installBinary(asset, isCudart = false) {
    const config = await loadConfig();
    const tempFile = path.join(userDataPath, asset.name);
    
    log(`Downloading ${asset.name}...`, 'info');
    
    await downloadFile(asset.url, tempFile, (progress) => {
        if (mainWindow) {
            mainWindow.webContents.send('download-progress', {
                name: asset.name,
                progress: progress,
                status: 'downloading'
            });
        }
    });
    
    log(`Extracting ${asset.name}...`, 'info');
    
    if (isCudart) {
        // CUDART goes into bin folder alongside llama binaries
        await extractArchive(tempFile, binPath);
    } else {
        // Clear existing binaries if updating
        if (config.installedBinary) {
            await fs.rm(binPath, { recursive: true, force: true });
            await fs.mkdir(binPath, { recursive: true });
        }
        await extractArchive(tempFile, binPath);
    }
    
    if (!isCudart) {
        config.installedBinary = {
            name: asset.name,
            version: asset.name.match(/llama-b(\d+)-/)?.[1] || 'unknown',
            date: new Date().toISOString()
        };
        await saveConfig(config);
    }
    
    if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
            name: asset.name,
            progress: 100,
            status: 'completed'
        });
    }
    
    log(`Installation of ${asset.name} completed`, 'success');
    return config.installedBinary;
}

// Server Management
function getServerExecutable() {
    const platform = os.platform();
    if (platform === 'win32') return path.join(binPath, 'llama-server.exe');
    if (platform === 'darwin') return path.join(binPath, 'llama-server');
    return path.join(binPath, 'llama-server');
}

async function startServer(modelName, params) {
    if (serverProcess) {
        await stopServer();
    }
    
    const config = await loadConfig();
    const modelPath = path.join(config.modelsPath, modelName);
    
    try {
        await fs.access(modelPath);
    } catch {
        throw new Error('Model file not found');
    }
    
    const executable = getServerExecutable();
    const args = [
        '-m', modelPath,
        '--port', params.port || 8080,
        '--host', params.host || '127.0.0.1',
        '-c', params.ctxSize || 4096,
        '-ngl', params.gpuLayers || 0,
        '-t', params.threads || os.cpus().length,
        '-b', params.batchSize || 512,
        '--api-key', params.apiKey || ''
    ];
    
    if (params.flashAttn) args.push('-fa');
    if (params.mlock) args.push('--mlock');
    if (params.noMmap) args.push('--no-mmap');
    
    log(`Starting server with model: ${modelName}`, 'info');
    log(`Args: ${args.join(' ')}`, 'info');
    
    serverProcess = spawn(executable, args, {
        cwd: binPath,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    
    currentModel = modelName;
    
    serverProcess.stdout.on('data', (data) => {
        log(data.toString().trim(), 'info');
    });
    
    serverProcess.stderr.on('data', (data) => {
        log(data.toString().trim(), 'error');
    });
    
    serverProcess.on('close', (code) => {
        log(`Server process exited with code ${code}`, code === 0 ? 'info' : 'error');
        serverProcess = null;
        currentModel = null;
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false, model: null });
        }
    });
    
    // Give it a moment to start
    setTimeout(() => {
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: true, model: modelName });
        }
    }, 1000);
    
    return { success: true };
}

async function stopServer() {
    if (!serverProcess) return;
    
    log('Stopping server...', 'info');
    
    if (os.platform() === 'win32') {
        exec(`taskkill /pid ${serverProcess.pid} /T /F`);
    } else {
        serverProcess.kill('SIGTERM');
        setTimeout(() => {
            if (serverProcess) serverProcess.kill('SIGKILL');
        }, 5000);
    }
    
    serverProcess = null;
    currentModel = null;
}

// IPC Handlers
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('update-config', (event, newConfig) => {
    return loadConfig().then(async (config) => {
        const updated = { ...config, ...newConfig };
        await saveConfig(updated);
        return updated;
    });
});
ipcMain.handle('reset-config', async () => {
    await fs.unlink(configPath).catch(() => {});
    return loadConfig();
});

ipcMain.handle('get-releases', () => getLatestReleases());
ipcMain.handle('install-binary', (event, asset, isCudart) => installBinary(asset, isCudart));
ipcMain.handle('wipe-binaries', async () => {
    await fs.rm(binPath, { recursive: true, force: true });
    await fs.mkdir(binPath, { recursive: true });
    const config = await loadConfig();
    config.installedBinary = null;
    await saveConfig(config);
});

ipcMain.handle('get-models', async () => {
    const config = await loadConfig();
    try {
        const files = await fs.readdir(config.modelsPath);
        return files.filter(f => f.endsWith('.gguf'));
    } catch {
        await fs.mkdir(config.modelsPath, { recursive: true });
        return [];
    }
});

ipcMain.handle('start-server', (event, model, params) => startServer(model, params));
ipcMain.handle('stop-server', stopServer);
ipcMain.handle('get-server-status', () => ({
    running: !!serverProcess,
    model: currentModel
}));

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

ipcMain.handle('get-logs', () => logBuffer);
ipcMain.handle('get-installed-binary', async () => {
    const config = await loadConfig();
    return config.installedBinary;
});

// Window Management
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0f172a'
    });
    
    mainWindow.loadFile('index.html');
    
    // Ensure directories exist
    fs.mkdir(binPath, { recursive: true }).catch(() => {});
    fs.mkdir(modelsPath, { recursive: true }).catch(() => {});
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (serverProcess) stopServer();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Cleanup on exit
process.on('exit', () => {
    if (serverProcess) stopServer();
});