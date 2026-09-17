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
    let selectedInstance = null;

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
        } catch (error) {
            console.error('Failed to load instances:', error);
            term.write('✗ Failed to load instances: ' + error.message + '\r\n');
            const list = document.getElementById('instancesList');
            list.innerHTML = '<div class="loading">Error loading instances</div>';
        }
    }

    function renderInstances() {
        const list = document.getElementById('instancesList');
        
        if (instances.length === 0) {
            list.innerHTML = '<div class="loading">No instances</div>';
            return;
        }
        
        list.innerHTML = instances.map(inst => `
            <div class="instance-item ${selectedInstance === inst.id ? 'selected' : ''}" data-id="${inst.id}">
                <div class="instance-name">${inst.id}</div>
                <div class="instance-status">
                    <span class="status-badge ${inst.running ? 'status-running' : 'status-stopped'}">
                        ${inst.running ? '● RUNNING' : '○ STOPPED'}
                    </span>
                    <span>AutoStart: ${inst.autoStart ? 'yes' : 'no'}</span>
                    ${inst.pid && inst.pid !== -1 ? '<span>PID: ' + inst.pid + '</span>' : '<span>PID: -</span>'}
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
        
        document.querySelectorAll('.instance-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-action')) {
                    selectedInstance = el.dataset.id;
                    loadInstanceStatus(el.dataset.id);
                }
            });
        });
    }

    async function loadInstanceStatus(id) {
        try {
            const response = await fetch(`/api/instances/${id}/status`);
            const status = await response.json();
            term.write(`\r\n📊 Status for ${id}:\r\n`);
            term.write(`   Running: ${status.running ? 'YES ✓' : 'NO ✗'}\r\n`);
            term.write(`   AutoStart: ${status.autoStart ? 'YES' : 'NO'}\r\n`);
            term.write(`   PID: ${status.pid !== -1 ? status.pid : 'N/A'}\r\n`);
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

    async function createInstance() {
        const idInput = document.getElementById('newInstanceId');
        const autoStartCheckbox = document.getElementById('newInstanceAutoStart');
        
        const id = idInput.value.trim();
        
        if (!id) {
            term.write('✗ Instance ID cannot be empty\r\n');
            return;
        }
        
        try {
            const response = await fetch('/api/instances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    autoStart: autoStartCheckbox.checked
                })
            });
            
            const data = await response.json();
            term.write(`✓ ${data.message}\r\n`);
            idInput.value = '';
            autoStartCheckbox.checked = false;
            await loadInstances();
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

    document.getElementById('createBtn').addEventListener('click', createInstance);

    document.getElementById('refreshBtn').addEventListener('click', loadInstances);

     document.getElementById('clearTerminal').addEventListener('click', () => {
        term.clear();
    });

    // Initial setup
    initWebSocket();
    loadInstances();

    // Refresh instances list periodically
    setInterval(loadInstances, 5000);
}

document.addEventListener('DOMContentLoaded', initApp);
