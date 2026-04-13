import './style.css'
import { auth, googleProvider, db } from './firebase-config';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// --- DATA STORE (Local-First Architecture) ---
const store = {
  get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  // Initialize default mock data if empty
  init() {
    if (!this.get('jobs')) {
      this.set('jobs', [
        { id: 'm1', title: "Dasturchi (Mock)", price: "15,000,000 so'm", company: "Ishchi Bot Tech", location: "Toshkent", createdAt: new Date().toISOString() }
      ]);
    }
    if (!this.get('orders')) {
      this.set('orders', [
        { id: 'm101', title: "Hujjat yetkazish (Mock)", price: "25,000", company: "Anvar aka", location: "Buxoro", createdAt: new Date().toISOString() }
      ]);
    }
    if (!this.get('workers')) {
      this.set('workers', [
        { id: 'w1', title: "Malakali Santexnik", price: "Kelishiladi", company: "Jasur", location: "Xorazm", createdAt: new Date().toISOString() }
      ]);
    }
    if (!this.get('employers')) {
      this.set('employers', [
        { id: 'e1', title: "Katta magazin uchun sotuvchi", price: "3,000,000", company: "Korzinka", location: "Toshkent", createdAt: new Date().toISOString() }
      ]);
    }
  }
};
store.init();

// --- DOM Elements ---
const homeView = document.getElementById('home-view');
const dashboardView = document.getElementById('dashboard-view');
const loginBtn = document.getElementById('login-btn');
const userNameSpan = document.getElementById('user-name');
const tabContent = document.getElementById('tab-content');
const tabBtns = document.querySelectorAll('.tab-btn');

let currentUser = store.get('user');

// --- Auth Initialization ---
function updateAuthState(user) {
  currentUser = user;
  if (user) {
    store.set('user', user);
    loginBtn.textContent = 'Chiqish';
    userNameSpan.textContent = user.displayName;
    showView('dashboard');
    saveUserToDb(user); 
    if (!document.querySelector('.tab-btn.active')) switchTab('home_dash');
    else {
      const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
      switchTab(activeTab);
    }
  } else {
    store.set('user', null);
    loginBtn.textContent = 'Kirish';
    showView('home');
  }
}

async function saveUserToDb(user) {
  try {
    if (!user || !user.uid) return;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const newUser = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        phone: '',
        createdAt: serverTimestamp()
      };
      await setDoc(userRef, newUser);
      currentUser = { ...user, ...newUser };
    } else {
      currentUser = { ...user, ...userSnap.data() };
    }
    store.set('user', currentUser);
  } catch (err) {
    console.error("Foydalanuvchini saqlashda xatolik:", err);
  }
}

// Check on load
window.addEventListener('load', () => {
  if (currentUser) updateAuthState(currentUser);
});

// Firebase Auth Listener
onAuthStateChanged(auth, (user) => {
  if (user && !currentUser) { // Only if not already handled by mock/cache
    updateAuthState({
      uid: user.uid,
      displayName: user.displayName,
      email: user.email
    });
  }
});

// --- Auth Handling ---
loginBtn.addEventListener('click', async () => {
  if (currentUser) {
    if (confirm("Rostdan ham tizimdan chiqmoqchimisiz?")) {
      try {
        await signOut(auth).catch((e) => console.warn("Firebase signout error:", e));
      } finally {
        store.set('user', null);
        currentUser = null;
        location.reload(); 
      }
    }
  } else {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      updateAuthState(result.user);
    } catch (err) {
      console.error("Login xatoligi:", err);
      alert("Kirishda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
    }
  }
});

// --- View/Routing ---
function showView(viewName) {
  if (viewName === 'dashboard') {
    homeView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  } else {
    homeView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

// --- Tabs & Content ---
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    switchTab(btn.dataset.tab);
  });
});

async function switchTab(tab) {
  if (['jobs', 'orders', 'workers', 'employers'].includes(tab)) {
    const items = store.get(tab) || [];
    renderList(tab, items);
    syncData(tab);
  } else if (tab === 'home_dash') {
    renderDashboardHome();
  } else if (tab === 'post') {
    renderPostForm();
  } else if (tab === 'profile') {
    renderProfile();
  }
}

