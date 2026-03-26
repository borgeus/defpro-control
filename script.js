// ══════════════════════════════════════════════════════
//  DEFPro Control | Missões Empresariais - v2.2 (Online Firestore)
// ══════════════════════════════════════════════════════

// ── FIREBASE & CONFIG ─────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCV_ITw2dsPzzh8I17FIR_-xzfSVOAHUjM",
    authDomain: "defprocontrol.firebaseapp.com",
    projectId: "defprocontrol",
    storageBucket: "defprocontrol.firebasestorage.app",
    messagingSenderId: "209778569024",
    appId: "1:209778569024:web:4d01084c11ca6db13154a5",
    measurementId: "G-24ZMWVMZKY"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── STATE ─────────────────────────────────────────────
let users = [];
let tasks = [];
let currentUser = JSON.parse(localStorage.getItem('th_session')) || null; // Mantém sessão local
let selectedAssignees = [];

// ── PERSISTENCE (FIRESTORE) ───────────────────────────
function saveSession() {
    localStorage.setItem('th_session', JSON.stringify(currentUser));
}

// ── FORMATA NÚMERO WHATSAPP ────────────────────────────
function formatPhone(raw) {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (!digits.startsWith('55')) digits = '55' + digits;
    return digits;
}

// ── TOAST NOTIFICATION ────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = message;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(40px)';
        el.style.transition = 'all 0.4s ease';
        setTimeout(() => el.remove(), 400);
    }, duration);
}

// ── SCREEN CONTROL ────────────────────────────────────
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = id === 'login' ? 'login-screen' : `${id}-dashboard`;
    document.getElementById(target).classList.remove('hidden');
}

function showDashboard(type) {
    if (type === 'ranking') {
        showScreen('ranking');
        renderRankingDashboard();
    }
}

function returnToDashboard() {
    showScreen(currentUser.role === 'admin' ? 'admin' : 'user');
    renderDashboard();
}

function logout() {
    currentUser = null;
    save();
    location.reload();
}

