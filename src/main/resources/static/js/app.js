function initApp() {
    if (typeof Terminal === 'undefined') {
        setTimeout(initApp, 100);
        return;
    }

    // Terminal setup
    const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 12,
        fontFamily: "'Courier New', monospace",
        theme: {
            background: '#000000',
            foreground: '#00d4ff',
            cursor: '#00d4ff',
        }
    });

    const terminalDiv = document.getElementById('terminal');
    term.open(terminalDiv);
    term.write('Welcome to Conductor Terminal\r\n');
    term.write('Ready to execute commands...\r\n\r\n');

    let ws;
    let instances = [];
    let startTemplates = [];
    let selectedInstance = null;
    let activeMenuInstanceId = null;
    let pendingInstanceCreation = null;
    const createSection = document.getElementById('createInstanceForm');
    const createToggleBtn = document.getElementById('createToggleBtn');
    const instancesList = document.getElementById('instancesList');
    const startTemplateSelect = document.getElementById('startTemplateSelect');
    const placeholderModal = document.getElementById('placeholderModal');
    const placeholderForm = document.getElementById('placeholderForm');
    const placeholderFields = document.getElementById('placeholderFields');
    const placeholderModalSubtitle = document.getElementById('placeholderModalSubtitle');

    function initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(protocol + '//' + window.location.host + '/ws/terminal');
        
        ws.onopen = () => {
            term.write('✓ Terminal connected\r\n');
        };
        
        ws.onmessage = (event) => {
            const message = event.data;
            if (message.startsWith('OUTPUT: ')) {
                term.write(message.substring(8) + '\r\n');
            } else if (message.startsWith('EXIT: ')) {
                const code = message.substring(6);
                term.write('\r\n✓ Command exited with code: ' + code + '\r\n');
            } else if (message.startsWith('ERROR: ')) {
                term.write('\r\n✗ Error: ' + message.substring(7) + '\r\n');
            } else {
                term.write(message + '\r\n');
            }
        };
        
        ws.onerror = (error) => {
            term.write('\r\n✗ WebSocket error: ' + error + '\r\n');
        };
        
        ws.onclose = () => {
            term.write('\r\n✗ Terminal disconnected\r\n');
            setTimeout(initWebSocket, 3000);
        };
    }

    // Load instances list
    async function loadInstances() {
        try {
            console.log('Fetching instances from /api/instances...');
            const response = await fetch('/api/instances');
            console.log('Response status:', response.status, response.ok);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            instances = await response.json();
            console.log('Loaded instances:', instances);
            renderInstances();
            await refreshInstanceStatuses();
        } catch (error) {
            console.error('Failed to load instances:', error);
            term.write('✗ Failed to load instances: ' + error.message + '\r\n');
            const list = document.getElementById('instancesList');
            list.innerHTML = '<div class="loading">Error loading instances</div>';
        }
    }

    function getInstanceStatusText(inst) {
        if (inst.statusMessage && String(inst.statusMessage).trim()) {
            return inst.statusMessage;
        }

        if (inst.running) {
            return 'Awaiting the first status update...';
        }

        return 'Instance is stopped. Start it to receive status updates.';
    }

    async function refreshInstanceStatuses() {
        if (!instances.length) {
            return;
        }

        const updates = await Promise.all(instances.map(async (inst) => {
            try {
                const response = await fetch(`/api/instances/${inst.id}/status`);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const status = await response.json();
                return {
                    id: inst.id,
                    running: status.running,
                    pid: status.pid,
                    statusMessage: status.statusMessage
                };
            } catch (error) {
                console.error(`Failed to refresh status for ${inst.id}:`, error);
                return {
                    id: inst.id,
                    statusMessage: 'Status unavailable right now.'
                };
            }
        }));

        const updatesById = new Map(updates.map((update) => [update.id, update]));
        instances = instances.map((inst) => ({
            ...inst,
            ...(updatesById.get(inst.id) || {})
        }));
        renderInstances();
    }

    async function loadStartTemplates() {
        try {
            const response = await fetch('/api/instances/templates');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            startTemplates = await response.json();

            if (!startTemplates.length) {
                startTemplateSelect.innerHTML = '<option value="">No templates available</option>';
                startTemplateSelect.disabled = true;
                return;
            }

            startTemplateSelect.disabled = false;
            startTemplateSelect.innerHTML = '';
            startTemplates.forEach((template, index) => {
                const option = document.createElement('option');
                option.value = template.name;
                option.textContent = template.name;
                if (index === 0) {
                    option.selected = true;
                }
                startTemplateSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load templates:', error);
            term.write('✗ Failed to load templates: ' + error.message + '\r\n');
            startTemplateSelect.innerHTML = '<option value="">No templates available</option>';
            startTemplateSelect.disabled = true;
        }
    }

    function renderInstances() {
        const list = instancesList;
        
        if (instances.length === 0) {
            list.innerHTML = '<div class="loading">No instances</div>';
            return;
        }

        if (activeMenuInstanceId && !instances.some(inst => inst.id === activeMenuInstanceId)) {
            activeMenuInstanceId = null;
        }
        
        list.innerHTML = instances.map(inst => `
            <div class="instance-item ${selectedInstance === inst.id ? 'selected' : ''}" data-id="${inst.id}">
                <div class="instance-top">
                    <div class="instance-header">
                        <div class="instance-title-row">
                            <div class="instance-name">${inst.id}</div>
                            <span class="status-badge ${inst.running ? 'status-running' : 'status-stopped'}">
                                ${inst.running ? 'Running' : 'Stopped'}
                            </span>
                            <span class="instance-pid">PID: ${inst.pid && inst.pid !== -1 ? inst.pid : '-'}</span>
                        </div>
                    </div>
                    <div class="instance-menu-wrapper">
                        <button
                            type="button"
                            class="instance-menu-btn"
                            data-menu-button="true"
                            data-id="${inst.id}"
                            aria-haspopup="true"
                            aria-expanded="${activeMenuInstanceId === inst.id ? 'true' : 'false'}"
                            title="Instance actions"
                        >⋮</button>
                        <div class="instance-menu ${activeMenuInstanceId === inst.id ? 'open' : ''}" data-menu-for="${inst.id}">
                            <button type="button" class="instance-menu-action" data-action="toggle-autostart" data-id="${inst.id}">
                                ${inst.autoStart ? 'Disable auto-start' : 'Enable auto-start'}
                            </button>
                            <button type="button" class="instance-menu-action danger" data-action="delete" data-id="${inst.id}">
                                Delete instance
                            </button>
                        </div>
                    </div>
                </div>
                <div class="instance-status-line">
                    <span class="status-line-label">Status:</span>
                    <span class="instance-status-message">${getInstanceStatusText(inst)}</span>
                </div>
                <div class="instance-actions">
                    ${inst.running 
                        ? `<button class="btn-action btn-stop" onclick="stopInstance('${inst.id}')">Stop</button>
                           <button class="btn-action btn-restart" onclick="restartInstance('${inst.id}')">Restart</button>`
                        : `<button class="btn-action btn-start" onclick="startInstance('${inst.id}')">Start</button>`
                    }
                </div>
            </div>
        `).join('');
    }

    function openPlaceholderModal(instanceId, placeholders, templateName) {
        pendingInstanceCreation = {
            instanceId,
            placeholders
        };

        placeholderModalSubtitle.textContent = `Template: ${templateName}`;
        placeholderFields.innerHTML = '';
        placeholders.forEach((placeholder) => {
            const label = document.createElement('label');
            label.className = 'placeholder-field';
            label.htmlFor = `placeholder-${placeholder}`;

            const text = document.createElement('span');
            text.textContent = placeholder;

            const input = document.createElement('input');
            input.type = 'text';
            input.id = `placeholder-${placeholder}`;
            input.dataset.placeholderName = placeholder;

            label.appendChild(text);
            label.appendChild(input);
            placeholderFields.appendChild(label);
        });

        placeholderModal.hidden = false;
        const firstInput = placeholderFields.querySelector('input');
        if (firstInput) {
            firstInput.focus();
        }
    }

    function closePlaceholderModal() {
        pendingInstanceCreation = null;
        placeholderFields.innerHTML = '';
        placeholderModalSubtitle.textContent = '';
        placeholderModal.hidden = true;
    }

    function closeInstanceMenu() {
        if (activeMenuInstanceId !== null) {
            activeMenuInstanceId = null;
            renderInstances();
        }
    }

    function toggleInstanceMenu(id) {
        activeMenuInstanceId = activeMenuInstanceId === id ? null : id;
        renderInstances();
    }

    async function toggleAutoStart(id) {
        try {
            const response = await fetch(`/api/instances/${id}/autostart/toggle`, { method: 'POST' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            activeMenuInstanceId = null;
            await loadInstances();
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    }

    async function deleteInstance(id) {
        const confirmed = window.confirm('Are you sure you want to delete this instance?');
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/instances/${id}`, { method: 'DELETE' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            if (selectedInstance === id) {
                selectedInstance = null;
            }
            activeMenuInstanceId = null;
            await loadInstances();
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    }

    async function loadInstanceStatus(id) {
        try {
            const response = await fetch(`/api/instances/${id}/status`);
            const status = await response.json();
            term.write(`\r\n📊 Status for ${id}:\r\n`);
            term.write(`   Running: ${status.running ? 'YES ✓' : 'NO ✗'}\r\n`);
            term.write(`   AutoStart: ${status.autoStart ? 'YES' : 'NO'}\r\n`);
            term.write(`   PID: ${status.pid !== -1 ? status.pid : 'N/A'}\r\n`);
            term.write(`   Message: ${status.statusMessage || 'No status message yet'}\r\n`);
        } catch (error) {
            term.write(`\r\n✗ Failed to load status: ${error.message}\r\n`);
        }
    }

    window.startInstance = async function(id) {
        try {
            const response = await fetch(`/api/instances/${id}/start`, { method: 'POST' });
            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            await loadInstances();
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    };

    window.stopInstance = async function(id) {
        try {
            const response = await fetch(`/api/instances/${id}/stop`, { method: 'POST' });
            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            await loadInstances();
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    };

    window.restartInstance = async function(id) {
        try {
            const response = await fetch(`/api/instances/${id}/restart`, { method: 'POST' });
            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            await loadInstances();
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    };

    function toggleCreateForm() {
        const isHidden = createSection.hasAttribute('hidden');
        if (isHidden) {
            createSection.removeAttribute('hidden');
            createToggleBtn.setAttribute('aria-expanded', 'true');
            createToggleBtn.classList.add('is-active');
            createToggleBtn.title = 'Hide create form';
            document.getElementById('newInstanceId').focus();
            return;
        }

        createSection.setAttribute('hidden', '');
        createToggleBtn.setAttribute('aria-expanded', 'false');
        createToggleBtn.classList.remove('is-active');
        createToggleBtn.title = 'Create new instance';
    }

    async function createInstance(event) {
        if (event) {
            event.preventDefault();
        }

        const idInput = document.getElementById('newInstanceId');
        const databaseNameInput = document.getElementById('newInstanceDatabaseName');
        const autoStartCheckbox = document.getElementById('newInstanceAutoStart');
        const templateName = startTemplateSelect.value;
        
        const id = idInput.value.trim();
        
        if (!id) {
            term.write('✗ Instance ID cannot be empty\r\n');
            return;
        }

        if (!templateName) {
            term.write('✗ Please select a start template\r\n');
            return;
        }
        
        try {
            const response = await fetch('/api/instances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    autoStart: autoStartCheckbox.checked,
                    templateName: templateName,
                    databaseName: databaseNameInput.value
                })
            });

            if (response.status === 409) {
                term.write(`✗ Instance ${id} already exists\r\n`);
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);

            if (data.placeholders && data.placeholders.length) {
                openPlaceholderModal(id, data.placeholders, templateName);
            } else {
                idInput.value = '';
                databaseNameInput.value = '';
                autoStartCheckbox.checked = false;
                await loadInstances();
            }
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    }

    function executeCommand(cmd) {
        if (!cmd.trim()) return;
        
        term.write('$ ' + cmd + '\r\n');
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('START:' + cmd);
        } else {
            term.write('✗ Terminal not connected\r\n');
        }
    }

    async function submitPlaceholderValues(event) {
        event.preventDefault();

        if (!pendingInstanceCreation) {
            closePlaceholderModal();
            return;
        }

        const values = {};
        placeholderFields.querySelectorAll('input[data-placeholder-name]').forEach((input) => {
            values[input.dataset.placeholderName] = input.value;
        });

        try {
            const response = await fetch(`/api/instances/${pendingInstanceCreation.instanceId}/placeholders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            document.getElementById('newInstanceId').value = '';
            document.getElementById('newInstanceDatabaseName').value = '';
            document.getElementById('newInstanceAutoStart').checked = false;
            closePlaceholderModal();
            await loadInstances();
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    }

    // Event listeners
    document.getElementById('commandInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const cmd = document.getElementById('commandInput').value;
            document.getElementById('commandInput').value = '';
            executeCommand(cmd);
        }
    });

    document.getElementById('sendBtn').addEventListener('click', () => {
        const cmd = document.getElementById('commandInput').value;
        document.getElementById('commandInput').value = '';
        executeCommand(cmd);
    });

    document.getElementById('createInstanceForm').addEventListener('submit', createInstance);
    document.getElementById('createToggleBtn').addEventListener('click', toggleCreateForm);
    document.getElementById('placeholderForm').addEventListener('submit', submitPlaceholderValues);
    document.getElementById('cancelPlaceholderBtn').addEventListener('click', closePlaceholderModal);

    document.getElementById('refreshBtn').addEventListener('click', loadInstances);

    instancesList.addEventListener('click', (e) => {
        const menuButton = e.target.closest('.instance-menu-btn');
        if (menuButton) {
            e.stopPropagation();
            toggleInstanceMenu(menuButton.dataset.id);
            return;
        }

        const menuAction = e.target.closest('.instance-menu-action');
        if (menuAction) {
            e.stopPropagation();
            const { action, id } = menuAction.dataset;
            if (action === 'toggle-autostart') {
                toggleAutoStart(id);
            } else if (action === 'delete') {
                deleteInstance(id);
            }
            return;
        }

        const item = e.target.closest('.instance-item');
        if (item) {
            selectedInstance = item.dataset.id;
            loadInstanceStatus(item.dataset.id);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.instance-menu-wrapper')) {
            closeInstanceMenu();
        }
    });

     document.getElementById('clearTerminal').addEventListener('click', () => {
        term.clear();
    });

    // Initial setup
    initWebSocket();
    loadStartTemplates();
    loadInstances();

    // Refresh instances list periodically
    setInterval(loadInstances, 30000);
}

document.addEventListener('DOMContentLoaded', initApp);