function renderDashboardHome() {
  const jobsCount = (store.get('jobs') || []).length;
  const workersCount = (store.get('workers') || []).length;
  
  tabContent.innerHTML = `
    <div class="dashboard-home">
      <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
        <div class="stat-card" style="background: var(--glass); padding: 2rem; border-radius: 20px; border: 1px solid var(--glass-border); text-align: center;">
          <h3 style="font-size: 2.5rem; color: var(--accent);">${jobsCount}</h3>
          <p style="color: var(--text-muted);">Mavjud Ishlar</p>
        </div>
        <div class="stat-card" style="background: var(--glass); padding: 2rem; border-radius: 20px; border: 1px solid var(--glass-border); text-align: center;">
          <h3 style="font-size: 2.5rem; color: var(--accent);">${workersCount}</h3>
          <p style="color: var(--text-muted);">Ro'yxatdan o'tgan Ishchilar</p>
        </div>
      </div>
      <div style="background: var(--bg-card); padding: 2.5rem; border-radius: 24px; border: 1px solid var(--glass-border);">
        <h3 style="margin-bottom: 1rem;">Xush kelibsiz!</h3>
        <p style="line-height: 1.6; color: var(--text-muted);">
          Bu yerda siz o'zingizga munosib ishni topishingiz, kuryerlik xizmatidan foydalanishingiz 
          yoki o'z xizmatlaringizni taklif qilishingiz mumkin. Quyidagi tablar orqali kerakli bo'limga o'ting.
        </p>
      </div>
    </div>
  `;
}