// ── AVATAR HELPER ─────────────────────────────────────
function avatarHTML(user, size = 'normal') {
    const cls = size === 'big' ? 'user-avatar-big' : 'avatar-placeholder';
    if (user?.photo) {
        return `<div class="${cls}"><img src="${user.photo}" alt="${user.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
    }
    const initials = (user?.name || '?').charAt(0).toUpperCase();
    return `<div class="${cls}" style="font-size:${size==='big'?'1.8rem':'1rem'}">${initials}</div>`;
}

// ── PHOTO PREVIEW ────────────────────────────────────
function previewPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        toast('⚠️ Foto muito grande! Máximo 2MB.', 'error');
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('photo-preview-img');
        const placeholder = document.getElementById('photo-placeholder');
        if (img) {
            img.src = e.target.result;
            img.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}


// ── MULTI-SELECT LOGIC ────────────────────────────────
function toggleMultiSelect() {
    const dropdown = document.getElementById('multi-select-dropdown');
    const trigger  = document.getElementById('multi-select-trigger');
    const arrow    = trigger.querySelector('.multi-arrow');
    const isOpen   = !dropdown.classList.contains('hidden');

    if (isOpen) {
        dropdown.classList.add('hidden');
        trigger.classList.remove('open');
        arrow.classList.remove('rotated');
    } else {
        renderMultiSelectOptions();
        dropdown.classList.remove('hidden');
        trigger.classList.add('open');
        arrow.classList.add('rotated');
    }
}

function renderMultiSelectOptions() {
    const employees = users.filter(u => u.role !== 'admin');
    const dropdown  = document.getElementById('multi-select-dropdown');

    if (!employees.length) {
        dropdown.innerHTML = `<div style="padding:12px; color:var(--text-muted); font-size:0.88rem; text-align:center">Nenhum funcionário cadastrado.</div>`;
        return;
    }

    dropdown.innerHTML = employees.map(u => {
        const checked = selectedAssignees.includes(u.id);
        const avatar  = u.photo
            ? `<img src="${u.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0">`
            : `<div class="avatar-placeholder" style="width:32px;height:32px;font-size:0.85rem">${u.name.charAt(0).toUpperCase()}</div>`;
        return `
        <div class="ms-option ${checked ? 'checked' : ''}" onclick="toggleAssignee('${u.id}')">
            <div class="ms-checkbox">${checked ? '✓' : ''}</div>
            ${avatar}
            <div>
                <div class="ms-name">${u.name}</div>
                <div class="ms-cargo">${u.cargo || 'Funcionário'}</div>
            </div>
        </div>`;
    }).join('');
}

function toggleAssignee(userId) {
    const idx = selectedAssignees.indexOf(userId);
    if (idx === -1) selectedAssignees.push(userId);
    else selectedAssignees.splice(idx, 1);
    renderMultiSelectOptions();
    updateSelectedChips();
}

function updateSelectedChips() {
    const chipsContainer = document.getElementById('selected-chips');
    const label          = document.getElementById('multi-select-label');

    if (!selectedAssignees.length) {
        label.textContent = '👤 Selecionar funcionários...';
        chipsContainer.innerHTML = '';
        return;
    }

    label.textContent = `${selectedAssignees.length} funcionário(s) selecionado(s)`;
    chipsContainer.innerHTML = selectedAssignees.map(id => {
        const u = users.find(u => u.id === id);
        return u ? `<span class="chip">${u.name} <button type="button" onclick="toggleAssignee('${id}')">✕</button></span>` : '';
    }).join('');
}

// Fecha dropdown ao clicar fora
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('assignee-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById('multi-select-dropdown')?.classList.add('hidden');
        document.getElementById('multi-select-trigger')?.classList.remove('open');
        document.getElementById('multi-select-trigger')?.querySelector('.multi-arrow')?.classList.remove('rotated');
    }
});

// ── INIT & LISTENERS ──────────────────────────────────
let dbLoaded = false;
document.addEventListener('DOMContentLoaded', async () => {
    toast('📡 Conectando ao banco online...', 'info', 2000);

    // Escutar Usuários
    onSnapshot(collection(db, "users"), (snapshot) => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoaded = true;
        
        // Bootstrap: Se não houver ninguém, cria o admin inicial
        if (users.length === 0) {
            console.log("Criando admin inicial...");
            addDoc(collection(db, "users"), { 
                name: 'admin', pass: 'admin123', phone: '', role: 'admin', points: 0, cargo: 'Administrador', photo: '' 
            });
        }
        
        if (currentUser) {
            const fresh = users.find(u => u.id === currentUser.id || u.name === currentUser.name);
            if (fresh) {
                currentUser = fresh;
                saveSession();
            }
            renderDashboard();
        } else {
            showScreen('login');
        }
    }, (error) => {
        console.error("Erro no Firestore:", error);
        toast('❌ Erro de permissão no Firebase. Verifique as Regras do Firestore.', 'error', 10000);
    });

    // Escutar Tarefas
    onSnapshot(collection(db, "tasks"), (snapshot) => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentUser) renderDashboard();
    });

    initForms();
});

function initForms() {
    // LOGIN
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        if (!dbLoaded) {
            toast('⏳ Aguarde o carregamento do banco de dados...', 'info');
            return;
        }

        const nameInput = document.getElementById('username').value.trim().toLowerCase();
        const passInput = document.getElementById('password').value;
        const found = users.find(u => u.name.toLowerCase() === nameInput && u.pass === passInput);
        
        if (found) {
            currentUser = found;
            saveSession();
            showScreen(found.role === 'admin' ? 'admin' : 'user');
            renderDashboard();
            toast(`Bem-vindo, <b>${found.name}</b>! 🎉`, 'success');
        } else {
            console.log("Tentativa de login falhou para:", nameInput);
            document.getElementById('login-error').classList.remove('hidden');
            document.getElementById('password').value = '';
        }
    };

    // ADD USER
    document.getElementById('add-user-form').onsubmit = (e) => {
        e.preventDefault();
        const name  = document.getElementById('new-user-name').value.trim();
        const cargo = document.getElementById('new-user-cargo').value.trim();
        const pass  = document.getElementById('new-user-pass').value;
        const phone = document.getElementById('new-user-phone').value;
        const photoInput = document.getElementById('new-user-photo');
        const photoFile  = photoInput?.files[0];

        if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
            toast('⚠️ Já existe um usuário com esse nome!', 'error'); return;
        }

        const saveToDb = async (photoBase64 = '') => {
            try {
                await addDoc(collection(db, "users"), { 
                    name, cargo, pass, phone, role: 'user', points: 0, photo: photoBase64 
                });
                e.target.reset();
                const img = document.getElementById('photo-preview-img');
                const ph  = document.getElementById('photo-placeholder');
                if (img) { img.src = ''; img.style.display = 'none'; }
                if (ph)  { ph.style.display = 'block'; }
                toast(`✅ Funcionário <b>${name}</b> adicionado!`, 'success');
            } catch (err) {
                toast('❌ Erro ao salvar no banco online.', 'error');
            }
        };

        if (photoFile) {
            const reader = new FileReader();
            reader.onload = (ev) => saveToDb(ev.target.result);
            reader.readAsDataURL(photoFile);
        } else {
            saveToDb('');
        }
    };

    // EDIT USER
    document.getElementById('edit-user-form').onsubmit = (e) => saveUserEdit(e);

    // ADD TASK
    document.getElementById('add-task-form').onsubmit = async (e) => {
        e.preventDefault();
        if (!selectedAssignees.length) {
            toast('⚠️ Selecione pelo menos um funcionário!', 'error'); return;
        }

        const title   = document.getElementById('task-title').value.trim();
        const desc    = document.getElementById('task-desc').value.trim();
        const points  = parseInt(document.getElementById('task-points').value) || 50;
        const dueDate = document.getElementById('task-deadline').value;

        try {
            for (const assigneeId of selectedAssignees) {
                const assignee = users.find(u => u.id === assigneeId);
                const taskData = {
                    title, desc, assigneeId, points, dueDate,
                    status: 'pending',
                    createdAt: Date.now(),
                    employeeNote: ''
                };
                await addDoc(collection(db, "tasks"), taskData);
                if (assignee) notifyByWhatsApp(taskData, assignee);
            }

            e.target.reset();
            selectedAssignees = [];
            updateSelectedChips();
            toast(`✅ Missão enviada para ${selectedAssignees.length} funcionário(s)!`, 'success');
        } catch (err) {
            toast('❌ Erro ao enviar missões.', 'error');
        }
    };
}

// ── ADMIN SETTINGS ────────────────────────────────────
function toggleAdminSettings() {
    const panel = document.getElementById('admin-settings-panel');
    if (panel) panel.classList.toggle('hidden');
}

async function saveAdminWhatsapp() {
    const phone = document.getElementById('admin-whatsapp').value;
    const admin = users.find(u => u.role === 'admin');
    if (admin) {
        await updateDoc(doc(db, "users", admin.id), { phone });
        toast('✅ Número salvo!', 'success');
    }
}


function formatDateTime(iso) {
    if (!iso) return "Sem prazo";
    const date = new Date(iso);
    return date.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── USER MANAGEMENT ───────────────────────────────────
async function deleteUser(userId) {
    if (userId === currentUser.id) {
        toast('⚠️ Você não pode excluir a si mesmo!', 'error'); return;
    }
    if (!confirm('Deseja realmente excluir este usuário?')) return;
    try {
        await deleteDoc(doc(db, "users", userId));
        toast('🗑️ Usuário removido!');
    } catch (err) { toast('❌ Erro ao excluir online.', 'error'); }
}

function openEditUser(userId) {
    const u = users.find(u => u.id === userId);
    if (!u) return;

    document.getElementById('edit-user-id').value    = u.id;
    document.getElementById('edit-user-name').value  = u.name;
    document.getElementById('edit-user-cargo').value = u.cargo;
    document.getElementById('edit-user-pass').value  = u.pass;
    document.getElementById('edit-user-phone').value = u.phone;
    document.getElementById('edit-user-role').value  = u.role;

    const img = document.getElementById('edit-photo-img');
    const ph  = document.getElementById('edit-photo-placeholder');
    if (u.photo) {
        img.src = u.photo; img.style.display = 'block'; ph.style.display = 'none';
    } else {
        img.style.display = 'none'; ph.style.display = 'block';
    }

    document.getElementById('edit-user-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-user-modal').classList.add('hidden');
}

function previewEditPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('edit-photo-img');
        const ph  = document.getElementById('edit-photo-placeholder');
        img.src = e.target.result;
        img.style.display = 'block';
        ph.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

async function saveUserEdit(e) {
    e.preventDefault();
    const id    = document.getElementById('edit-user-id').value;
    const name  = document.getElementById('edit-user-name').value.trim();
    const cargo = document.getElementById('edit-user-cargo').value.trim();
    const pass  = document.getElementById('edit-user-pass').value;
    const phone = document.getElementById('edit-user-phone').value;
    const role  = document.getElementById('edit-user-role').value;
    const photoInput = document.getElementById('edit-user-photo');
    const photoFile  = photoInput?.files[0];

    const finalizeEdit = async (photoBase64) => {
        const updateData = { name, cargo, pass, phone, role };
        if (photoBase64 !== undefined) updateData.photo = photoBase64;
        
        try {
            await updateDoc(doc(db, "users", id), updateData);
            closeEditModal();
            toast('✅ Dados atualizados!', 'success');
        } catch (err) { toast('❌ Erro ao atualizar online.', 'error'); }
    };

    if (photoFile) {
        const reader = new FileReader();
        reader.onload = (ev) => finalizeEdit(ev.target.result);
        reader.readAsDataURL(photoFile);
    } else {
        finalizeEdit();
    }
}

// ── DASHBOARD RENDERING ───────────────────────────────
function renderDashboard() {
    if (currentUser.role === 'admin') renderAdminUI();
    else renderUserUI();
}

function renderAdminUI() {
    const greet = document.getElementById('admin-greeting');
    if (greet) greet.textContent = `Olá, ${currentUser.name}`;

    // ── Lista da equipe (Sidebar)
    const list = document.getElementById('users-list');
    if (list) {
        list.innerHTML = users.length
            ? users.map(u => `
                <li class="glass-item" style="display:flex; align-items:center; padding:12px; margin-bottom:10px; border-radius:12px; background:rgba(255,255,255,0.03)">
                    ${avatarHTML(u)}
                    <div class="member-info" style="flex:1; margin-left:12px">
                        <div style="display:flex; align-items:center; gap:6px">
                            <span class="member-name" style="font-weight:600">${u.name}</span>
                            <span class="role-tag ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role === 'admin' ? 'Admin' : 'Equipe'}</span>
                        </div>
                        <span class="member-xp" style="font-size:0.8rem; color:var(--text-muted)">
                            <span class="cargo-tag">${u.cargo || 'Funcionário'}</span>
                            &nbsp;• ${u.points || 0} XP
                        </span>
                    </div>
                    <div class="member-actions">
                        <button class="btn-edit" onclick="openEditUser('${u.id}')" title="Editar">✏️</button>
                        ${u.id !== currentUser.id ? `<button class="btn-danger" onclick="deleteUser('${u.id}')" title="Excluir">✖</button>` : ''}
                    </div>
                </li>`).join('')
            : '<li style="color:var(--text-muted); font-size:0.88rem; padding:12px 0">Nenhum usuário cadastrado.</li>';
    }

    // ── Leaderboard (No Monitor/Ranking)
    const leaderList = document.getElementById('leaderboard-list');
    if (leaderList) {
        const employees = users.filter(u => u.role !== 'admin').sort((a, b) => (b.points || 0) - (a.points || 0));
        const medals = ['🥇','🥈','🥉'];
        leaderList.innerHTML = employees.length
            ? employees.map((u, i) => `
                <li class="leaderboard-item">
                    <span class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i] || i+1}</span>
                    ${avatarHTML(u)}
                    <div style="flex:1">
                        <div class="lb-name" style="font-weight:600">${u.name}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted)">${u.cargo || 'Funcionário'}</div>
                    </div>
                    <span class="lb-xp" style="font-weight:700; color:var(--secondary)">${u.points || 0} XP</span>
                </li>`).join('')
            : '<li style="color:var(--text-muted); font-size:0.88rem; padding:8px 0">Ainda sem pontuação no ranking.</li>';
    }

    // ── Monitor de tarefas
    const countEl = document.getElementById('admin-task-count');
    if (countEl) countEl.textContent = `${tasks.length} tarefa${tasks.length !== 1 ? 's' : ''}`;
    
    const taskList = document.getElementById('admin-tasks-list');
    if (taskList) {
        taskList.innerHTML = tasks.length
            ? [...tasks].reverse().map(t => {
                const worker = users.find(u => u.id === t.assigneeId);
                const done   = t.status === 'completed';
                return `
                <div class="task-card glass ${done ? 'completed' : ''}">
                    <div class="task-card-header">
                        <h4 style="margin-right:12px">${t.title}</h4>
                        <div class="task-status-dot ${done ? 'done' : ''}" title="${done ? 'Concluída' : 'Pendente'}"></div>
                    </div>
                    <p class="desc">${t.desc}</p>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px">
                        📅 Prazo: <b style="color:var(--secondary)">${formatDateTime(t.dueDate)}</b>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                        ${worker ? avatarHTML(worker) : ''}
                        <div>
                            <div class="assignee-chip">${worker ? worker.name : '<i>Removido</i>'}</div>
                            ${worker?.cargo ? `<div style="font-size:0.74rem;color:var(--text-muted)">${worker.cargo}</div>` : ''}
                        </div>
                    </div>
                    <div class="task-card-footer">
                        <span class="xp-pill">✅ ${t.points} XP</span>
                        <span class="${done ? 'status-text-done' : 'status-text-pending'}">${done ? '✔ CONCLUÍDA' : '⏳ PENDENTE'}</span>
                        <button class="btn-danger" style="margin-left:auto" onclick="deleteTask('${t.id}')">✖</button>
                    </div>
                    ${t.employeeNote ? `
                    <div class="admin-note-display">
                        <span class="notes-label">Anotação do Funcionário:</span>
                        <p class="admin-note-text">"${t.employeeNote}"</p>
                    </div>` : ''}
                </div>`;
              }).join('')
            : `<div class="empty-state"><div>📋</div><p>Nenhuma missão criada ainda.<br>Crie a primeira acima!</p></div>`;
    }
}

function renderUserUI() {
    const fresh = users.find(u => u.id === currentUser.id);
    if (fresh) currentUser = fresh;

    const myTasks   = tasks.filter(t => t.assigneeId === currentUser.id);
    const completed = myTasks.filter(t => t.status === 'completed');
    const pending   = myTasks.filter(t => t.status === 'pending');
    const pct       = myTasks.length ? Math.round((completed.length / myTasks.length) * 100) : 0;

    // Avatar grande (Cabeçalho User)
    const avatarEl = document.getElementById('user-avatar-big');
    if (avatarEl) {
        avatarEl.innerHTML = avatarHTML(currentUser, 'big');
    }

    document.getElementById('user-display-name').textContent  = currentUser.name;
    document.getElementById('user-points-header').textContent = currentUser.points || 0;
    
    const xpBig = document.getElementById('user-xp-big');
    if (xpBig) xpBig.innerHTML = `${currentUser.points || 0} <span>XP</span>`;
    
    document.getElementById('user-task-summary').textContent  = `${pending.length} missão(ões) pendente(s) — bora conquistar esse XP! 💪`;
    
    const pctText = document.getElementById('progress-pct');
    if (pctText) pctText.textContent = `${pct}%`;
    
    const fill = document.getElementById('prog-fill');
    if (fill) fill.style.width = `${pct}%`;
    
    const doneStat = document.getElementById('stat-done');
    if (doneStat) doneStat.textContent = completed.length;
    const pendingStat = document.getElementById('stat-pending');
    if (pendingStat) pendingStat.textContent = pending.length;
    const totalStat = document.getElementById('stat-total');
    if (totalStat) totalStat.textContent = myTasks.length;

    const cargoBadge = document.getElementById('user-cargo-badge');
    if (cargoBadge) cargoBadge.textContent = currentUser.cargo || 'Funcionário';

    const userTasksList = document.getElementById('user-tasks-list');
    if (userTasksList) {
        userTasksList.innerHTML = myTasks.length
            ? [...myTasks].reverse().map(t => {
                const done = t.status === 'completed';
                return `
                <div class="task-card glass ${done ? 'completed' : ''}">
                    <div class="task-card-header">
                        <h4>${t.title}</h4>
                        <div class="task-status-dot ${done ? 'done' : ''}"></div>
                    </div>
                    <p class="desc">${t.desc}</p>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px">
                        📅 Prazo: <b style="color:var(--secondary)">${formatDateTime(t.dueDate)}</b>
                    </div>
                    <div class="task-card-footer">
                        <span class="xp-pill">✅ ${t.points} XP</span>
                        ${done
                            ? `<span class="status-text-done">✔ CONCLUÍDA</span>`
                            : `<button class="btn-complete" onclick="completeTask('${t.id}')">✔ Concluir Missão</button>`}
                    </div>

                    <div class="task-notes-box">
                        <span class="notes-label">Minhas Anotações:</span>
                        <textarea 
                            id="note-${t.id}" 
                            class="notes-textarea" 
                            placeholder="Escreva aqui observações sobre esta missão..."
                            ${done ? 'disabled' : ''}>${t.employeeNote || ''}</textarea>
                        ${!done ? `<button class="btn-save-note" onclick="saveTaskNote('${t.id}')">💾 Salvar Nota</button>` : ''}
                    </div>
                </div>`;
              }).join('')
            : `<div class="empty-state"><div>🎯</div><p>Você não tem missões pendentes.<br>Aguarde seu administrador!</p></div>`;
    }
}

// ── ACTIONS ───────────────────────────────────────────
async function completeTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'completed') return;

    try {
        const newXP = (currentUser.points || 0) + task.points;
        await updateDoc(doc(db, "tasks", taskId), { status: 'completed' });
        await updateDoc(doc(db, "users", currentUser.id), { points: newXP });

        toast(`🎉 Missão concluída! Você ganhou <b>+${task.points} XP</b>! 🔥`, 'success', 4500);

        // Notificar admin
        const admin = users.find(u => u.role === 'admin');
        if (admin?.phone) {
            const msg = encodeURIComponent(
                `🎯 *Missão Concluída no DEFPro Control!*\n\n` +
                `Funcionário: *${currentUser.name}*\n` +
                `Missão: "${task.title}"\n` +
                `XP ganhos: *${task.points} XP*`
            );
            setTimeout(() => {
                if (confirm('Deseja notificar o Administrador sobre a conclusão?'))
                    openWhatsApp(admin.phone, msg);
            }, 800);
        }
    } catch (err) { toast('❌ Erro ao concluir online.', 'error'); }
}

async function deleteTask(taskId) {
    if (!confirm('Excluir esta missão permanentemente?')) return;
    try {
        await deleteDoc(doc(db, "tasks", taskId));
        toast('🗑️ Missão removida.', 'info');
    } catch (err) { toast('❌ Erro ao excluir online.', 'error'); }
}

async function saveTaskNote(taskId) {
    const noteContent = document.getElementById(`note-${taskId}`).value.trim();
    try {
        await updateDoc(doc(db, "tasks", taskId), { employeeNote: noteContent });
        toast('✅ Anotação salva!', 'success');
    } catch (err) { toast('❌ Erro ao salvar nota.', 'error'); }
}

// ── EXPORTE PARA O WINDOW (MODULOS) ───────────────────
window.showDashboard = (type) => showDashboard(type);
window.returnToDashboard = () => returnToDashboard();
window.logout = () => logout();
window.previewPhoto = (input) => previewPhoto(input);
window.toggleMultiSelect = () => toggleMultiSelect();
window.toggleAssignee = (uid) => toggleAssignee(uid);
window.deleteUser = (uid) => deleteUser(uid);
window.openEditUser = (uid) => openEditUser(uid);
window.closeEditModal = () => closeEditModal();
window.previewEditPhoto = (input) => previewEditPhoto(input);
window.deleteTask = (tid) => deleteTask(tid);
window.completeTask = (tid) => completeTask(tid);
window.saveTaskNote = (tid) => saveTaskNote(tid);
window.saveAdminWhatsapp = () => saveAdminWhatsapp();

// ── WHATSAPP ──────────────────────────────────────────
function openWhatsApp(phone, message) {
    const formatted = formatPhone(phone);
    if (formatted.length < 12) {
        toast('⚠️ Número de WhatsApp inválido. Use: DDD + número (ex: 11999998888)', 'error', 5000);
        return;
    }
    const url = `https://wa.me/${formatted}?text=${message}`;
    const win = window.open(url, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
        toast(`📱 Popup bloqueado! <a href="${url}" target="_blank" style="color:#afffcf;text-decoration:underline">Clique aqui para abrir o WhatsApp</a>`, 'info', 8000);
    }
}

