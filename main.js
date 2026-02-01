const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn, exec } = require('child_process');
const https = require('https');
const os = require('os');
const extractZip = require('extract-zip');
const tar = require('tar');

// Paths - Updated to use the current working directory for portability
const baseDir = process.cwd(); 
const configPath = path.join(baseDir, 'config.json');
const logsPath = path.join(baseDir, 'logs.json');
const binPath = path.join(baseDir, 'bin');
const modelsPath = path.join(baseDir, 'models');

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
            headers: { 'User-Agent': 'Llama-Control-Center' }
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
                    resolve({ version: release.tag_name, assets: assets });
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(dest);
        let downloaded = 0;
        let totalSize = 0;
        
        https.get(url, { headers: { 'User-Agent': 'Llama-Control-Center' } }, (response) => {
            // Check for redirect
            if (response.statusCode === 301 || response.statusCode === 302) {
                require('fs').unlink(dest, () => {});
                return downloadFile(response.headers.location, dest, onProgress)
                    .then(resolve)
                    .catch(reject);
            }

            if (response.statusCode !== 200) {
                file.close();
                require('fs').unlink(dest, () => {});
                return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            }

            totalSize = parseInt(response.headers['content-length'], 10);
            
            response.on('data', (chunk) => {
                downloaded += chunk.length;
                if (totalSize && onProgress) {
                    onProgress(Math.round((downloaded / totalSize) * 100));
                }
            });

            response.on('end', () => {
                file.close();
                
                // Verify file was completely downloaded
                if (totalSize && downloaded !== totalSize) {
                    log(`Download incomplete: ${downloaded}/${totalSize} bytes`, 'error');
                    require('fs').unlink(dest, () => {});
                    reject(new Error(`Incomplete download: received ${downloaded} of ${totalSize} bytes`));
                } else {
                    log(`File downloaded successfully: ${downloaded} bytes`, 'info');
                    resolve();
                }
            });

            response.pipe(file);
            file.on('error', (err) => { 
                require('fs').unlink(dest, () => {}); 
                reject(err); 
            });
        }).on('error', reject);
    });
}

async function extractArchive(archivePath, dest) {
    try {
        // Verify file exists and has content
        const stats = await fs.stat(archivePath);
        if (stats.size < 100) {
            throw new Error(`Archive file too small (${stats.size} bytes) - likely incomplete download`);
        }

        log(`Extracting archive: ${archivePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`, 'info');

        if (archivePath.endsWith('.zip')) {
            try {
                await extractZip(archivePath, { dir: dest });
                log(`Successfully extracted ZIP file`, 'success');
            } catch (zipErr) {
                // If ZIP extraction fails, provide helpful error
                if (zipErr.message.includes('end of central directory') || zipErr.message.includes('ENOENT')) {
                    throw new Error(
                        `ZIP file is corrupted or incomplete. This usually means:\n` +
                        `1. Download was interrupted\n` +
                        `2. Network connection dropped\n` +
                        `3. File was corrupted during download\n\n` +
                        `Please try downloading again. Original error: ${zipErr.message}`
                    );
                }
                throw zipErr;
            }
        } else if (archivePath.endsWith('.tar.gz')) {
            try {
                await tar.extract({ file: archivePath, cwd: dest, strip: 1 });
                log(`Successfully extracted TAR.GZ file`, 'success');
            } catch (tarErr) {
                throw new Error(`TAR extraction failed: ${tarErr.message}`);
            }
        } else {
            throw new Error(`Unsupported archive format: ${archivePath}`);
        }

        // Verify extraction worked
        const extractedFiles = await fs.readdir(dest);
        if (extractedFiles.length === 0) {
            throw new Error('Archive extracted but no files found in destination');
        }

        log(`Archive extraction complete: ${extractedFiles.length} items extracted`, 'success');
        
        // Clean up archive
        await fs.unlink(archivePath);
        log(`Cleaned up archive file`, 'info');
    } catch (error) {
        log(`Extraction error: ${error.message}`, 'error');
        throw error;
    }
}