async function syncData(type) {
  try {
    // 1. Bazadan o'qish
    let realData = [];
    try {
      const q = query(collection(db, type), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      realData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (queryErr) {
      // orderBy ishlamasa, oddiy so'rov
      const snapshot = await getDocs(collection(db, type));
      realData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // 2. Mahalliy, lekin bazaga tushmagan e'lonlarni yuborish
    const localData = store.get(type) || [];
    const onlyLocal = localData.filter(l => l.id && l.id.startsWith('l-'));
    
    for (const item of onlyLocal) {
      try {
        await addDoc(collection(db, type), {
          ...item,
          id: undefined,
          createdAt: serverTimestamp(),
          userId: currentUser?.uid || 'unknown'
        });
      } catch (e) {
        console.warn('Local item sync failed:', e);
      }
    }

    // 3. Agar mahalliy e'lonlar yuborilgan bo'lsa, bazani qayta o'qish
    if (onlyLocal.length > 0) {
      try {
        const q2 = query(collection(db, type), orderBy('createdAt', 'desc'));
        const snap2 = await getDocs(q2);
        realData = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        const snap2 = await getDocs(collection(db, type));
        realData = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    }

    // 4. Bazadagi ma'lumotlarni saqlash va ko'rsatish
    store.set(type, realData);
    renderList(type, realData);
  } catch (err) {
    console.warn(`${type} sinxronizatsiyasida xatolik:`, err);
    // Xato bo'lsa ham mahalliy ma'lumotlarni ko'rsatish
    const localData = store.get(type) || [];
    renderList(type, localData);
  }
}


// --- Rendering ---
function renderList(type, items) {
  if (!items || items.length === 0) {
    tabContent.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 3rem;">📭</div>
        <p>Hozircha hech qanday e'lon yo'q.</p>
      </div>
    `;
    return;
  }

  let html = `<div class="content-grid">`;
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(item => {
    const isOwner = currentUser && item.userId === currentUser.uid;
    const isCourier = currentUser && item.courierId === currentUser.uid;
    const status = item.status || 'pending';
    
    let actions = '';
    let info = '';

    if (type === 'orders') {
      if (status === 'pending') {
        actions = isOwner ? `<p style="color:var(--accent);">Kuryer kutilmoqda...</p>` : `<button class="btn btn-sm btn-block connect-btn" data-id="${item.id}">Bog'lanish (Kuryer bo'lish)</button>`;
      } else if (status === 'accepted') {
        if (isOwner) {
          actions = `
            <div style="background: rgba(255,165,0,0.1); padding: 1rem; border-radius: 10px; margin-top: 1rem;">
              <p style="color:orange; font-size: 0.9rem; margin-bottom: 0.5rem;">🚚 ${item.courierName} buyurtmani olmoqchi!</p>
              <button class="btn btn-sm btn-block confirm-btn" data-id="${item.id}" style="background: orange;">Tasdiqlash</button>
            </div>
          `;
        } else {
          actions = `<p style="color:orange;">Tasdiqlash kutilmoqda...</p>`;
        }
      } else if (status === 'confirmed') {
        if (isOwner || isCourier) {
          info = `
            <div class="secure-info">
              <p>👤 Ism: ${item.userName}</p>
              <p>📞 Tel: ${item.userPhone || 'Berilmagan'}</p>
              <p>📧 Email: ${item.userEmail || ''}</p>
              <p>📦 Kimdan: ${item.from || '---'}</p>
              <p>📍 Kimgacha: ${item.to || '---'}</p>
              <p style="color:#10B981; font-weight: 800; margin-top: 0.5rem;">✅ Tasdiqlangan!</p>
            </div>
          `;
        } else {
          actions = `<p style="color:#10B981;">Bajarilmoqda...</p>`;
        }
      }
    } else {
      // For jobs/workers/employers, simplified
      actions = `<button class="btn btn-sm btn-block" onclick="alert('Tez kunda bog\\'lanish imkoniyati qo\\'shiladi')">Bog'lanish</button>`;
    }

    html += `
      <div class="card status-${status}">
        <div class="card-badge badge-${status}">${status.toUpperCase()}</div>
        <h3>${item.title}</h3>
        <p class="price">${item.price} so'm</p>
        <div class="meta">
          <span>📍 ${item.location || 'Urganch'}</span><br>
          <span>👤 ${item.userName || item.company || 'Anonim'}</span>
        </div>
        ${info}
        ${actions}
      </div>
    `;
  });
  html += `</div>`;
  tabContent.innerHTML = html;

  // Event Listeners for buttons
  document.querySelectorAll('.connect-btn').forEach(b => {
    b.addEventListener('click', () => handleConnect(type, b.dataset.id));
  });
  document.querySelectorAll('.confirm-btn').forEach(b => {
    b.addEventListener('click', () => handleConfirm(type, b.dataset.id));
  });
}
function renderPostForm() {
  tabContent.innerHTML = `
    <div class="form-container">
      <h3 style="margin-bottom: 1.5rem; text-align: center;">Yangi E'lon</h3>
      <div class="form-group">
        <label>E'lon turi</label>
        <select id="post-type">
          <option value="jobs">Ish berishi</option>
          <option value="orders">Kuryerlik zakazi (Dostavka)</option>
          <option value="workers">Ish qidirish (Rezyume)</option>
          <option value="employers">Xodim qidirish</option>
        </select>
      </div>
      <div id="extra-fields"></div>
      <div class="form-group">
        <label>Sarlavha / Nima yuk?</label>
        <input type="text" id="post-title" placeholder="Masalan: 5kg olma">
      </div>
      <div class="form-group">
        <label>Narxi / Xizmat haqi</label>
        <input type="text" id="post-price" placeholder="Masalan: 50,000">
      </div>
      <div class="form-group">
        <label>Tavsif (Tel raqam bilan)</label>
        <textarea id="post-desc" rows="3"></textarea>
      </div>
      <button class="btn btn-block" id="submit-post">E'lonni chiqarish</button>
    </div>
  `;

  const postType = document.getElementById('post-type');
  const extraFields = document.getElementById('extra-fields');

  postType.addEventListener('change', () => {
    if (postType.value === 'orders') {
      extraFields.innerHTML = `
        <div class="form-group">
          <label>📦 Olib ketish joyi</label>
          <input type="text" id="post-from" placeholder="Masalan: Chorsu bozori">
        </div>
        <div class="form-group">
          <label>📍 Yetkazib berish joyi</label>
          <input type="text" id="post-to" placeholder="Masalan: Yunusobod 4-kvartal">
        </div>
      `;
    } else {
      extraFields.innerHTML = '';
    }
  });

  document.getElementById('submit-post').addEventListener('click', handlePostSubmit);
}

function renderProfile() {
  const user = currentUser || {};
  tabContent.innerHTML = `
    <div class="form-container">
      <h3 style="margin-bottom: 1.5rem; text-align: center;">Mening Profilim</h3>
      <div class="form-group">
        <label>Ism</label>
        <input type="text" value="${user.displayName || ''}" disabled>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="text" value="${user.email || ''}" disabled>
      </div>
      <div class="form-group">
        <label>Telefon raqami</label>
        <input type="text" id="profile-phone" value="${user.phone || ''}" placeholder="+998 90 123 45 67">
      </div>
      <button class="btn btn-block" id="save-profile">Saqlash</button>
    </div>
  `;

  document.getElementById('save-profile').addEventListener('click', async () => {
    const phone = document.getElementById('profile-phone').value;
    if (!currentUser || !currentUser.uid) {
      return alert("Xatolik: Tizimga qaytadan kiring!");
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, { phone }, { merge: true });
      
      // Local state-ni yangilash
      currentUser.phone = phone;
      store.set('user', currentUser);
      
      alert("Profil yangilandi!");
    } catch (err) {
      console.error("Profile update error:", err);
      alert("Xatolik yuz berdi: " + err.message);
    }
  });
}