function notifyByWhatsApp(task, user) {
    if (!user?.phone) {
        toast(`⚠️ <b>${user?.name}</b> sem número de WhatsApp cadastrado.`, 'error', 5000);
        return;
    }
    const msg = encodeURIComponent(
        `🚀 *Nova Missão no DEFPro Control!*\n\n` +
        `Olá, *${user.name}*! Você recebeu uma nova missão:\n\n` +
        `📋 *${task.title}*\n\n` +
        `📝 ${task.desc}\n\n` +
        `📅 Data: *${formatDateTime(task.dueDate)}*\n` +
        `💰 Recompensa: *${task.points} XP*\n\n` +
        `--- 🔐 DADOS DE ACESSO ---\n` +
        `👤 Usuário: *${user.name}*\n` +
        `🔑 Senha: *${user.pass}*\n\n\n` +
        `Acesse o sistema para completar sua missão!`
    );
    setTimeout(() => openWhatsApp(user.phone, msg), 500);
}

// ── RANKING DASHBOARD RENDERING ───────────────────────
function renderRankingDashboard() {
    const employees = users.filter(u => u.role !== 'admin');
    const sortedUsers = employees.sort((a,b) => (b.points || 0) - (a.points || 0));
    
    // Stats calculation
    const totalXP    = employees.reduce((acc, u) => acc + (u.points || 0), 0);
    const completedT = tasks.filter(t => t.status === 'completed').length;
    const bestUser   = sortedUsers[0] ? sortedUsers[0].name : "---";

    document.getElementById('stats-total-xp').textContent    = totalXP;
    document.getElementById('stats-tasks-done').textContent  = completedT;
    document.getElementById('stats-total-users').textContent = employees.length;
    document.getElementById('stats-best-user').textContent   = bestUser;

    // Render Podium
    const podiumCont = document.getElementById('podium-container');
    const displayTop3 = sortedUsers.slice(0, 3);
    
    // Custom order for podium UI (2nd, 1st, 3rd)
    const podiumOrder = [];
    if (displayTop3[1]) podiumOrder.push({ ...displayTop3[1], pos: 2 });
    if (displayTop3[0]) podiumOrder.push({ ...displayTop3[0], pos: 1 });
    if (displayTop3[2]) podiumOrder.push({ ...displayTop3[2], pos: 3 });

    podiumCont.innerHTML = podiumOrder.map(u => `
        <div class="podium-card pos-${u.pos}">
            <div class="podium-medal">${u.pos === 1 ? '🥇' : u.pos === 2 ? '🥈' : '🥉'}</div>
            <div class="podium-avatar">
                ${avatarHTML(u)}
            </div>
            <div class="podium-name">${u.name}</div>
            <div class="podium-cargo">${u.cargo || 'Funcionário'}</div>
            <div class="podium-xp">${u.points || 0} XP</div>
        </div>
    `).join('');

    // Render Full List
    const listBody = document.getElementById('full-leaderboard-body');
    const maxXP = sortedUsers[0] ? sortedUsers[0].points || 1 : 1;

    listBody.innerHTML = sortedUsers.map((u, i) => {
        const userTasks = tasks.filter(t => t.assigneeId === u.id && t.status === 'completed').length;
        const pct = Math.round(((u.points || 0) / maxXP) * 100);
        return `
        <div class="lb-table-row">
            <div class="lb-pos">${i + 1}</div>
            <div class="lb-user">
                ${avatarHTML(u)}
                <div class="lb-user-info">
                    <div class="lb-uname">${u.name} ${u.role === 'admin' ? '<span class="role-tag role-admin" style="font-size:0.5rem">ADMIN</span>' : ''}</div>
                    <div class="lb-ucargo">${u.cargo || 'Funcionário'}</div>
                </div>
            </div>
            <div class="lb-xp-cell">${u.points || 0} XP</div>
            <div class="lb-tasks-cell">${userTasks} missões</div>
            <div class="lb-bar-cell">
                <div class="lb-mini-bar">
                    <div class="lb-mini-fill" style="width: ${pct}%"></div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function returnToDashboard() {
    showScreen(currentUser.role === 'admin' ? 'admin' : 'user');
    renderDashboard();
}
