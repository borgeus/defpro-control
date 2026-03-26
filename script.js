// ══════════════════════════════════════════════════════
//  DEFPro Control | - v2.9 (Settings & Notes Fix)
// ══════════════════════════════════════════════════════
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
let users = [];
let tasks = [];
let currentUser = JSON.parse(localStorage.getItem('th_session')) || null;
let selectedAssignees = [];
function saveSession() { localStorage.setItem('th_session', JSON.stringify(currentUser)); }
function formatPhone(raw) {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('0')) d = d.slice(1);
    if (!d.startsWith('55')) d = '55' + d;
    return d;
}
function toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const e = document.createElement('div');
    e.className = `toast ${type}`;
    e.innerHTML = msg;
    c.appendChild(e);
    setTimeout(() => { e.style.opacity = '0'; setTimeout(() => e.remove(), 400); }, 3500);
}
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id === 'login' ? 'login-screen' : `${id}-dashboard`);
    if (el) el.classList.remove('hidden');
}
function avatarHTML(user, size = 'normal') {
    const cls = size === 'big' ? 'user-avatar-big' : 'avatar-placeholder';
    const style = size === 'normal' ? 'width:32px; height:32px; font-size:0.8rem;' : '';
    if (user?.photo) return `<div class="${cls}" style="${style}"><img src="${user.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
    return `<div class="${cls}" style="${style}">${(user?.name || '?').charAt(0).toUpperCase()}</div>`;
}
// ── LISTENERS ───────────────────────────────────────
onSnapshot(collection(db, "users"), (sn) => {
    users = sn.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentUser) {
        const fresh = users.find(u => u.id === currentUser.id || u.name === currentUser.name);
        if (fresh) { currentUser = fresh; saveSession(); }
        renderDashboard();
    } else showScreen('login');
});
onSnapshot(collection(db, "tasks"), (sn) => {
    tasks = sn.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentUser) renderDashboard();
});
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = (e) => {
        e.preventDefault();
        const uIn = document.getElementById('username').value.trim().toLowerCase();
        const pIn = document.getElementById('password').value;
        const found = users.find(u => u.name.toLowerCase() === uIn && u.pass === pIn);
        if (found) { currentUser = found; saveSession(); renderDashboard(); showScreen(found.role); }
        else toast('Usuário ou senha incorretos!', 'error');
    };
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) addUserForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('new-user-name').value.trim();
        const cargo = document.getElementById('new-user-cargo').value.trim();
        const pass = document.getElementById('new-user-pass').value;
        const phone = document.getElementById('new-user-phone').value;
        const file = document.getElementById('new-user-photo').files[0];
        const save = async (b64 = '') => {
            await addDoc(collection(db, "users"), { name, cargo, pass, phone, role: 'user', points: 0, photo: b64 });
            e.target.reset(); toast('✅ Funcionário Adicionado!');
        };
        if (file) { const r = new FileReader(); r.onload = (ev) => save(ev.target.result); r.readAsDataURL(file); }
        else save();
    };
    const editForm = document.getElementById('edit-user-form');
    if (editForm) editForm.onsubmit = (e) => saveUserEdit(e);
    const addTaskForm = document.getElementById('add-task-form');
    if (addTaskForm) addTaskForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!selectedAssignees.length) return toast('Selecione alguém!', 'error');
        const t = document.getElementById('task-title').value;
        const d = document.getElementById('task-desc').value;
        const p = parseInt(document.getElementById('task-points').value || 0);
        const due = document.getElementById('task-deadline').value;
        for (const uid of selectedAssignees) {
            await addDoc(collection(db, "tasks"), { title: t, desc: d, assigneeId: uid, points: p, dueDate: due, status: 'pending', employeeNote: '' });
        }
        e.target.reset(); selectedAssignees = []; updateSelectedChips(); toast('🚀 Missão Enviada!');
    };
});
function renderDashboard() {
    if (!currentUser) return;
    if (currentUser.role === 'admin') renderAdminUI();
    else renderUserUI();
}
function renderAdminUI() {
    const greeting = document.getElementById('admin-greeting');
    if (greeting) greeting.textContent = `Olá, ${currentUser.name}`;
    const list = document.getElementById('users-list');
    if (list) list.innerHTML = users.map(u => `
        <li class="glass-item" style="display:flex; align-items:center; padding:10px; margin-bottom:8px; border-radius:12px; background:rgba(255,255,255,0.03)">
            ${avatarHTML(u)}
            <div style="flex:1; margin-left:12px; overflow:hidden">
                <div style="font-weight:600; font-size:0.9rem">${u.name}</div>
                <div style="font-size:0.7rem; color:var(--text-muted)">${u.cargo || '-'} • ${u.points || 0} XP</div>
            </div>
            <button onclick="openEditUser('${u.id}')" style="background:var(--secondary); border:none; padding:6px 10px; border-radius:8px; cursor:pointer; color:#000; font-weight:bold; font-size:0.75rem">✏️ Editar</button>
        </li>`).join('');
    const tList = document.getElementById('admin-tasks-list');
    if (tList) tList.innerHTML = tasks.length ? [...tasks].reverse().map(t => {
        const worker = users.find(u => u.id === t.assigneeId);
        const done = t.status === 'completed';
        return `<div class="task-card glass ${done?'completed':''}">
            <div style="display:flex; justify-content:space-between"><h4>${t.title}</h4><div class="task-status-dot ${done?'done':''}"></div></div>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:5px">Para: ${worker?worker.name:'--'}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px">
                <span style="color:var(--secondary); font-weight:bold">${t.points} XP</span>
                <button onclick="deleteTask('${t.id}')" style="background:rgba(255,0,0,0.2); border:none; color:white; padding:5px 8px; border-radius:5px; cursor:pointer">✖</button>
            </div>
            ${t.employeeNote ? `<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; font-size:0.75rem; color:var(--secondary); border:1px solid rgba(255,215,0,0.1); margin-top:10px">💬 <b>Feedback:</b> "${t.employeeNote}"</div>` : ''}
        </div>`;
    }).join('') : '<p style="text-align:center; padding:20px; color:var(--text-muted)">Sem missões ativas.</p>';
    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const countEl = document.getElementById('admin-task-count');
    if (countEl) countEl.textContent = pendingCount;
}
function renderUserUI() {
    const myTasks = tasks.filter(t => t.assigneeId === currentUser.id);
    const completed = myTasks.filter(t => t.status === 'completed');
    const pct = myTasks.length ? Math.round((completed.length / myTasks.length) * 100) : 0;
    const avatarBig = document.getElementById('user-avatar-big');
    if (avatarBig) avatarBig.innerHTML = avatarHTML(currentUser, 'big');
    
    const cargoBadge = document.getElementById('user-cargo-badge');
    if (cargoBadge) cargoBadge.textContent = currentUser.cargo || 'Funcionario';
    
    const dispName = document.getElementById('user-display-name');
    if (dispName) dispName.textContent = currentUser.name;
    
    const xpBig = document.getElementById('user-xp-big');
    if (xpBig) xpBig.textContent = currentUser.points || 0;
    
    const ptsHeader = document.getElementById('user-points-header');
    if (ptsHeader) ptsHeader.textContent = currentUser.points || 0;
    
    const fill = document.getElementById('prog-fill');
    if (fill) fill.style.width = `${pct}%`;
    
    const pctText = document.getElementById('progress-pct');
    if (pctText) pctText.textContent = `${pct}%`;
    
    const sDone = document.getElementById('stat-done');
    if (sDone) sDone.textContent = completed.length;
    
    const sPend = document.getElementById('stat-pending');
    if (sPend) sPend.textContent = myTasks.length - completed.length;
    
    const sTotal = document.getElementById('stat-total');
    if (sTotal) sTotal.textContent = myTasks.length;
    const list = document.getElementById('user-tasks-list');
    if (list) list.innerHTML = myTasks.length ? [...myTasks].reverse().map(t => {
        const done = t.status === 'completed';
        return `<div class="task-card glass ${done?'completed':''}">
            <h4>${t.title}</h4>
            <p style="font-size:0.85rem; color:var(--text-muted); margin:8px 0">${t.desc}</p>
            ${done ? '<div style="color:var(--success); font-weight:bold">✅ Missão Concluída</div>' : `<button onclick="completeTask('${t.id}')" style="background:var(--secondary); border:none; padding:10px; border-radius:8px; cursor:pointer; width:100%; margin-top:10px; font-weight:bold; color:#000">CONCLUIR +${t.points} XP</button>`}
            
            <div style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px">
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px">Observação / Nota:</label>
                <textarea id="note-${t.id}" style="width:100%; height:50px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; font-size:0.8rem; padding:8px; resize:none" placeholder="Escreva algo sobre esta missão..." ${done?'disabled':''}>${t.employeeNote || ''}</textarea>
                ${!done ? `<button onclick="saveTaskNote('${t.id}')" style="margin-top:5px; padding:4px 10px; font-size:0.7rem; border-radius:4px; border:none; background:rgba(255,255,255,0.1); color:white; cursor:pointer">Salvar Nota</button>` : ''}
            </div>
        </div>`;
    }).join('') : '<p style="text-align:center; color:var(--text-muted); padding:20px">Você está em dia!</p>';
}
function renderRankingDashboard() {
    const employees = users.filter(u => u.role !== 'admin');
    const sorted = [...employees].sort((a,b) => (b.points||0) - (a.points||0));
    const totalXP = employees.reduce((acc, u) => acc + (u.points || 0), 0);
    const totalDone = tasks.filter(t => t.status === 'completed').length;
    const bestUser = sorted[0] ? sorted[0].name : '---';
    document.getElementById('stats-total-xp').textContent = totalXP;
    document.getElementById('stats-tasks-done').textContent = totalDone;
    document.getElementById('stats-total-users').textContent = employees.length;
    document.getElementById('stats-best-user').textContent = bestUser;
    const list = document.getElementById('full-leaderboard-body');
    if (list) list.innerHTML = sorted.map((u, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.03); margin-bottom:8px; border-radius:10px">
            <div style="display:flex; align-items:center; gap:12px">
                <span style="font-weight:bold; width:20px">${i+1}º</span>
                ${avatarHTML(u)}
                <span>${u.name}</span>
            </div>
            <b style="color:var(--secondary)">${u.points||0} XP</b>
        </div>`).join('');
}
// ── ACTIONS ──────────────────────────────────────────
function toggleAdminSettings() {
    const panel = document.getElementById('admin-settings-panel');
    if (panel) panel.classList.toggle('hidden');
}
async function saveAdminWhatsapp() {
    const phone = document.getElementById('admin-whatsapp').value;
    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
        await updateDoc(doc(db, "users", adminUser.id), { phone });
        toast('✅ Configurações salvas!', 'success');
        toggleAdminSettings();
    }
}
async function saveTaskNote(tid) {
    const note = document.getElementById(`note-${tid}`).value.trim();
    await updateDoc(doc(db, "tasks", tid), { employeeNote: note });
    toast('✅ Nota salva com sucesso!', 'success');
}
async function deleteTask(id) { if(confirm('Excluir missão?')) await deleteDoc(doc(db, "tasks", id)); }
async function deleteUser(id) {
    if(confirm('⚠️ EXCLUIR ESTE FUNCIONÁRIO?')) {
        await deleteDoc(doc(db, "users", id));
        document.getElementById('edit-user-modal').classList.add('hidden');
        toast('🗑️ Usuário Removido!');
    }
}
function openEditUser(id) {
    const u = users.find(x => x.id === id);
    if(!u) return;
    document.getElementById('edit-user-id').value = u.id;
    document.getElementById('edit-user-name').value = u.name;
    document.getElementById('edit-user-cargo').value = u.cargo;
    document.getElementById('edit-user-pass').value = u.pass;
    document.getElementById('edit-user-phone').value = u.phone;
    document.getElementById('edit-user-role').value = u.role;
    let footer = document.querySelector('.edit-modal-footer');
    if(!footer) {
        footer = document.createElement('div');
        footer.className = 'edit-modal-footer';
        footer.style.marginTop = '20px';
        document.getElementById('edit-user-form').appendChild(footer);
    }
    footer.innerHTML = `
        <button type="submit" style="width:100%; padding:12px; background:var(--secondary); border:none; border-radius:8px; font-weight:bold; cursor:pointer; margin-bottom:10px">Salvar Alterações</button>
        ${id !== currentUser.id ? `<button type="button" onclick="deleteUser('${id}')" style="width:100%; padding:8px; background:transparent; border:1px solid #ff4444; color:#ff4444; border-radius:8px; cursor:pointer; font-size:0.8rem">⚠️ Excluir Funcionário</button>` : ''}
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
    await updateDoc(doc(db, "users", id), data);
    document.getElementById('edit-user-modal').classList.add('hidden');
    toast('✅ Atualizado!');
}
async function completeTask(id) {
    const t = tasks.find(x => x.id === id);
    await updateDoc(doc(db, "tasks", id), { status: 'completed' });
    await updateDoc(doc(db, "users", currentUser.id), { points: (currentUser.points||0) + t.points });
    toast('🚀 Missão Concluída!');
}
function toggleMultiSelect() {
    const d = document.getElementById('multi-select-dropdown');
    if (d.classList.contains('hidden')) {
        const emps = users.filter(u => u.role !== 'admin');
        d.innerHTML = emps.map(u => `
            <div onclick="toggleAssignee('${u.id}')" style="padding:10px; cursor:pointer; display:flex; align-items:center; gap:10px; border-bottom:1px solid rgba(255,255,255,0.05)">
                ${selectedAssignees.includes(u.id)?'✅':'⬜'} 
                ${avatarHTML(u)}
                <span style="font-size:0.9rem">${u.name}</span>
            </div>`).join('');
        d.classList.remove('hidden');
    } else d.classList.add('hidden');
}
function toggleAssignee(id) {
    const i = selectedAssignees.indexOf(id);
    if(i===-1) selectedAssignees.push(id); else selectedAssignees.splice(i,1);
    updateSelectedChips();
    const d = document.getElementById('multi-select-dropdown');
    d.classList.add('hidden'); toggleMultiSelect(); 
}
function updateSelectedChips() {
    document.getElementById('multi-select-label').textContent = selectedAssignees.length ? `${selectedAssignees.length} selecionados` : '👤 Selecionar funcionários...';
}
function logout() { localStorage.removeItem('th_session'); location.reload(); }
function returnToDashboard() { renderDashboard(); showScreen(currentUser.role); }
function showDashboard(t) { if(t==='ranking') { showScreen('ranking'); renderRankingDashboard(); } }
window.logout = logout; 
window.showDashboard = showDashboard; 
window.returnToDashboard = returnToDashboard;
window.toggleMultiSelect = toggleMultiSelect; 
window.toggleAssignee = toggleAssignee;
window.openEditUser = openEditUser; 
window.deleteUser = deleteUser;
window.deleteTask = deleteTask; 
window.completeTask = completeTask;
window.toggleAdminSettings = toggleAdminSettings;
window.saveAdminWhatsapp = saveAdminWhatsapp;
window.saveTaskNote = saveTaskNote;
window.closeEditModal = () => document.getElementById('edit-user-modal').classList.add('hidden');
