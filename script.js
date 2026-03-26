// ══════════════════════════════════════════════════════
//  DEFPro Control | Missões Empresariais - v2.5 (Online Firestore)
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
let currentUser = JSON.parse(localStorage.getItem('th_session')) || null;
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
    const el = document.getElementById(target);
    if (el) el.classList.remove('hidden');
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
    saveSession();
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
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('photo-preview-img');
        const placeholder = document.getElementById('photo-placeholder');
        if (img) { img.src = e.target.result; img.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}
// ── MULTI-SELECT ─────────────────────────────────────
function toggleMultiSelect() {
    const dropdown = document.getElementById('multi-select-dropdown');
    const trigger  = document.getElementById('multi-select-trigger');
    if (!dropdown) return;
    if (dropdown.classList.contains('hidden')) {
        renderMultiSelectOptions();
        dropdown.classList.remove('hidden');
        trigger?.classList.add('open');
    } else {
        dropdown.classList.add('hidden');
        trigger?.classList.remove('open');
    }
}
function renderMultiSelectOptions() {
    const employees = users.filter(u => u.role !== 'admin');
    const dropdown  = document.getElementById('multi-select-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = employees.map(u => {
        const checked = selectedAssignees.includes(u.id);
        const avatar = u.photo ? `<img src="${u.photo}" style="width:30px;height:30px;border-radius:50%;object-fit:cover">` : `<div class="avatar-placeholder" style="width:30px;height:30px;font-size:0.7rem">${u.name.charAt(0).toUpperCase()}</div>`;
        return `
        <div class="ms-option ${checked ? 'checked' : ''}" onclick="toggleAssignee('${u.id}')">
            <div class="ms-checkbox">${checked ? '✓' : ''}</div>
            ${avatar}
            <div style="margin-left:8px">
                <div class="ms-name">${u.name}</div>
                <div class="ms-cargo">${u.cargo || 'Equipe'}</div>
            </div>
        </div>`;
    }).join('');
}
function toggleAssignee(uid) {
    const idx = selectedAssignees.indexOf(uid);
    if (idx === -1) selectedAssignees.push(uid);
    else selectedAssignees.splice(idx, 1);
    renderMultiSelectOptions();
    updateSelectedChips();
}
function updateSelectedChips() {
    const container = document.getElementById('selected-chips');
    const label = document.getElementById('multi-select-label');
    if (!container || !label) return;
    if (!selectedAssignees.length) { label.textContent = '👤 Selecionar funcionários...'; container.innerHTML = ''; return; }
    label.textContent = `${selectedAssignees.length} selecionado(s)`;
    container.innerHTML = selectedAssignees.map(id => {
        const u = users.find(x => x.id === id);
        return u ? `<span class="chip">${u.name} <button onclick="toggleAssignee('${id}')">✕</button></span>` : '';
    }).join('');
}
// ── INIT & LISTENERS ──────────────────────────────────
let dbLoaded = false;
document.addEventListener('DOMContentLoaded', async () => {
    onSnapshot(collection(db, "users"), (snapshot) => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoaded = true;
        if (users.length === 0) {
            addDoc(collection(db, "users"), { name: 'admin', pass: 'admin123', role: 'admin', points: 0, cargo: 'Administrador', photo: '' });
        }
        if (currentUser) {
            const fresh = users.find(u => u.id === currentUser.id || u.name === currentUser.name);
            if (fresh) { currentUser = fresh; saveSession(); }
            renderDashboard();
        } else showScreen('login');
    });
    onSnapshot(collection(db, "tasks"), (snapshot) => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentUser) renderDashboard();
    });
    // Form Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = (e) => {
        e.preventDefault();
        if (!dbLoaded) return toast('⏳ Carregando banco...');
        const userIn = document.getElementById('username').value.trim().toLowerCase();
        const passIn = document.getElementById('password').value;
        const found = users.find(u => u.name.toLowerCase() === userIn && u.pass === passIn);
        if (found) {
            currentUser = found; saveSession();
            showScreen(found.role === 'admin' ? 'admin' : 'user'); renderDashboard();
            toast(`Bem-vindo, <b>${found.name}</b>!`, 'success');
        } else document.getElementById('login-error')?.classList.remove('hidden');
    };
    // Form Add User
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) addUserForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('new-user-name').value.trim();
        const cargo = document.getElementById('new-user-cargo').value.trim();
        const pass = document.getElementById('new-user-pass').value;
        const phone = document.getElementById('new-user-phone').value;
        const phFile = document.getElementById('new-user-photo').files[0];
        const saveToDb = async (b64 = '') => {
            await addDoc(collection(db, "users"), { name, cargo, pass, phone, role: 'user', points: 0, photo: b64 });
            e.target.reset(); toast(`✅ ${name} adicionado!`);
        };
        if (phFile) { const rd = new FileReader(); rd.onload = (ev) => saveToDb(ev.target.result); rd.readAsDataURL(phFile); }
        else saveToDb();
    };
    const editForm = document.getElementById('edit-user-form');
    if (editForm) editForm.onsubmit = (e) => saveUserEdit(e);
    const addTaskForm = document.getElementById('add-task-form');
    if (addTaskForm) addTaskForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!selectedAssignees.length) return toast('⚠️ Selecione os funcionários!', 'error');
        const title = document.getElementById('task-title').value.trim();
        const desc = document.getElementById('task-desc').value.trim();
        const pts = parseInt(document.getElementById('task-points').value || 0);
        const due = document.getElementById('task-deadline').value;
        for (const uid of selectedAssignees) {
            await addDoc(collection(db, "tasks"), { title, desc, assigneeId: uid, points: pts, dueDate: due, status: 'pending', employeeNote: '' });
            const u = users.find(x => x.id === uid);
            if (u) notifyByWhatsApp({ title, desc, points: pts, dueDate: due }, u);
        }
        e.target.reset(); selectedAssignees = []; updateSelectedChips(); toast('🚀 Missões enviadas!');
    };
});
// ── RENDERING ────────────────────────────────────────
function renderDashboard() {
    if (currentUser.role === 'admin') renderAdminUI();
    else renderUserUI();
}
function renderAdminUI() {
    const list = document.getElementById('users-list');
    if (list) list.innerHTML = users.map(u => `
        <li class="glass-item" style="display:flex; align-items:center; padding:12px; margin-bottom:10px; border-radius:12px; background:rgba(255,255,255,0.03)">
            ${avatarHTML(u)}
            <div style="flex:1; margin-left:12px">
                <div style="display:flex; align-items:center; gap:6px">
                    <span style="font-weight:600">${u.name}</span>
                    <span class="role-tag ${u.role==='admin'?'role-admin':'role-user'}">${u.role==='admin'?'A':'E'}</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted)">${u.cargo || '-'} • ${u.points || 0} XP</div>
            </div>
            <div style="display:flex; gap:6px">
                <button class="btn-edit" onclick="openEditUser('${u.id}')" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); padding:6px 10px; border-radius:8px; cursor:pointer">✏️ Editar</button>
                ${u.id !== currentUser.id ? `<button onclick="deleteUser('${u.id}')" style="background:rgba(255,50,50,0.2); border:1px solid rgba(255,50,50,0.4); color:#ffdddd; padding:6px 10px; border-radius:8px; cursor:pointer">✖ Excluir</button>` : ''}
            </div>
        </li>`).join('');
    const taskList = document.getElementById('admin-tasks-list');
    if (taskList) taskList.innerHTML = tasks.length ? [...tasks].reverse().map(t => {
        const worker = users.find(u => u.id === t.assigneeId);
        const done = t.status === 'completed';
        return `
        <div class="task-card glass ${done ? 'completed' : ''}">
            <div class="task-card-header"><h4>${t.title}</h4><div class="task-status-dot ${done ? 'done' : ''}"></div></div>
            <p class="desc">${t.desc}</p>
            <div style="font-size:0.8rem; margin-bottom:10px">${worker ? worker.name : '---'} • <b style="color:var(--secondary)">${t.points} XP</b></div>
            <div class="task-card-footer">
                <span class="${done?'status-text-done':'status-text-pending'}">${done?'CONCLUÍDA':'PENDENTE'}</span>
                <button class="btn-danger" onclick="deleteTask('${t.id}')">✖</button>
            </div>
        </div>`;
    }).join('') : '<p style="text-align:center; padding:20px; color:var(--text-muted)">Nenhuma missão.</p>';
    document.getElementById('admin-task-count').textContent = tasks.length;
}
function renderUserUI() {
    const myTasks = tasks.filter(t => t.assigneeId === currentUser.id);
    const completed = myTasks.filter(t => t.status === 'completed');
    const pct = myTasks.length ? Math.round((completed.length / myTasks.length) * 100) : 0;
    const avatarBig = document.getElementById('user-avatar-big');
    if (avatarBig) avatarBig.innerHTML = avatarHTML(currentUser, 'big');
    document.getElementById('user-display-name').textContent = currentUser.name;
    document.getElementById('user-xp-big').innerHTML = `${currentUser.points || 0} <span>XP</span>`;
    document.getElementById('prog-fill').style.width = `${pct}%`;
    document.getElementById('progress-pct').textContent = `${pct}%`;
    document.getElementById('stat-done').textContent = completed.length;
    document.getElementById('stat-total').textContent = myTasks.length;
    const list = document.getElementById('user-tasks-list');
    if (list) list.innerHTML = myTasks.length ? [...myTasks].reverse().map(t => {
        const done = t.status === 'completed';
        return `<div class="task-card glass ${done ? 'completed' : ''}">
            <div class="task-card-header"><h4>${t.title}</h4><div class="task-status-dot ${done ? 'done' : ''}"></div></div>
            <p class="desc">${t.desc}</p>
            <div class="task-card-footer"><span class="xp-pill">${t.points} XP</span>
            ${done ? '✔' : `<button class="btn-complete" onclick="completeTask('${t.id}')">Concluir</button>`}</div>
            <textarea id="note-${t.id}" class="notes-textarea" ${done?'disabled':''}>${t.employeeNote || ''}</textarea>
            ${!done ? `<button class="btn-save-note" onclick="saveTaskNote('${t.id}')">Salvar</button>` : ''}
        </div>`;
    }).join('') : '<p>Sem missões.</p>';
}
function renderRankingDashboard() {
    const rankList = document.getElementById('full-leaderboard-body');
    if (!rankList) return;
    const sorted = users.filter(u => u.role !== 'admin').sort((a,b) => (b.points||0) - (a.points||0));
    rankList.innerHTML = sorted.map((u, i) => `
        <div class="lb-table-row"><div class="lb-pos">${i+1}</div>
        <div class="lb-user">${avatarHTML(u)} <span style="margin-left:10px">${u.name}</span></div>
        <div class="lb-xp-cell">${u.points || 0} XP</div></div>`).join('');
}
// ── ACTIONS ──────────────────────────────────────────
async function completeTask(tid) {
    const t = tasks.find(x => x.id === tid);
    if (!confirm(`Concluir missão?`)) return;
    await updateDoc(doc(db, "tasks", tid), { status: 'completed' });
    await updateDoc(doc(db, "users", currentUser.id), { points: (currentUser.points||0) + t.points });
    toast('🚀 Missão Concluída!');
}
async function deleteTask(tid) {
    if (confirm('Excluir missão?')) await deleteDoc(doc(db, "tasks", tid));
}
async function deleteUser(uid) {
    const u = users.find(x => x.id === uid);
    if (!u) return;
    if (confirm(`⚠️ Excluir permanentemente "${u.name}"? Isso não pode ser desfeito.`)) {
        await deleteDoc(doc(db, "users", uid));
        const modal = document.getElementById('edit-user-modal');
        if (modal) modal.classList.add('hidden');
        toast('🗑️ Funcionário removido!');
    }
}
async function saveTaskNote(tid) {
    const note = document.getElementById(`note-${tid}`).value.trim();
    await updateDoc(doc(db, "tasks", tid), { employeeNote: note });
}
function openEditUser(uid) {
    const u = users.find(x => x.id === uid);
    if (!u) return;
    document.getElementById('edit-user-id').value = u.id;
    document.getElementById('edit-user-name').value = u.name;
    document.getElementById('edit-user-cargo').value = u.cargo;
    document.getElementById('edit-user-pass').value = u.pass;
    document.getElementById('edit-user-phone').value = u.phone;
    document.getElementById('edit-user-role').value = u.role;
    
    // Adiciona botão de excluir dentro do modal se não for o próprio admin
    let footer = document.querySelector('.edit-modal-footer');
    if (!footer) { 
        footer = document.createElement('div'); 
        footer.className = 'edit-modal-footer'; 
        footer.style.marginTop = '20px';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        document.getElementById('edit-user-form').appendChild(footer);
    }
    footer.innerHTML = `
        <button type="submit" class="btn-primary" style="flex:1">Salvar Alterações</button>
        ${uid !== currentUser.id ? `<button type="button" class="btn-danger" onclick="deleteUser('${uid}')" style="margin-left:10px; background:rgba(255,50,50,0.2); border:1px solid rgba(255,50,50,0.4); padding:8px 15px; border-radius:8px; cursor:pointer; color:#ffdddd">Excluir Usuário</button>` : ''}
    `;
    
    document.getElementById('edit-user-modal').classList.remove('hidden');
}
async function saveUserEdit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const data = { 
        name: document.getElementById('edit-user-name').value,
        cargo: document.getElementById('edit-user-cargo').value,
        pass: document.getElementById('edit-user-pass').value,
        phone: document.getElementById('edit-user-phone').value,
        role: document.getElementById('edit-user-role').value
    };
    const ph = document.getElementById('edit-user-photo').files[0];
    const up = async (b64) => {
        if (b64) data.photo = b64;
        await updateDoc(doc(db, "users", id), data);
        document.getElementById('edit-user-modal').classList.add('hidden');
        toast('✅ Usuário Atualizado!');
    };
    if (ph) { const rd = new FileReader(); rd.onload = (ev) => up(ev.target.result); rd.readAsDataURL(ph); }
    else up();
}
function notifyByWhatsApp(t, u) {
    if (!u.phone) return;
    window.open(`https://wa.me/${formatPhone(u.phone)}?text=${encodeURIComponent(`🚀 *NOVA MISSÃO!*\n*${t.title}*\nXP: ${t.points}`)}`);
}
window.logout = logout;
window.showDashboard = showDashboard;
window.returnToDashboard = returnToDashboard;
window.previewPhoto = previewPhoto;
window.toggleMultiSelect = toggleMultiSelect;
window.toggleAssignee = toggleAssignee;
window.openEditUser = openEditUser;
window.deleteTask = deleteTask;
window.deleteUser = deleteUser;
window.completeTask = completeTask;
window.saveTaskNote = saveTaskNote;
window.closeEditModal = () => document.getElementById('edit-user-modal').classList.add('hidden');
