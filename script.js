// ══════════════════════════════════════════════════════
//  DEFPro Control | Missões Empresariais - v2.7 (Limpeza Total)
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
    if (user?.photo) return `<div class="${cls}"><img src="${user.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
    return `<div class="${cls}">${(user?.name || '?').charAt(0).toUpperCase()}</div>`;
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
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const uIn = document.getElementById('username').value.trim().toLowerCase();
        const pIn = document.getElementById('password').value;
        const found = users.find(u => u.name.toLowerCase() === uIn && u.pass === pIn);
        if (found) { currentUser = found; saveSession(); renderDashboard(); showScreen(found.role); }
        else toast('Usuário ou senha incorretos!', 'error');
    };
    document.getElementById('add-user-form').onsubmit = (e) => {
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
    document.getElementById('edit-user-form').onsubmit = (e) => saveUserEdit(e);
    document.getElementById('add-task-form').onsubmit = async (e) => {
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
    if (currentUser.role === 'admin') renderAdminUI();
    else renderUserUI();
    showScreen(currentUser.role);
}
function renderAdminUI() {
    document.getElementById('admin-greeting').textContent = `Olá, ${currentUser.name}`;
    const list = document.getElementById('users-list');
    // AQUI: removido qualquer botão de excluir da lista lateral
    list.innerHTML = users.map(u => `
        <li class="glass-item" style="display:flex; align-items:center; padding:12px; margin-bottom:10px; border-radius:12px; background:rgba(255,255,255,0.03)">
            ${avatarHTML(u)}
            <div style="flex:1; margin-left:12px; overflow:hidden">
                <div style="font-weight:600">${u.name}</div>
                <div style="font-size:0.7rem; color:var(--text-muted)">${u.cargo || '-'} • ${u.points || 0} XP</div>
            </div>
            <button onclick="openEditUser('${u.id}')" style="background:var(--secondary); border:none; padding:8px 12px; border-radius:8px; cursor:pointer; color:#000; font-weight:bold; font-size:0.8rem">✏️ Editar</button>
        </li>`).join('');
    const tList = document.getElementById('admin-tasks-list');
    tList.innerHTML = tasks.length ? [...tasks].reverse().map(t => {
        const worker = users.find(u => u.id === t.assigneeId);
        const done = t.status === 'completed';
        return `<div class="task-card glass ${done?'completed':''}">
            <div style="display:flex; justify-content:space-between"><h4>${t.title}</h4><div class="task-status-dot ${done?'done':''}"></div></div>
            <p style="font-size:0.8rem; color:var(--text-muted)">Para: ${worker?worker.name:'--'}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px">
                <span style="color:var(--secondary); font-weight:bold">${t.points} XP</span>
                <button onclick="deleteTask('${t.id}')" style="background:rgba(255,0,0,0.2); border:none; color:white; padding:5px 8px; border-radius:5px; cursor:pointer">✖</button>
            </div>
        </div>`;
    }).join('') : '<p>Sem missões.</p>';
}
function renderUserUI() {
    const myTasks = tasks.filter(t => t.assigneeId === currentUser.id);
    document.getElementById('user-display-name').textContent = currentUser.name;
    document.getElementById('user-xp-big').textContent = currentUser.points || 0;
    const list = document.getElementById('user-tasks-list');
    list.innerHTML = myTasks.length ? [...myTasks].reverse().map(t => {
        const done = t.status === 'completed';
        return `<div class="task-card glass ${done?'completed':''}">
            <h4>${t.title}</h4>
            <p>${t.desc}</p>
            ${done ? '✅ Concluída' : `<button onclick="completeTask('${t.id}')" style="background:var(--secondary); border:none; padding:8px; border-radius:5px; cursor:pointer; width:100%; margin-top:10px; font-weight:bold">Concluir Missão</button>`}
        </div>`;
    }).join('') : '<p>Você não tem missões.</p>';
}
// ── ACTIONS ──────────────────────────────────────────
async function deleteTask(id) { if(confirm('Excluir missão?')) await deleteDoc(doc(db, "tasks", id)); }
async function deleteUser(id) {
    if(confirm('⚠️ EXCLUIR ESTE FUNCIONÁRIO PARA SEMPRE?')) {
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
    // Criar o botão de exclusão apenas dentro do Modal
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
        d.innerHTML = emps.map(u => `<div onclick="toggleAssignee('${u.id}')" style="padding:10px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05)">${selectedAssignees.includes(u.id)?'✅':'⬜'} ${u.name}</div>`).join('');
        d.classList.remove('hidden');
    } else d.classList.add('hidden');
}
function toggleAssignee(id) {
    const i = selectedAssignees.indexOf(id);
    if(i===-1) selectedAssignees.push(id); else selectedAssignees.splice(i,1);
    toggleMultiSelect(); toggleMultiSelect(); // refresh
    updateSelectedChips();
}
function updateSelectedChips() {
    document.getElementById('multi-select-label').textContent = selectedAssignees.length ? `${selectedAssignees.length} selecionados` : '👤 Selecionar funcionários...';
}
function logout() { localStorage.removeItem('th_session'); location.reload(); }
function returnToDashboard() { renderDashboard(); }
function showDashboard() { showScreen('ranking'); renderRankingDashboard(); }
function renderRankingDashboard() {
    const list = document.getElementById('full-leaderboard-body');
    const sorted = users.filter(u => u.role !== 'admin').sort((a,b) => (b.points||0) - (a.points||0));
    list.innerHTML = sorted.map((u, i) => `<div style="display:flex; justify-content:space-between; padding:10px; background:rgba(255,255,255,0.03); margin-bottom:5px; border-radius:8px"><span>${i+1}. ${u.name}</span><b>${u.points||0} XP</b></div>`).join('');
}
window.logout = logout; window.showDashboard = showDashboard; window.returnToDashboard = returnToDashboard;
window.toggleMultiSelect = toggleMultiSelect; window.toggleAssignee = toggleAssignee;
window.openEditUser = openEditUser; window.deleteUser = deleteUser;
window.deleteTask = deleteTask; window.completeTask = completeTask;
window.closeEditModal = () => document.getElementById('edit-user-modal').classList.add('hidden');
window.previewPhoto = () => {};