async function installBinary(asset, isCudart = false) {
    const config = await loadConfig();
    const tempFile = path.join(baseDir, asset.name);
    
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
        await extractArchive(tempFile, binPath);
    } else {
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

function getServerExecutable() {
    const platform = os.platform();
    if (platform === 'win32') return path.join(binPath, 'llama-server.exe');
    return path.join(binPath, 'llama-server');
}

async function startServer(modelName, params) {
    if (serverProcess) await stopServer();
    
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
        '--port', String(params.port || 8080),
        '--host', params.host || '127.0.0.1',
        '-c', String(params.ctxSize || 4096),
        '-ngl', String(params.gpuLayers || 0),
        '-t', String(params.threads || os.cpus().length),
        '-b', String(params.batchSize || 512)
    ];
    
    log(`Starting server with model: ${modelName}`, 'info');
    log(`Command: ${executable} ${args.join(' ')}`, 'info');
    
    serverProcess = spawn(executable, args, { cwd: binPath, stdio: ['ignore', 'pipe', 'pipe'] });
    currentModel = modelName;
    
    serverProcess.stdout.on('data', (data) => log(data.toString().trim(), 'info'));
    serverProcess.stderr.on('data', (data) => log(data.toString().trim(), 'error'));
    
    serverProcess.on('close', (code) => {
        log(`Server process exited with code ${code}`, code === 0 ? 'info' : 'error');
        serverProcess = null;
        currentModel = null;
        if (mainWindow) mainWindow.webContents.send('server-status', { running: false, model: null });
    });
    
    serverProcess.on('error', (err) => {
        log(`Server process error: ${err.message}`, 'error');
    });
    
    setTimeout(() => {
        if (mainWindow && serverProcess) {
            mainWindow.webContents.send('server-status', { running: true, model: modelName });
        }
    }, 1000);
    
    return { success: true };
}

async function stopServer() {
    if (!serverProcess) return;
    
    log('Stopping server...', 'info');
    
    if (os.platform() === 'win32') {
        exec(`taskkill /pid ${serverProcess.pid} /T /F`, (err) => {
            if (err && err.code !== 128) log(`Error killing process: ${err.message}`, 'error');
        });
    } else {
        serverProcess.kill('SIGTERM');
        setTimeout(() => {
            if (serverProcess) {
                serverProcess.kill('SIGKILL');
            }
        }, 3000);
    }
    
    serverProcess = null;
    currentModel = null;
}

// IPC Handlers
ipcMain.handle('get-config', () => loadConfig());

ipcMain.handle('update-config', async (event, newConfig) => {
    const config = await loadConfig();
    const updated = { ...config, ...newConfig };
    await saveConfig(updated);
    return updated;
});

ipcMain.handle('reset-config', async () => {
    await fs.unlink(configPath).catch(() => {});
    return loadConfig();
});

ipcMain.handle('get-releases', () => getLatestReleases());

ipcMain.handle('install-binary', (event, asset, isCudart) => installBinary(asset, isCudart));

ipcMain.handle('get-models', async () => {
    const config = await loadConfig();
    try {
        const files = await fs.readdir(config.modelsPath);
        return files.filter(f => f.endsWith('.gguf')).map(name => ({
            name: name,
            path: path.join(config.modelsPath, name)
        }));
    } catch {
        await fs.mkdir(config.modelsPath, { recursive: true });
        return [];
    }
});

ipcMain.handle('start-server', (event, model, params) => startServer(model, params));

ipcMain.handle('stop-server', () => stopServer());

ipcMain.handle('get-server-status', () => ({ running: !!serverProcess, model: currentModel }));

ipcMain.handle('get-logs', () => logBuffer);

ipcMain.handle('get-installed-binary', async () => {
    const config = await loadConfig();
    return config.installedBinary;
});

ipcMain.handle('wipe-binaries', async () => {
    const config = await loadConfig();
    try {
        await fs.rm(config.binariesPath || binPath, { recursive: true, force: true });
        config.installedBinary = null;
        await saveConfig(config);
        log('Binaries wiped', 'info');
        return { success: true };
    } catch (err) {
        log(`Error wiping binaries: ${err.message}`, 'error');
        throw err;
    }
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.on('open-dev-tools', () => {
    if (mainWindow) mainWindow.webContents.openDevTools();
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400, 
        height: 900,
        webPreferences: { 
            nodeIntegration: false, 
            contextIsolation: true, 
            preload: path.join(__dirname, 'preload.js'),
            sandbox: true
        }
    });
    
    mainWindow.loadFile('index.html');
    
    // Ensure local directories exist
    fs.mkdir(binPath, { recursive: true }).catch(() => {});
    fs.mkdir(modelsPath, { recursive: true }).catch(() => {});
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (serverProcess) stopServer();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});

// Graceful shutdown
process.on('exit', async () => {
    if (serverProcess) await stopServer();
});

process.on('SIGINT', async () => {
    if (serverProcess) await stopServer();
    process.exit(0);
});