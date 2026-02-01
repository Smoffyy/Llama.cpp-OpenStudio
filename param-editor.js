class ParamEditor extends HTMLElement {
    constructor() {
        super();
        this.model = null;
        this.params = {};
    }

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: system-ui, -apple-system, sans-serif;
                    margin-top: 1.5rem;
                }

                .editor-card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                }

                .editor-title {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f1f5f9;
                    margin-bottom: 1rem;
                }

                .params-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .param-group {
                    display: flex;
                    flex-direction: column;
                }

                label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #cbd5e1;
                    margin-bottom: 0.5rem;
                }

                input[type="range"],
                input[type="number"],
                input[type="text"] {
                    padding: 0.5rem;
                    background: #0f172a;
                    border: 1px solid #334155;
                    color: #e2e8f0;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                }

                input[type="range"] {
                    cursor: pointer;
                }

                input:focus {
                    border-color: #8b5cf6;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
                }

                .range-value {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-top: 0.25rem;
                }

                .editor-actions {
                    display: flex;
                    gap: 0.75rem;
                    margin-top: 1.5rem;
                }

                button {
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                    flex: 1;
                }

                .btn-save {
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: white;
                }

                .btn-save:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
                }

                .btn-cancel {
                    background: #334155;
                    color: #e5e7eb;
                }

                .btn-cancel:hover {
                    background: #475569;
                }

                .preset-buttons {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .preset-btn {
                    padding: 0.5rem 1rem;
                    background: #334155;
                    color: #cbd5e1;
                    border: 1px solid #475569;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-size: 0.75rem;
                    transition: all 0.2s;
                }

                .preset-btn:hover {
                    background: #475569;
                    border-color: #8b5cf6;
                }
            </style>

            <div class="editor-card">
                <div class="editor-title">Model Parameters</div>

                <div class="preset-buttons">
                    <button class="preset-btn" onclick="this.getRootNode().host.loadPreset('balanced')">Balanced</button>
                    <button class="preset-btn" onclick="this.getRootNode().host.loadPreset('performance')">Performance</button>
                    <button class="preset-btn" onclick="this.getRootNode().host.loadPreset('lowmem')">Low Memory</button>
                </div>

                <div class="params-grid">
                    <div class="param-group">
                        <label for="ctxRange">Context Size: <span id="ctxValue">4096</span></label>
                        <input type="range" id="ctxRange" min="128" max="32768" value="4096" step="128">
                    </div>
                    <div class="param-group">
                        <label for="batchRange">Batch Size: <span id="batchValue">512</span></label>
                        <input type="range" id="batchRange" min="32" max="2048" value="512" step="32">
                    </div>
                    <div class="param-group">
                        <label for="threadsRange">Threads: <span id="threadsValue">4</span></label>
                        <input type="range" id="threadsRange" min="1" max="64" value="4">
                    </div>
                    <div class="param-group">
                        <label for="gpuRange">GPU Layers: <span id="gpuValue">0</span></label>
                        <input type="range" id="gpuRange" min="0" max="200" value="0">
                    </div>
                </div>

                <div class="editor-actions">
                    <button class="btn-save" onclick="this.getRootNode().host.saveParams()">Save Parameters</button>
                    <button class="btn-cancel" onclick="this.getRootNode().host.closeEditor()">Cancel</button>
                </div>
            </div>
        `;

        // Setup event listeners
        this.shadowRoot.getElementById('ctxRange').addEventListener('input', (e) => {
            this.shadowRoot.getElementById('ctxValue').textContent = e.target.value;
            this.params.ctxSize = parseInt(e.target.value, 10);
        });

        this.shadowRoot.getElementById('batchRange').addEventListener('input', (e) => {
            this.shadowRoot.getElementById('batchValue').textContent = e.target.value;
            this.params.batchSize = parseInt(e.target.value, 10);
        });

        this.shadowRoot.getElementById('threadsRange').addEventListener('input', (e) => {
            this.shadowRoot.getElementById('threadsValue').textContent = e.target.value;
            this.params.threads = parseInt(e.target.value, 10);
        });

        this.shadowRoot.getElementById('gpuRange').addEventListener('input', (e) => {
            this.shadowRoot.getElementById('gpuValue').textContent = e.target.value;
            this.params.gpuLayers = parseInt(e.target.value, 10);
        });
    }

    loadPreset(preset) {
        const presets = {
            balanced: { ctxSize: 4096, batchSize: 512, threads: 4, gpuLayers: 0 },
            performance: { ctxSize: 8192, batchSize: 1024, threads: 8, gpuLayers: 33 },
            lowmem: { ctxSize: 2048, batchSize: 256, threads: 2, gpuLayers: 0 }
        };

        if (presets[preset]) {
            const p = presets[preset];
            this.shadowRoot.getElementById('ctxRange').value = p.ctxSize;
            this.shadowRoot.getElementById('ctxValue').textContent = p.ctxSize;
            this.shadowRoot.getElementById('batchRange').value = p.batchSize;
            this.shadowRoot.getElementById('batchValue').textContent = p.batchSize;
            this.shadowRoot.getElementById('threadsRange').value = p.threads;
            this.shadowRoot.getElementById('threadsValue').textContent = p.threads;
            this.shadowRoot.getElementById('gpuRange').value = p.gpuLayers;
            this.shadowRoot.getElementById('gpuValue').textContent = p.gpuLayers;

            this.params = p;
        }
    }

    saveParams() {
        const event = new CustomEvent('params-updated', { detail: this.params });
        this.dispatchEvent(event);
        this.closeEditor();
    }

    closeEditor() {
        this.remove();
    }
}

customElements.define('param-editor', ParamEditor);