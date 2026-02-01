class ModelManager extends HTMLElement {
    constructor() {
        super();
        this.models = [];
        this.selectedModel = null;
        this.modelParams = {};
    }

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupListeners();
    }

    setupListeners() {
        // Listen for global model updates
        document.addEventListener('models-updated', (e) => {
            this.models = e.detail || [];
            console.log('ModelManager received models:', this.models);
            this.renderModelList();
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
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #e5e7eb;
                }

                .models-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .model-card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 0.75rem;
                    padding: 1rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .model-card:hover {
                    border-color: #8b5cf6;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
                }

                .model-card.selected {
                    border-color: #8b5cf6;
                    background: rgba(139, 92, 246, 0.15);
                }

                .model-name {
                    font-weight: 600;
                    color: #f1f5f9;
                    margin-bottom: 0.25rem;
                    word-break: break-all;
                }

                .model-meta {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    word-break: break-all;
                }

                .actions {
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
                    flex: 1;
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

                .btn-secondary:hover:not(:disabled) {
                    background: #475569;
                }

                .empty {
                    text-align: center;
                    color: #94a3b8;
                    padding: 3rem 1rem;
                    border: 1px dashed #334155;
                    border-radius: 0.75rem;
                }
            </style>

            <div class="container">
                <div class="header">
                    <div class="title">Installed Models</div>
                </div>

                <div id="models" class="models-grid"></div>

                <div class="actions">
                    <button id="loadBtn" class="btn-primary" disabled>
                        Load Selected Model
                    </button>
                </div>

                <div id="params"></div>
            </div>
        `;

        this.shadowRoot
            .getElementById('loadBtn')
            .addEventListener('click', () => this.loadSelectedModel());

        this.renderModelList();
    }

    renderModelList() {
        const container = this.shadowRoot.getElementById('models');
        container.innerHTML = '';

        if (!this.models || !this.models.length) {
            container.innerHTML = `
                <div class="empty">
                    No models found.<br />
                    Add .gguf files to your models directory.
                </div>
            `;
            return;
        }

        this.models.forEach((model) => {
            const card = document.createElement('div');
            card.className = 'model-card';
            if (this.selectedModel === model.name) {
                card.classList.add('selected');
            }

            card.innerHTML = `
                <div class="model-name">${model.name}</div>
                <div class="model-meta">${model.path}</div>
            `;

            card.addEventListener('click', () => {
                this.selectModel(model.name);
            });

            container.appendChild(card);
        });
    }

    selectModel(modelName) {
        this.selectedModel = modelName;

        this.shadowRoot.getElementById('loadBtn').disabled = false;

        this.renderModelList();

        // Update global UI immediately
        const active = document.getElementById('active-model-name');
        if (active) active.textContent = modelName;
    }

    async loadSelectedModel() {
        if (!this.selectedModel) {
            alert('Please select a model');
            return;
        }

        try {
            console.log('Loading model:', this.selectedModel, 'with params:', this.modelParams);
            await window.electron.startServer(
                this.selectedModel,
                this.modelParams || {}
            );
        } catch (err) {
            console.error('Failed to load model:', err);
            alert(`Failed to load model: ${err.message}`);
        }
    }

    openParamEditor() {
        const container = this.shadowRoot.getElementById('params');
        container.innerHTML = '';

        const editor = document.createElement('param-editor');
        editor.model = this.selectedModel;
        editor.params = this.modelParams;

        editor.addEventListener('params-updated', (e) => {
            this.modelParams = e.detail;
            console.log('Parameters updated:', this.modelParams);
        });

        container.appendChild(editor);
    }
}

customElements.define('model-manager', ModelManager);