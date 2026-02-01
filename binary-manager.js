class BinaryManager extends HTMLElement {
    constructor() {
        super();
        this.releases = [];
        this.categorized = {};
        this.selectedAsset = null;
        this.downloadingAssets = new Set();
        this.installedBinary = null;
    }

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
        this.loadReleases();
        this.loadInstalledBinary();
    }

    async loadInstalledBinary() {
        try {
            this.installedBinary = await window.electron.getInstalledBinary();
        } catch (error) {
            console.error('Error loading installed binary:', error);
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: system-ui, -apple-system, sans-serif;
                }

                .container {
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .header {
                    margin-bottom: 1.5rem;
                }

                .title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #e5e7eb;
                    margin-bottom: 0.25rem;
                }

                .subtitle {
                    font-size: 0.875rem;
                    color: #94a3b8;
                    margin-bottom: 1rem;
                }

                .info-box {
                    background: #1e293b;
                    border-left: 3px solid #8b5cf6;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    margin-bottom: 1.5rem;
                }

                .info-box p {
                    margin: 0.25rem 0;
                    font-size: 0.875rem;
                    color: #cbd5e1;
                }

                .category-section {
                    margin-bottom: 2rem;
                }

                .category-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f1f5f9;
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 2px solid #334155;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .category-badge {
                    background: #8b5cf6;
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .binaries-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .binary-card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }

                .binary-card:hover {
                    border-color: #8b5cf6;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
                }

                .binary-card.selected {
                    border-color: #8b5cf6;
                    background: rgba(139, 92, 246, 0.15);
                }

                .binary-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, #8b5cf6, #6366f1);
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .binary-card.selected::before {
                    opacity: 1;
                }

                .binary-name {
                    font-weight: 600;
                    color: #f1f5f9;
                    margin-bottom: 0.5rem;
                    word-break: break-all;
                    font-size: 0.95rem;
                }

                .binary-info {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                    display: flex;
                    justify-content: space-between;
                }

                .binary-size {
                    color: #64748b;
                }

                .binary-type {
                    display: inline-block;
                    background: rgba(139, 92, 246, 0.2);
                    color: #a78bfa;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    font-size: 0.7rem;
                    font-weight: 600;
                    margin-top: 0.5rem;
                }

                .actions {
                    margin-top: 2rem;
                    display: flex;
                    gap: 0.75rem;
                }

                button {
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
                }

                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-secondary {
                    background: #334155;
                    color: #e5e7eb;
                }

                .btn-secondary:hover {
                    background: #475569;
                }

                .empty {
                    text-align: center;
                    color: #94a3b8;
                    padding: 3rem 1rem;
                    border: 1px dashed #334155;
                    border-radius: 0.75rem;
                }

                .progress-bar {
                    width: 100%;
                    height: 4px;
                    background: #334155;
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 0.5rem;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #8b5cf6, #6366f1);
                    transition: width 0.2s ease;
                }

                .status-text {
                    font-size: 0.75rem;
                    color: #64748b;
                    margin-top: 0.25rem;
                }

                .cudart-note {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    color: #86efac;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }

                .cudart-note::before {
                    content: '✓';
                    font-weight: bold;
                }

                .installed-badge {
                    position: absolute;
                    top: 0.5rem;
                    right: 0.5rem;
                    background: #22c55e;
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 0.25rem;
                    font-size: 0.7rem;
                    font-weight: 600;
                }
            </style>

            <div class="container">
                <div class="header">
                    <div class="title">Available Binaries</div>
                    <div class="subtitle">Download llama.cpp binaries for your system</div>
                    ${this.installedBinary ? `
                        <div class="info-box">
                            <p><strong>Current Binary:</strong> ${this.installedBinary.version}</p>
                            <p style="font-size: 0.75rem; color: #64748b;">Installed: ${new Date(this.installedBinary.date).toLocaleDateString()}</p>
                        </div>
                    ` : ''}
                </div>

                <div id="binaries-content"></div>

                <div class="actions">
                    <button id="downloadBtn" class="btn-primary" disabled>
                        Download & Install Selected
                    </button>
                    <button id="refreshBtn" class="btn-primary">
                        Refresh Releases
                    </button>
                </div>
            </div>
        `;

        this.shadowRoot
            .getElementById('downloadBtn')
            .addEventListener('click', () => this.downloadSelected());

        this.shadowRoot
            .getElementById('refreshBtn')
            .addEventListener('click', () => this.loadReleases());
    }

    async loadReleases() {
        try {
            const result = await window.electron.getReleases();
            this.releases = result.assets || [];
            console.log('Releases loaded:', this.releases);
            this.categorizeReleases();
            this.renderBinaries();
        } catch (error) {
            console.error('Error loading releases:', error);
            const content = this.shadowRoot.getElementById('binaries-content');
            if (content) {
                content.innerHTML = `
                    <div class="empty">
                        Error loading releases: ${error.message}<br />
                        <small>Check your internet connection and try again.</small>
                    </div>
                `;
            }
        }
    }

    categorizeReleases() {
        this.categorized = {
            'CUDA 12.4': [],
            'CUDA 13.1': [],
            'Vulkan': [],
            'Metal (macOS)': [],
            'CPU Only': []
        };

        this.releases.forEach((asset) => {
            const name = asset.name.toLowerCase();

            if (name.includes('cuda-12.4')) {
                this.categorized['CUDA 12.4'].push(asset);
            } else if (name.includes('cuda-13.1')) {
                this.categorized['CUDA 13.1'].push(asset);
            } else if (name.includes('vulkan')) {
                this.categorized['Vulkan'].push(asset);
            } else if (name.includes('macos') || name.includes('arm64')) {
                this.categorized['Metal (macOS)'].push(asset);
            } else if (name.includes('cpu') || (!name.includes('cuda') && !name.includes('vulkan'))) {
                this.categorized['CPU Only'].push(asset);
            }
        });

        // Remove empty categories
        Object.keys(this.categorized).forEach((key) => {
            if (this.categorized[key].length === 0) {
                delete this.categorized[key];
            }
        });
    }

    renderBinaries() {
        const container = this.shadowRoot.getElementById('binaries-content');
        container.innerHTML = '';

        if (!this.releases.length) {
            container.innerHTML = `
                <div class="empty">
                    No binaries available.<br />
                    Loading releases...
                </div>
            `;
            return;
        }

        Object.entries(this.categorized).forEach(([category, assets]) => {
            const section = document.createElement('div');
            section.className = 'category-section';

            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'category-title';
            categoryTitle.innerHTML = `
                ${this.getCategoryIcon(category)} ${category}
                <span class="category-badge">${assets.length}</span>
            `;
            section.appendChild(categoryTitle);

            const grid = document.createElement('div');
            grid.className = 'binaries-grid';

            assets.forEach((asset) => {
                const card = document.createElement('div');
                card.className = 'binary-card';
                if (this.selectedAsset === asset.name) {
                    card.classList.add('selected');
                }

                const size = (asset.size / (1024 * 1024)).toFixed(2);
                const date = new Date(asset.created).toLocaleDateString();
                const assetType = this.getAssetType(asset.name);

                card.innerHTML = `
                    ${this.installedBinary && this.installedBinary.name === asset.name ? 
                        '<div class="installed-badge">INSTALLED</div>' : ''}
                    <div class="binary-name">${asset.name}</div>
                    <div class="binary-info">
                        <span>${date}</span>
                        <span class="binary-size">${size} MB</span>
                    </div>
                    <div class="binary-type">${assetType}</div>
                    ${this.shouldSuggestCudart(asset.name) ? 
                        '<div class="cudart-note">cudart will install automatically</div>' : ''}
                    ${
                        this.downloadingAssets.has(asset.name)
                            ? `
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-${asset.name}" style="width: 0%"></div>
                        </div>
                        <div class="status-text">Downloading...</div>
                    `
                            : ''
                    }
                `;

                card.addEventListener('click', () => this.selectAsset(asset));
                grid.appendChild(card);
            });

            section.appendChild(grid);
            container.appendChild(section);
        });
    }

    getCategoryIcon(category) {
        const icons = {
            'CUDA 12.4': '🟢',
            'CUDA 13.1': '🟢',
            'Vulkan': '🟣',
            'Metal (macOS)': '🍎',
            'CPU Only': '⚙️'
        };
        return icons[category] || '📦';
    }

    getAssetType(name) {
        const lower = name.toLowerCase();
        if (lower.includes('cuda')) {
            const match = name.match(/cuda[_-](\d+\.\d+)/i);
            return match ? `CUDA ${match[1]}` : 'CUDA';
        } else if (lower.includes('vulkan')) {
            return 'Vulkan';
        } else if (lower.includes('macos') || lower.includes('arm64')) {
            return 'Metal';
        } else if (lower.includes('cpu')) {
            return 'CPU Only';
        }
        return 'Standard';
    }

    shouldSuggestCudart(name) {
        return name.toLowerCase().includes('cuda') && !name.toLowerCase().includes('cudart');
    }

    selectAsset(asset) {
        this.selectedAsset = asset.name;
        this.renderBinaries();
        this.shadowRoot.getElementById('downloadBtn').disabled = false;
    }

    async downloadSelected() {
        if (!this.selectedAsset) return;

        const asset = this.releases.find((a) => a.name === this.selectedAsset);
        if (!asset) return;

        this.downloadingAssets.add(asset.name);
        this.renderBinaries();

        try {
            console.log('Installing binary:', asset.name);
            const result = await window.electron.installBinary(asset, false);
            console.log('Binary installed:', result);
            
            // Check if we should suggest installing cudart
            if (this.shouldSuggestCudart(asset.name)) {
                setTimeout(() => this.suggestCudartInstall(asset), 1000);
            }

            alert(`✓ Binary installed successfully!\nVersion: ${result.version}`);
            this.installedBinary = result;
            this.selectedAsset = null;
            this.downloadingAssets.delete(asset.name);
            this.renderBinaries();
        } catch (error) {
            console.error('Error downloading binary:', error);
            
            // Check if it's a corrupted zip error
            if (error.message.includes('end of central directory') || error.message.includes('truncated')) {
                alert(`⚠️ Download Failed: File appears to be corrupted or incomplete.\n\nTroubleshooting:\n1. Check your internet connection\n2. Try refreshing and downloading again\n3. GitHub API rate limit? Wait an hour and retry\n\nError: ${error.message}`);
            } else {
                alert(`❌ Error downloading binary: ${error.message}`);
            }
            
            this.downloadingAssets.delete(asset.name);
            this.renderBinaries();
        }
    }

    suggestCudartInstall(mainBinary) {
        // Find corresponding cudart binary
        const cudartMatch = mainBinary.name.match(/cuda[_-](\d+\.\d+)/i);
        if (cudartMatch) {
            const cudartVersion = cudartMatch[1];
            const cudartBinary = this.releases.find(a => 
                a.name.toLowerCase().includes('cudart') && 
                a.name.includes(cudartVersion)
            );

            if (cudartBinary) {
                const shouldInstall = confirm(
                    `🎯 Suggested: Install CUDA Runtime ${cudartVersion}\n\n` +
                    `This is recommended for GPU acceleration.\n\n` +
                    `Binary: ${cudartBinary.name}`
                );

                if (shouldInstall) {
                    this.selectedAsset = cudartBinary.name;
                    this.renderBinaries();
                    setTimeout(() => this.downloadSelected(), 500);
                }
            }
        }
    }
}

customElements.define('binary-manager', BinaryManager);