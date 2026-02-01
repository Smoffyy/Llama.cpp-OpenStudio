class ServerControl extends HTMLElement {
    constructor() {
        super();
        this.serverRunning = false;
        this.currentModel = null;
        this.models = [];
        this.params = {};
    }

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
        this.loadModels();
        this.setupListeners();
    }

    setupListeners() {
        document.addEventListener('models-updated', (e) => {
            this.models = e.detail || [];
            this.updateModelSelect();
        });
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: system-ui, -apple-system, sans-serif;
                }

                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }

                .card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .card-title {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f1f5f9;
                    margin-bottom: 1rem;
                }

                .form-group {
                    margin-bottom: 1.5rem;
                }

                label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #cbd5e1;
                    margin-bottom: 0.5rem;
                }

                input[type="text"],
                input[type="number"],
                select {
                    width: 100%;
                    padding: 0.75rem;
                    background: #0f172a;
                    border: 1px solid #334155;
                    color: #e2e8f0;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }

                input[type="text"]:focus,
                input[type="number"]:focus,
                select:focus {
                    border-color: #8b5cf6;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
                }

                .param-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .actions {
                    display: flex;
                    gap: 0.75rem;
                    margin-top: 1.5rem;
                }

                button {
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                    flex: 1;
                }

                .btn-success {
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    color: white;
                }

                .btn-success:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
                }

                .btn-danger {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                }

                .btn-danger:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
                }

                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .status-box {
                    background: #0f172a;
                    border-left: 3px solid #334155;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    margin-top: 1rem;
                }

                .status-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.5rem 0;
                    font-size: 0.875rem;
                }

                .status-label {
                    color: #94a3b8;
                }

                .status-value {
                    color: #f1f5f9;
                    font-weight: 500;
                }

                .status-value.running {
                    color: #22c55e;
                }

                .status-value.stopped {
                    color: #ef4444;
                }

                .info-text {
                    font-size: 0.75rem;
                    color: #64748b;
                    margin-top: 0.5rem;
                }
            </style>

            <div class="container">
                <div class="card">
                    <div class="card-title">Server Status</div>
                    <div class="status-box">
                        <div class="status-item">
                            <span class="status-label">Server Status:</span>
                            <span class="status-value stopped" id="statusValue">Stopped</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Loaded Model:</span>
                            <span class="status-value" id="modelValue">None</span>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title">Server Configuration</div>
                    
                    <div class="form-group">
                        <label>Model</label>
                        <select id="modelSelect">
                            <option value="">Select a model...</option>
                        </select>
                        <div class="info-text">Choose a .gguf model file to load</div>
                    </div>

                    <div class="param-row">
                        <div class="form-group">
                            <label>Port</label>
                            <input type="number" id="portInput" value="8080" min="1024" max="65535">
                            <div class="info-text">Server port (default: 8080)</div>
                        </div>
                        <div class="form-group">
                            <label>Host</label>
                            <input type="text" id="hostInput" value="127.0.0.1">
                            <div class="info-text">Server host/IP address</div>
                        </div>
                    </div>

                    <div class="param-row">
                        <div class="form-group">
                            <label>Context Size</label>
                            <input type="number" id="ctxInput" value="4096" min="128" step="128">
                            <div class="info-text">Max context length (tokens)</div>
                        </div>
                        <div class="form-group">
                            <label>GPU Layers</label>
                            <input type="number" id="gpuInput" value="0" min="0">
                            <div class="info-text">Layers to offload to GPU</div>
                        </div>
                    </div>

                    <div class="param-row">
                        <div class="form-group">
                            <label>Threads</label>
                            <input type="number" id="threadsInput" value="4" min="1">
                            <div class="info-text">CPU threads for inference</div>
                        </div>
                        <div class="form-group">
                            <label>Batch Size</label>
                            <input type="number" id="batchInput" value="512" min="32" step="32">
                            <div class="info-text">Max batch size</div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="actions">
                        <button id="startBtn" class="btn-success">Start Server</button>
                        <button id="stopBtn" class="btn-danger" disabled>Stop Server</button>
                    </div>
                </div>
            </div>
        `;

        this.shadowRoot
            .getElementById('startBtn')
            .addEventListener('click', () => this.startServer());

        this.shadowRoot
            .getElementById('stopBtn')
            .addEventListener('click', () => this.stopServer());

        this.shadowRoot
            .getElementById('modelSelect')
            .addEventListener('change', (e) => {
                this.currentModel = e.target.value;
            });

        // Listen for server status updates
        window.electron.onServerStatus((data) => {
            this.updateServerStatus(data.running, data.model);
        });

        this.updateServerStatus(false, null);
    }

    async loadModels() {
        try {
            this.models = await window.electron.getModels();
            console.log('Models loaded in server control:', this.models);
            this.updateModelSelect();
        } catch (error) {
            console.error('Error loading models:', error);
        }
    }

    updateModelSelect() {
        const select = this.shadowRoot.getElementById('modelSelect');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">Select a model...</option>';

        this.models.forEach((model) => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    async startServer() {
        if (!this.currentModel) {
            alert('Please select a model');
            return;
        }

        const params = {
            port: parseInt(this.shadowRoot.getElementById('portInput').value, 10),
            host: this.shadowRoot.getElementById('hostInput').value,
            ctxSize: parseInt(this.shadowRoot.getElementById('ctxInput').value, 10),
            gpuLayers: parseInt(this.shadowRoot.getElementById('gpuInput').value, 10),
            threads: parseInt(this.shadowRoot.getElementById('threadsInput').value, 10),
            batchSize: parseInt(this.shadowRoot.getElementById('batchInput').value, 10)
        };

        try {
            console.log('Starting server with model:', this.currentModel, 'params:', params);
            await window.electron.startServer(this.currentModel, params);
        } catch (error) {
            console.error('Error starting server:', error);
            alert(`Error starting server: ${error.message}`);
        }
    }

    async stopServer() {
        try {
            await window.electron.stopServer();
        } catch (error) {
            console.error('Error stopping server:', error);
            alert(`Error stopping server: ${error.message}`);
        }
    }

    updateServerStatus(running, model) {
        const statusValue = this.shadowRoot.getElementById('statusValue');
        const modelValue = this.shadowRoot.getElementById('modelValue');
        const startBtn = this.shadowRoot.getElementById('startBtn');
        const stopBtn = this.shadowRoot.getElementById('stopBtn');

        if (running) {
            statusValue.textContent = 'Running';
            statusValue.className = 'status-value running';
            modelValue.textContent = model || 'Unknown';
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            statusValue.textContent = 'Stopped';
            statusValue.className = 'status-value stopped';
            modelValue.textContent = 'None';
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }

        this.serverRunning = running;
    }
}

customElements.define('server-control', ServerControl);