async function handlePostSubmit() {
  if (!currentUser) return alert("Avval tizimga kiring!");
  
  const type = document.getElementById('post-type').value;
  const title = document.getElementById('post-title').value;
  const price = document.getElementById('post-price').value;
  const desc = document.getElementById('post-desc').value;
  const from = document.getElementById('post-from')?.value || '';
  const to = document.getElementById('post-to')?.value || '';

  if (!title || !price) return alert("Hamma maydonlarni to'ldiring!");

  const submitBtn = document.getElementById('submit-post');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saqlanmoqda...';

  const newPost = {
    id: 'l-' + Date.now(), 
    title,
    price,
    desc,
    from,
    to,
    status: 'pending', // Default status
    userName: currentUser.displayName,
    userPhone: currentUser.phone || '',
    userEmail: currentUser.email || '',
    createdAt: new Date().toISOString()
  };

  // 1. Ma'lumotni darhol ko'rsatish (UX uchun)
  const localItems = store.get(type) || [];
  localItems.unshift(newPost);
  store.set(type, localItems);
  
  try {
    // 2. Bazaga saqlash
    await addDoc(collection(db, type), {
      ...newPost,
      id: undefined, 
      createdAt: serverTimestamp(),
      userId: currentUser.uid
    });
    
    alert("E'lon muvaffaqiyatli saqlandi!");
    switchTab(type);
  } catch (err) {
    console.error("Saqlashda xatolik:", err);
    alert("Ma'lumotni bazaga saqlashda xatolik yuz berdi. Lekin u brauzeringizda vaqtincha saqlandi.");
    switchTab(type);
  }
}

async function handleConnect(type, itemId) {
  if (!currentUser) return alert("Avval tizimga kiring!");
  
  try {
    const itemRef = doc(db, type, itemId);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) return alert("E'lon topilmadi.");
    
    const data = snap.data();
    if (data.userId === currentUser.uid) return alert("O'z e'loningizga kuryer bo'la olmaysiz!");

    if (confirm("Ushbu buyurtmani qabul qilmoqchimisiz? Egasi tasdiqlash uchun xabar yuboriladi.")) {
      await updateDoc(itemRef, {
        status: 'accepted',
        courierId: currentUser.uid,
        courierName: currentUser.displayName,
        courierPhone: currentUser.phone || ''
      });
      alert("So'rov yuborildi! Endi buyurtma egasi tasdiqlashini kuting.");
      switchTab(type);
    }
  } catch (err) {
    console.error("Connect error:", err);
    alert("Xatolik: " + err.message);
  }
}

async function handleConfirm(type, itemId) {
  try {
    const itemRef = doc(db, type, itemId);
    await updateDoc(itemRef, { status: 'confirmed' });
    alert("Buyurtma tasdiqlandi! Kuryer endi sizning ma'lumotlaringizni ko'ra oladi.");
    switchTab(type);
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

// Navbar Scroll Effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Navigation logic for logo and menu links
const logo = document.querySelector('.logo');
if (logo) {
  logo.style.cursor = 'pointer';
  logo.addEventListener('click', () => {
    showView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      showView('home');
    }
  });
});

// Hero Dashboard Button logic
document.getElementById('hero-dashboard-btn')?.addEventListener('click', () => {
  if (currentUser) {
    showView('dashboard');
  } else {
    // Agar login qilmagan bo'lsa, Google loginni chaqiramiz
    loginBtn.click();
  }
});
