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
    const instanceDetails = document.getElementById('instanceDetails');
    const workspace = document.querySelector('.workspace');
    const terminalPanel = document.getElementById('terminalPanel');
    const terminalControlsToggle = document.getElementById('toggleTerminalControls');
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

    function sortInstances(list) {
        return [...list].sort((a, b) => {
            const runningDiff = Number(!!b.running) - Number(!!a.running);
            if (runningDiff !== 0) {
                return runningDiff;
            }

            return String(a.id).localeCompare(String(b.id));
        });
    }

    function getSelectedInstance() {
        return instances.find((inst) => inst.id === selectedInstance) || null;
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

    function getInstanceStateLabel(inst) {
        return inst.running ? 'Running' : 'Stopped';
    }

    function toggleTerminalControls() {
        const collapsed = terminalPanel.classList.toggle('is-collapsed');
        workspace.classList.toggle('is-terminal-collapsed', collapsed);
        terminalControlsToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        terminalControlsToggle.textContent = collapsed ? '⌃' : '⌄';
        terminalControlsToggle.title = collapsed ? 'Show terminal' : 'Hide terminal';
        terminalControlsToggle.setAttribute('aria-label', collapsed ? 'Show terminal' : 'Hide terminal');
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
            
            instances = sortInstances(await response.json());
            console.log('Loaded instances:', instances);

            if (!selectedInstance || !instances.some((inst) => inst.id === selectedInstance)) {
                const preferredInstance = instances.find((inst) => inst.running) || instances[0] || null;
                selectedInstance = preferredInstance ? preferredInstance.id : null;
            }

            renderInstances();
            renderInstanceDetails();
            await refreshInstanceStatuses();
        } catch (error) {
            console.error('Failed to load instances:', error);
            term.write('✗ Failed to load instances: ' + error.message + '\r\n');
            const list = document.getElementById('instancesList');
            list.innerHTML = '<div class="loading">Error loading instances</div>';
        }
    }

    async function refreshInstanceStatuses() {
        if (!instances.length) {
            renderInstanceDetails();
            return;
        }

        const updates = await Promise.all(instances.map(async (inst) => {
            try {
                const response = await fetch(`/api/instances/${encodeURIComponent(inst.id)}/status`);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const status = await response.json();
                return {
                    id: inst.id,
                    running: status.running,
                    pid: status.pid,
                    statusMessage: status.statusMessage,
                    properties: status.properties
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
        instances = sortInstances(instances.map((inst) => ({
            ...inst,
            ...(updatesById.get(inst.id) || {})
        })));
        renderInstances();
        renderInstanceDetails();
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

    function renderInstanceDetails() {
        const inst = getSelectedInstance();

        if (!inst) {
            instanceDetails.innerHTML = '<div class="loading">Select an instance to see details</div>';
            return;
        }

        const statusLabel = getInstanceStateLabel(inst);
        const statusClass = inst.running ? 'status-running' : 'status-stopped';
        const pidText = inst.pid && inst.pid !== -1 ? inst.pid : '-';
        const statusText = getInstanceStatusText(inst);
        const propertiesText = inst.properties ? inst.properties : 'Properties file not found';
        const propertiesClass = inst.properties ? '' : 'detail-value-error';

        instanceDetails.innerHTML = `
            <div class="detail-card">
                <div class="detail-header">
                    <div class="detail-title">${inst.id}</div>
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">PID</span>
                        <span class="detail-value">${pidText}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Auto-start</span>
                        <span class="detail-value">${inst.autoStart ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Database</span>
                        <span class="detail-value">${inst.databaseName ? inst.databaseName : '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Properties</span>
                        <span class="detail-value ${propertiesClass}">${propertiesText}</span>
                    </div>
                    <div class="detail-item detail-item-wide">
                        <span class="detail-label">Latest status</span>
                        <span class="detail-value">${statusText}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function openPlaceholderModal(instanceId, placeholders, templateName, defaultValues = {}, creationData = {}) {
        pendingInstanceCreation = {
            instanceId,
            placeholders,
            creationData
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
            if (Object.prototype.hasOwnProperty.call(defaultValues, placeholder)) {
                input.value = defaultValues[placeholder];
            }

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
            const response = await fetch(`/api/instances/${encodeURIComponent(id)}/autostart/toggle`, { method: 'POST' });

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
            const response = await fetch(`/api/instances/${encodeURIComponent(id)}`, { method: 'DELETE' });

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
            const response = await fetch(`/api/instances/${encodeURIComponent(id)}/status`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const status = await response.json();

            instances = sortInstances(instances.map((inst) => inst.id === id ? {
                ...inst,
                running: status.running,
                pid: status.pid,
                statusMessage: status.statusMessage,
                autoStart: status.autoStart,
                properties: status.properties
            } : inst));
            renderInstances();
            renderInstanceDetails();
        } catch (error) {
            term.write(`\r\n✗ Failed to load status: ${error.message}\r\n`);
        }
    }

    window.startInstance = async function(id) {
        try {
            const response = await fetch(`/api/instances/${encodeURIComponent(id)}/start`, { method: 'POST' });
            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            await loadInstances();
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    };

    window.stopInstance = async function(id) {
        try {
            const response = await fetch(`/api/instances/${encodeURIComponent(id)}/stop`, { method: 'POST' });
            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            await loadInstances();
        } catch (error) {
            term.write(`✗ Error: ${error.message}\r\n`);
        }
    };

    window.restartInstance = async function(id) {
        try {
            const response = await fetch(`/api/instances/${encodeURIComponent(id)}/restart`, { method: 'POST' });
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
            document.getElementById('newInstanceServer').focus();
            return;
        }

        createSection.setAttribute('hidden', '');
        createToggleBtn.setAttribute('aria-expanded', 'false');
        createToggleBtn.classList.remove('is-active');
        createToggleBtn.title = 'Create new instance';
    }

    function updateDatabaseNameField() {
        const checkbox = document.getElementById('newInstanceUseDatabaseCheckbox');
        const wrapper = document.getElementById('newInstanceDatabaseNameWrapper');
        const input = document.getElementById('newInstanceDatabaseName');
        const server = document.getElementById('newInstanceServer').value.trim();
        const login = document.getElementById('newInstanceLogin').value.trim();

        if (checkbox.checked) {
            wrapper.style.display = 'block';
            if (!input.value && server && login) {
                input.value = `${server}#${login}`;
            }
            input.focus();
        } else {
            wrapper.style.display = 'none';
            input.value = '';
        }
    }

    async function createInstance(event) {
        if (event) {
            event.preventDefault();
        }

        const serverInput = document.getElementById('newInstanceServer');
        const loginInput = document.getElementById('newInstanceLogin');
        const databaseCheckbox = document.getElementById('newInstanceUseDatabaseCheckbox');
        const databaseNameInput = document.getElementById('newInstanceDatabaseName');
        const templateName = startTemplateSelect.value;

        const server = serverInput.value.trim();
        const login = loginInput.value.trim();

        if (!server) {
            term.write('✗ Server cannot be empty\r\n');
            return;
        }

        if (!login) {
            term.write('✗ Login cannot be empty\r\n');
            return;
        }

        if (!templateName) {
            term.write('✗ Please select a start template\r\n');
            return;
        }

        const databaseName = databaseCheckbox.checked ? databaseNameInput.value.trim() : null;

        try {
            const response = await fetch('/api/instances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: server,
                    login: login,
                    templateName: templateName,
                    databaseName: databaseName
                })
            });

            if (response.status === 409) {
                term.write(`✗ Instance ${server}#${login} already exists\r\n`);
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);

            if (data.placeholders && data.placeholders.length) {
                openPlaceholderModal(data.id, data.placeholders, templateName, {
                    login: login,
                    server_name: server
                }, {
                    server: server,
                    login: login,
                    templateName: templateName,
                    databaseName: databaseName
                });
            } else {
                serverInput.value = '';
                loginInput.value = '';
                databaseCheckbox.checked = false;
                updateDatabaseNameField();
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
            const response = await fetch(`/api/instances/${encodeURIComponent(pendingInstanceCreation.instanceId)}/placeholders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...pendingInstanceCreation.creationData,
                    placeholders: values
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            document.getElementById('newInstanceServer').value = '';
            document.getElementById('newInstanceLogin').value = '';
            document.getElementById('newInstanceUseDatabaseCheckbox').checked = false;
            document.getElementById('newInstanceDatabaseName').value = '';
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
    const dbCheckbox = document.getElementById('newInstanceUseDatabaseCheckbox');
    if (dbCheckbox) {
        dbCheckbox.addEventListener('change', updateDatabaseNameField);
    }
    const serverInput = document.getElementById('newInstanceServer');
    if (serverInput) {
        serverInput.addEventListener('input', updateDatabaseNameField);
    }
    const loginInput = document.getElementById('newInstanceLogin');
    if (loginInput) {
        loginInput.addEventListener('input', updateDatabaseNameField);
    }
    document.getElementById('placeholderForm').addEventListener('submit', submitPlaceholderValues);
    document.getElementById('cancelPlaceholderBtn').addEventListener('click', closePlaceholderModal);

    document.getElementById('refreshBtn').addEventListener('click', loadInstances);
    terminalControlsToggle.addEventListener('click', toggleTerminalControls);

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
            renderInstances();
            renderInstanceDetails();
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
