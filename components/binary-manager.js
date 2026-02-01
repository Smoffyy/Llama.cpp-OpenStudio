class BinaryManager extends HTMLElement {
    constructor() {
        super();
        this.installedBinary = null;
        this.releases = [];
        this.downloading = false;
    }

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: system-ui, -apple-system, sans-serif;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }
                .btn {
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                }
                .btn-primary {
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    color: white;
                }
                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
                }
                .btn-secondary {
                    background: #334155;
                    color: #e2e8f0;
                }
                .btn-secondary:hover {
                    background: #475569;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1.5rem;
                }
                .card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    transition: all 0.3s;
                    position: relative;
                    overflow: hidden;
                }
                .card:hover {
                    transform: translateY(-2px);
                    border-color: #8b5cf6;
                    box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.1);
                }
                .card.installed {
                    border-color: #22c55e;
                    background: rgba(34, 197, 94, 0.05);
                }
                .card.downloading {
                    opacity: 0.7;
                    pointer-events: none;
                }
                .badge {
                    display: inline-block;
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .badge-cuda {
                    background: #0891b2;
                    color: #cffafe;
                }
                .badge-vulkan {
                    background: #7c3aed;
                    color: #ede9fe;
                }
                .badge-metal {
                    background: #ea580c;
                    color: #ffedd5;
                }
                .badge-opencl {
                    background: #059669;
                    color: #d1fae5;
                }
                .badge-cudart {
                    background: #db2777;
                    color: #fce7f3;
                }
                .size {
                    color: #94a3b8;
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                }
                .actions {
                    margin-top: 1rem;
                    display: flex;
                    gap: 0.5rem;
                }
                .progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%);
                    transition: width 0.3s;
                }
                .info-box {
                    background: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .info-icon {
                    width: 2rem;
                    height: 2rem;
                    background: #334155;
                    border-radius: 0.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #8b5cf6;
                }
                .loading {
                    text-align: center;
                    padding: 3rem;
                    color: #94a3b8;
                }
                .spinner {
                    border: 3px solid rgba(139, 92, 246, 0.3);
                    border-radius: 50%;
                    border-top: 3px solid #8b5cf6;
                    width: 24px;
                    height: 24px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 1rem;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
            
            <div class="container">
                <div class="header">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-100">Binary Manager</h2>
                        <p class="text-slate-400 text-sm mt-1">Install and manage llama.cpp prebuilt binaries</p>
                    </div>
                    <button class="btn btn-secondary" id="refresh-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        Refresh
                    </button>
                </div>

                <div class="info-box" id="installed-info" style="display: none;">
                    <div class="info-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-slate-200 font-medium">Currently Installed</p>
                        <p class="text-slate-400 text-sm" id="installed-text">None</p>
                    </div>
                </div>

                <div id="loading-state" class="loading">
                    <div class="spinner"></div>
                    <p>Loading available binaries...</p>
                </div>

                <div id="binaries-grid" class="grid" style="display: none;"></div>
            </div>
        `;

        this.loadBinaries();
        
        this.shadowRoot.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadBinaries();
        });

        // Listen for download progress
        document.addEventListener('download-progress', (e) => {
            this.updateProgress(e.detail);
        });
    }

    async loadBinaries() {
        const grid = this.shadowRoot.getElementById('binaries-grid');
        const loading = this.shadowRoot.getElementById('loading-state');
        const installedInfo = this.shadowRoot.getElementById('installed-info');
        
        grid.style.display = 'none';
        loading.style.display = 'block';
        
        try {
            const [releases, installed] = await Promise.all([
                window.electron.getReleases(),
                window.electron.getInstalledBinary()
            ]);
            
            this.installedBinary = installed;
            this.releases = this.categorizeAssets(releases.assets);
            
            if (installed) {
                installedInfo.style.display = 'flex';
                this.shadowRoot.getElementById('installed-text').textContent = 
                    `${installed.name} (Build ${installed.version})`;
            }
            
            this.renderBinaries();
            loading.style.display = 'none';
            grid.style.display = 'grid';
        } catch (error) {
            loading.innerHTML = `<p class="text-red-400">Error loading binaries: ${error.message}</p>`;
        }
    }

    categorizeAssets(assets) {
        const categories = {
            cuda: [],
            vulkan: [],
            metal: [],
            opencl: [],
            cudart: [],
            other: []
        };
        
        assets.forEach(asset => {
            const name = asset.name.toLowerCase();
            if (name.includes('cudart')) {
                categories.cudart.push(asset);
            } else if (name.includes('cuda')) {
                categories.cuda.push(asset);
            } else if (name.includes('vulkan')) {
                categories.vulkan.push(asset);
            } else if (name.includes('metal') || (name.includes('macos') && !name.includes('x64'))) {
                categories.metal.push(asset);
            } else if (name.includes('opencl')) {
                categories.opencl.push(asset);
            } else {
                categories.other.push(asset);
            }
        });
        
        return categories;
    }

    renderBinaries() {
        const grid = this.shadowRoot.getElementById('binaries-grid');
        grid.innerHTML = '';
        
        // Render CUDART first if CUDA available
        if (this.releases.cudart.length > 0) {
            this.renderCategory(grid, 'CUDA Runtime (Required for CUDA)', this.releases.cudart, 'cudart');
        }
        
        if (this.releases.cuda.length > 0) {
            this.renderCategory(grid, 'CUDA Accelerated (NVIDIA GPUs)', this.releases.cuda, 'cuda');
        }
        
        if (this.releases.vulkan.length > 0) {
            this.renderCategory(grid, 'Vulkan Accelerated (AMD/Intel/NVIDIA)', this.releases.vulkan, 'vulkan');
        }
        
        if (this.releases.metal.length > 0) {
            this.renderCategory(grid, 'Metal Accelerated (Apple Silicon)', this.releases.metal, 'metal');
        }
        
        if (this.releases.opencl.length > 0) {
            this.renderCategory(grid, 'OpenCL Accelerated', this.releases.opencl, 'opencl');
        }
        
        if (this.releases.other.length > 0) {
            this.renderCategory(grid, 'Other Platforms', this.releases.other, 'other');
        }
    }

    renderCategory(container, title, assets, type) {
        const titleEl = document.createElement('div');
        titleEl.style.gridColumn = '1 / -1';
        titleEl.style.marginTop = '1rem';
        titleEl.innerHTML = `<h3 class="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">${title}</h3>`;
        container.appendChild(titleEl);
        
        assets.forEach(asset => {
            const card = document.createElement('div');
            card.className = 'card';
            card.id = `card-${asset.id}`;
            
            const isInstalled = this.installedBinary && this.installedBinary.name === asset.name;
            if (isInstalled) card.classList.add('installed');
            
            const badgeClass = type === 'cuda' ? 'badge-cuda' : 
                              type === 'vulkan' ? 'badge-vulkan' : 
                              type === 'metal' ? 'badge-metal' : 
                              type === 'opencl' ? 'badge-opencl' : 
                              type === 'cudart' ? 'badge-cudart' : 'badge-secondary';
            
            const badgeText = type === 'cudart' ? 'CUDART' : type.toUpperCase();
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    ${isInstalled ? '<span style="color: #22c55e; font-size: 0.875rem; font-weight: 500;">✓ Installed</span>' : ''}
                </div>
                <h4 style="color: #e2e8f0; font-weight: 600; margin-bottom: 0.5rem; word-break: break-all;">${asset.name}</h4>
                <p class="size">${this.formatBytes(asset.size)} • ${new Date(asset.created).toLocaleDateString()}</p>
                <div class="actions">
                    <button class="btn btn-primary install-btn" data-id="${asset.id}" data-cudart="${type === 'cudart'}">
                        ${isInstalled ? 'Reinstall' : 'Install'}
                    </button>
                    ${type === 'cuda' ? `<button class="btn btn-secondary cudart-btn" style="font-size: 0.875rem;">+ CUDART</button>` : ''}
                </div>
                <div class="progress" style="width: 0%; display: none;"></div>
            `;
            
            container.appendChild(card);
            
            // Install button
            card.querySelector('.install-btn').addEventListener('click', () => {
                this.installBinary(asset, type === 'cudart');
            });
            
            // CUDART button for CUDA binaries
            const cudartBtn = card.querySelector('.cudart-btn');
            if (cudartBtn) {
                cudartBtn.addEventListener('click', () => {
                    // Find matching CUDART version
                    const cudaVersion = asset.name.match(/cuda-(\d+\.\d+)/)?.[1];
                    if (cudaVersion) {
                        const cudartAsset = this.releases.cudart.find(c => c.name.includes(cudaVersion));
                        if (cudartAsset) {
                            this.installBinary(cudartAsset, true);
                        } else {
                            alert(`No CUDART found for CUDA ${cudaVersion}. Please install CUDART manually.`);
                        }
                    }
                });
            }
        });
    }

    async installBinary(asset, isCudart) {
        if (this.downloading) return;
        this.downloading = true;
        
        const card = this.shadowRoot.getElementById(`card-${asset.id}`);
        card.classList.add('downloading');
        const progressBar = card.querySelector('.progress');
        progressBar.style.display = 'block';
        
        try {
            await window.electron.installBinary(asset, isCudart);
            
            // Show success
            card.classList.remove('downloading');
            if (!isCudart) {
                card.classList.add('installed');
                card.querySelector('.install-btn').textContent = 'Reinstall';
            }
            
            // Update installed info
            if (!isCudart) {
                const installedInfo = this.shadowRoot.getElementById('installed-info');
                const installedText = this.shadowRoot.getElementById('installed-text');
                installedInfo.style.display = 'flex';
                installedText.textContent = `${asset.name} (Just installed)`;
            }
            
            // Dispatch event to update dashboard
            document.dispatchEvent(new CustomEvent('binary-installed', { detail: asset }));
            
        } catch (error) {
            alert('Installation failed: ' + error.message);
            card.classList.remove('downloading');
        } finally {
            this.downloading = false;
            progressBar.style.display = 'none';
            progressBar.style.width = '0%';
        }
    }

    updateProgress(progress) {
        // Find card with matching name and update progress
        const cards = this.shadowRoot.querySelectorAll('.card');
        cards.forEach(card => {
            const name = card.querySelector('h4')?.textContent;
            if (name === progress.name) {
                const progressBar = card.querySelector('.progress');
                progressBar.style.display = 'block';
                progressBar.style.width = `${progress.progress}%`;
                
                if (progress.status === 'completed') {
                    setTimeout(() => {
                        progressBar.style.display = 'none';
                        progressBar.style.width = '0%';
                    }, 1000);
                }
            }
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

customElements.define('binary-manager', BinaryManager);