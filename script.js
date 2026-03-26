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
let currentUser = JSON.parse(localStorage.getItem('th_session')) || null;
let selectedAssignees = [];
// ── PERSISTENCE ───────────────────────────────────────
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
    if (!container) return;
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
    if (!currentUser) return showScreen('login');
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
        const ph  = document.getElementById('photo-placeholder');
        if (img) { img.src = e.target.result; img.style.display = 'block'; }
        if (ph)  ph.style.display = 'none';
    };
    reader.readAsDataURL(file);
}
// ── MULTI-SELECT LOGIC ────────────────────────────────
function toggleMultiSelect() {
    const dropdown = document.getElementById('multi-select-dropdown');
    const trigger  = document.getElementById('multi-select-trigger');
    const arrow    = trigger?.querySelector('.multi-arrow');
    if (!dropdown) return;
    const isOpen   = !dropdown.classList.contains('hidden');
    if (isOpen) {
        dropdown.classList.add('hidden'); trigger?.classList.remove('open');
        arrow?.classList.remove('rotated');
    } else {
        renderMultiSelectOptions();
        dropdown.classList.remove('hidden'); trigger?.classList.add('open');
        arrow?.classList.add('rotated');
    }
}
function renderMultiSelectOptions() {
    const employees = users.filter(u => u.role !== 'admin');
    const dropdown  = document.getElementById('multi-select-dropdown');
    if (!dropdown) return;
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
    if (!chipsContainer || !label) return;
    if (!selectedAssignees.length) {
        label.textContent = '👤 Selecionar funcionários...';
        chipsContainer.innerHTML = ''; return;
    }
    label.textContent = `${selectedAssignees.length} selecionado(s)`;
    chipsContainer.innerHTML = selectedAssignees.map(id => {
        const u = users.find(u => u.id === id);
        return u ? `<span class="chip">${u.name} <button type="button" onclick="toggleAssignee('${id}')">✕</button></span>` : '';
    }).join('');
}
// ── INIT & LISTENERS ──────────────────────────────────
let dbLoaded = false;
document.addEventListener('DOMContentLoaded', async () => {
    onSnapshot(collection(db, "users"), (snapshot) => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoaded = true;
        if (users.length === 0) {
            addDoc(collection(db, "users"), { 
                name: 'admin', pass: 'admin123', phone: '', role: 'admin', points: 0, cargo: 'Administrador', photo: '' 
            });
        }
        if (currentUser) {
            const fresh = users.find(u => u.name === currentUser.name);
            if (fresh) { currentUser = fresh; saveSession(); }
            renderDashboard();
        } else {
            showScreen('login');
        }
    }, (err) => toast('❌ Erro de permissão no Firebase!', 'error'));
    onSnapshot(collection(db, "tasks"), (snapshot) => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentUser) renderDashboard();
    });
    initForms();
});
function initForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = (e) => {
        e.preventDefault();
        const nInput = document.getElementById('username')?.value.trim().toLowerCase();
        const pInput = document.getElementById('password')?.value;
        const found = users.find(u => u.name.toLowerCase() === nInput && u.pass === pInput);
        if (found) {
            currentUser = found; saveSession();
            showScreen(found.role === 'admin' ? 'admin' : 'user'); renderDashboard();
            toast(`Bem-vindo, <b>${found.name}</b>!`, 'success');
        } else {
            const err = document.getElementById('login-error');
            if (err) err.classList.remove('hidden');
        }
    };
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) addUserForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('new-user-name')?.value.trim();
        const cargo = document.getElementById('new-user-cargo')?.value.trim();
        const pass = document.getElementById('new-user-pass')?.value;
        const phone = document.getElementById('new-user-phone')?.value;
        const phFile = document.getElementById('new-user-photo')?.files[0];
        const saveToDb = async (b64 = '') => {
            await addDoc(collection(db, "users"), { name, cargo, pass, phone, role: 'user', points: 0, photo: b64 });
            e.target.reset(); toast(`✅ ${name} adicionado!`);
        };
        if (phFile) {
            const rd = new FileReader(); rd.onload = (ev) => saveToDb(ev.target.result); rd.readAsDataURL(phFile);
        } else saveToDb();
    };
    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) editUserForm.onsubmit = (e) => saveUserEdit(e);
    const addTaskForm = document.getElementById('add-task-form');
    if (addTaskForm) addTaskForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title')?.value.trim();
        const desc = document.getElementById('task-desc')?.value.trim();
        const due = document.getElementById('task-deadline')?.value;
        const pts = parseInt(document.getElementById('task-points')?.value || 0);
        for (const uid of selectedAssignees) {
            await addDoc(collection(db, "tasks"), { title, desc, dueDate: due, points: pts, assigneeId: uid, status: 'pending', employeeNote: '' });
            const u = users.find(x => x.id === uid);
            if (u) notifyByWhatsApp({ title, desc, dueDate: due, points: pts }, u);
        }
        e.target.reset(); selectedAssignees = []; updateSelectedChips(); toast('🚀 Missões enviadas!');
    };
}
// ── USER MANAGEMENT ───────────────────────────────────
async function deleteUser(uid) {
    if (uid === currentUser.id) return toast('⚠️ Não pode se excluir!', 'error');
    if (confirm('Excluir?')) await deleteDoc(doc(db, "users", uid));
}
function openEditUser(uid) {
    const u = users.find(x => x.id === uid);
    if (!u) return;
    const idF = document.getElementById('edit-user-id');
    const nameF = document.getElementById('edit-user-name');
    const cargoF = document.getElementById('edit-user-cargo');
    const passF = document.getElementById('edit-user-pass');
    const phoneF = document.getElementById('edit-user-phone');
    const roleF = document.getElementById('edit-user-role');
    if (idF) idF.value = u.id;
    if (nameF) nameF.value = u.name;
    if (cargoF) cargoF.value = u.cargo;
    if (passF) passF.value = u.pass;
    if (phoneF) phoneF.value = u.phone;
    if (roleF) roleF.value = u.role;
    const img = document.getElementById('edit-photo-img');
    const ph = document.getElementById('edit-photo-placeholder');
    if (u.photo) {
        if(img) {img.src = u.photo; img.style.display = 'block';}
        if(ph) ph.style.display = 'none';
    } else {
        if(img) img.style.display = 'none';
        if(ph) ph.style.display = 'block';
    }
    document.getElementById('edit-user-modal')?.classList.remove('hidden');
}
async function saveUserEdit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id')?.value;
    const photoFile = document.getElementById('edit-user-photo')?.files[0];
    
    const finalize = async (b64) => {
        const update = {
            name: document.getElementById('edit-user-name')?.value,
            cargo: document.getElementById('edit-user-cargo')?.value,
            pass: document.getElementById('edit-user-pass')?.value,
            phone: document.getElementById('edit-user-phone')?.value,
            role: document.getElementById('edit-user-role')?.value
        };
        if (b64 !== undefined) update.photo = b64;
        await updateDoc(doc(db, "users", id), update);
        document.getElementById('edit-user-modal')?.classList.add('hidden');
        toast('✅ Atualizado!');
    };
    if (photoFile) {
        const rd = new FileReader(); rd.onload = (ev) => finalize(ev.target.result); rd.readAsDataURL(photoFile);
    } else finalize();
}
function closeEditModal() { document.getElementById('edit-user-modal')?.classList.add('hidden'); }
// ── DASHBOARD RENDERING ───────────────────────────────
function renderDashboard() {
    if (!currentUser) return;
    if (currentUser.role === 'admin') renderAdminUI();
    else renderUserUI();
}
function renderAdminUI() {
    const greet = document.getElementById('admin-greeting');
    if(greet) greet.textContent = `Olá, ${currentUser.name}`;
    const list = document.getElementById('users-list');
    if (list) list.innerHTML = users.map(u => `
        <li class="glass-item" style="display:flex; align-items:center; padding:12px; margin-bottom:10px; border-radius:12px; background:rgba(255,255,255,0.03)">
            ${avatarHTML(u)}
            <div style="flex:1; margin-left:12px">
                <span style="font-weight:600">${u.name}</span>
                <span class="role-tag ${u.role==='admin'?'role-admin':'role-user'}">${u.role==='admin'?'Admin':'Equipe'}</span>
                <div style="font-size:0.8rem; color:var(--text-muted)">${u.cargo || 'Funcionário'} • ${u.points || 0} XP</div>
            </div>
            <button class="btn-edit" onclick="openEditUser('${u.id}')">✏️</button>
            ${u.id !== currentUser.id ? `<button class="btn-danger" onclick="deleteUser('${u.id}')">✖</button>` : ''}
        </li>`).join('');
    
    const taskList = document.getElementById('admin-tasks-list');
    if (taskList) taskList.innerHTML = [...tasks].reverse().map(t => {
        const w = users.find(x => x.id === t.assigneeId);
        const done = t.status === 'completed';
        return `
        <div class="task-card glass ${done?'completed':''}">
            <h4>${t.title}</h4>
            <p class="desc">${t.desc}</p>
            <div style="font-size:0.8rem; color:var(--text-muted)">📅 Data: ${formatDateTime(t.dueDate)}</div>
            <div style="font-size:0.8rem; margin:8px 0">👤 ${w ? w.name : '---'}</div>
            <div class="task-card-footer">
                <span class="xp-pill">✅ ${t.points} XP</span>
                <button class="btn-danger" onclick="deleteTask('${t.id}')">Remover</button>
            </div>
            ${t.employeeNote ? `<div class="admin-note-display"><p class="admin-note-text">"${t.employeeNote}"</p></div>` : ''}
        </div>`;
    }).join('');
}
function renderUserUI() {
    const my = tasks.filter(t => t.assigneeId === currentUser.id);
    const greet = document.getElementById('user-display-name');
    if(greet) greet.textContent = currentUser.name;
    const pts = document.getElementById('user-points-header');
    if(pts) pts.textContent = currentUser.points || 0;
    const list = document.getElementById('user-tasks-list');
    if (list) list.innerHTML = my.length ? my.map(t => {
        const d = t.status === 'completed';
        return `
        <div class="task-card glass ${d?'completed':''}">
            <h4>${t.title}</h4>
            <p>${t.desc}</p>
            <div class="task-card-footer">
                <span class="xp-pill">✅ ${t.points} XP</span>
                ${d ? '<span class="status-text-done">✔ CONCLUÍDA</span>' : `<button class="btn-complete" onclick="completeTask('${t.id}')">✔ Concluir</button>`}
            </div>
            <div class="task-notes-box">
                <span class="notes-label">Minhas Anotações:</span>
                <textarea id="note-${t.id}" class="notes-textarea" ${d?'disabled':''}>${t.employeeNote||''}</textarea>
                ${!d ? `<button class="btn-save-note" onclick="saveTaskNote('${t.id}')">💾 Salvar Nota</button>` : ''}
            </div>
        </div>`;
    }).join('') : '<div style="text-align:center; padding:20px; color:var(--text-muted)">Nenhuma missão atribuída.</div>';
}
function renderRankingDashboard() {
    const emp = users.filter(u => u.role !== 'admin').sort((a,b) => (b.points||0) - (a.points||0));
    const body = document.getElementById('full-leaderboard-body');
    if (body) body.innerHTML = emp.map((u, i) => `
        <div class="lb-table-row">
            <div class="lb-pos">${i+1}</div>
            <div class="lb-user">${u.name}</div>
            <div class="lb-xp-cell">${u.points||0} XP</div>
        </div>`).join('');
}
async function completeTask(tid) {
    const t = tasks.find(x => x.id === tid);
    if (!t) return;
    await updateDoc(doc(db, "tasks", tid), { status: 'completed' });
    await updateDoc(doc(db, "users", currentUser.id), { points: (currentUser.points || 0) + t.points });
    toast('🚀 Missão Concluída!');
}
async function deleteTask(tid) { await deleteDoc(doc(db, "tasks", tid)); }
async function saveTaskNote(tid) {
    const n = document.getElementById(`note-${tid}`).value;
    await updateDoc(doc(db, "tasks", tid), { employeeNote: n });
    toast('✅ Nota Salva!');
}
function formatDateTime(iso) { 
    if(!iso) return '---';
    return new Date(iso).toLocaleString(); 
}
// ── EXPORTE WINDOW ────────────────────────────────────
window.showDashboard = showDashboard; 
window.returnToDashboard = returnToDashboard;
window.logout = logout; 
window.previewPhoto = previewPhoto;
window.toggleMultiSelect = toggleMultiSelect; 
window.toggleAssignee = toggleAssignee;
window.deleteUser = deleteUser; 
window.openEditUser = openEditUser;
window.closeEditModal = closeEditModal; 
window.deleteTask = deleteTask;
window.completeTask = completeTask; 
window.saveTaskNote = saveTaskNote;
function notifyByWhatsApp(task, user) {
    if(!user.phone) return;
    const msg = encodeURIComponent(`🚀 *NOVA MISSÃO NO DEFPro Control!*\n\nOlá, *${user.name}*!\n\nVocê recebeu uma nova missão:\n\n✨ *${task.title}*\n📅 Prazo: *${formatDateTime(task.dueDate)}*\n💎 Recompensa: *${task.points} XP*\n\nAcesse o sistema para ver os detalhes e concluir!`);
    window.open(`https://wa.me/${formatPhone(user.phone)}?text=${msg}`, '_blank');
}
