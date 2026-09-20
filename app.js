// app.js
// ============================================================
// تطبيق Mini App — الاتصال بـ API
// ============================================================

// ⚠️ ⚠️ ⚠️ مهم: غيّر هذا الرابط بعد ما ترفع Vercel ⚠️ ⚠️ ⚠️
// راح يكون: https://gfdxf.serv00.net:12731
const API_BASE_URL = '/api';

// ============================================================
// الحالة العامة
// ============================================================

const State = {
    initData: '',
    user: null,
    currentPage: 'dashboard',
    currentPostTab: 'pending',
    channels: [],
    posts: { pending: [], published: [] },
    seeds: [],
    keys: [],
    stats: {}
};

// ============================================================
// Telegram WebApp
// ============================================================

const tg = window.Telegram?.WebApp;

function initTelegram() {
    if (!tg) {
        showToast('⚠️ يجب فتح التطبيق من داخل تيليجرام', 'error');
        return false;
    }

    tg.ready();
    tg.expand();

    // معلومات المستخدم
    State.user = tg.initDataUnsafe?.user;
    if (State.user) {
        document.getElementById('user-display').textContent = State.user.first_name || 'مستخدم';
    }

    // initData للتحقق
    State.initData = tg.initData || '';

    if (!State.initData) {
        showToast('⚠️ لا يمكن التحقق من الهوية', 'error');
        return false;
    }

    return true;
}

// ============================================================
// طلبات API
// ============================================================

async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': State.initData
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`[API] ${endpoint}:`, error);
        throw error;
    }
}

// ============================================================
// التنقل
// ============================================================

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            switchPage(page);
        });
    });
}

function switchPage(pageName) {
    // إخفاء كل الصفحات
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // إظهار الصفحة المطلوبة
    const page = document.getElementById(`page-${pageName}`);
    const btn = document.querySelector(`.nav-btn[data-page="${pageName}"]`);

    if (page) page.classList.add('active');
    if (btn) btn.classList.add('active');

    State.currentPage = pageName;

    // تحميل البيانات
    loadPageData(pageName);
}

function loadPageData(pageName) {
    switch (pageName) {
        case 'dashboard':
            loadStats();
            loadRecentPosts();
            break;
        case 'channels':
            loadChannels();
            break;
        case 'posts':
            loadPosts();
            break;
        case 'seeds':
            loadSeeds();
            break;
        case 'settings':
            // لا يحتاج تحميل
            break;
    }
}

// ============================================================
// الإحصائيات
// ============================================================

async function loadStats() {
    try {
        const result = await apiCall('/api/stats');
        if (result.ok) {
            State.stats = result.data;
            document.getElementById('stat-posts').textContent = result.data.total_posts || 0;
            document.getElementById('stat-seeds').textContent = result.data.total_seeds || 0;
            document.getElementById('stat-channels').textContent = result.data.active_channels || 0;
            document.getElementById('stat-keys').textContent = result.data.active_keys || 0;
        }
    } catch (error) {
        showToast('فشل تحميل الإحصائيات', 'error');
    }
}

// ============================================================
// المنشورات
// ============================================================

async function loadRecentPosts() {
    const container = document.getElementById('recent-posts');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/api/posts');
        if (result.ok && result.data.published?.length > 0) {
            container.innerHTML = result.data.published.slice(0, 5).map(post => `
                <div class="post-item">
                    <div class="post-text">${escapeHtml(post.text)}</div>
                    <div class="post-meta">
                        <span class="post-mood">${escapeHtml(post.mood || 'عام')}</span>
                        <span class="post-views">👁️ ${post.views || 0}</span>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="empty-state">لا توجد منشورات بعد</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state">فشل التحميل</div>';
    }
}

async function loadPosts() {
    const container = document.getElementById('posts-list');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/api/posts');
        if (result.ok) {
            State.posts = result.data;
            renderPosts();
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state">فشل التحميل</div>';
    }
}

function renderPosts() {
    const container = document.getElementById('posts-list');
    const posts = State.currentPostTab === 'pending'
        ? State.posts.pending
        : State.posts.published;

    if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد عبارات</div>';
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="post-item">
            <div class="post-text">${escapeHtml(post.text)}</div>
            <div class="post-meta">
                <span class="post-mood">${escapeHtml(post.mood || 'عام')}</span>
                ${State.currentPostTab === 'published'
                    ? `<span class="post-views">👁️ ${post.views || 0}</span>`
                    : `<span class="post-views">⏳ محاولات: ${post.attempts || 0}</span>`
                }
            </div>
        </div>
    `).join('');
}

function switchPostTab(tab) {
    State.currentPostTab = tab;
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    renderPosts();
}

// ============================================================
// القنوات
// ============================================================

async function loadChannels() {
    const container = document.getElementById('channels-list');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/api/channels');
        if (result.ok) {
            State.channels = result.data;
            renderChannels();
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state">فشل التحميل</div>';
    }
}

function renderChannels() {
    const container = document.getElementById('channels-list');

    if (!State.channels || State.channels.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد قنوات</div>';
        return;
    }

    container.innerHTML = State.channels.map(ch => `
        <div class="channel-card">
            <div class="channel-status ${ch.active ? 'active' : 'inactive'}"></div>
            <div class="channel-info">
                <h4>${escapeHtml(ch.title || ch.username)}</h4>
                <p>${escapeHtml(ch.username)} • ${escapeHtml(ch.mood)}</p>
            </div>
            <div class="channel-actions">
                <button class="icon-btn" onclick="App.toggleChannel('${ch.channel_id}')" title="تفعيل/تعطيل">
                    ${ch.active ? '⏸️' : '▶️'}
                </button>
                <button class="icon-btn" onclick="App.deleteChannel('${ch.channel_id}')" title="حذف">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

async function toggleChannel(channelId) {
    try {
        await apiCall('/api/channel/toggle', 'POST', { channel_id: channelId });
        showToast('تم التبديل', 'success');
        loadChannels();
    } catch (error) {
        showToast('فشل التبديل', 'error');
    }
}

async function deleteChannel(channelId) {
    if (!confirm('هل أنت متأكد من حذف القناة؟')) return;
    try {
        await apiCall('/api/channel/delete', 'POST', { channel_id: channelId });
        showToast('تم الحذف', 'success');
        loadChannels();
    } catch (error) {
        showToast('فشل الحذف', 'error');
    }
}

function showAddChannel() {
    showModal('إضافة قناة', `
        <div class="form-group">
            <label>معرف القناة (ID)</label>
            <input type="text" class="form-input" id="new-channel-id" placeholder="-1001234567890">
        </div>
        <div class="form-group">
            <label>اسم المستخدم</label>
            <input type="text" class="form-input" id="new-channel-username" placeholder="@channel">
        </div>
        <div class="form-group">
            <label>العنوان</label>
            <input type="text" class="form-input" id="new-channel-title" placeholder="اسم القناة">
        </div>
        <button class="action-btn full-width gradient-purple" onclick="App.saveChannel()">
            حفظ
        </button>
    `);
}

async function saveChannel() {
    const channelId = document.getElementById('new-channel-id').value.trim();
    const username = document.getElementById('new-channel-username').value.trim();
    const title = document.getElementById('new-channel-title').value.trim();

    if (!channelId || !username) {
        showToast('املأ الحقول المطلوبة', 'error');
        return;
    }

    try {
        await apiCall('/api/channel/add', 'POST', {
            channel_id: channelId,
            username,
            title
        });
        showToast('تمت الإضافة', 'success');
        closeModal();
        loadChannels();
    } catch (error) {
        showToast('فشل الحفظ', 'error');
    }
}

// ============================================================
// البذور
// ============================================================

async function loadSeeds() {
    const container = document.getElementById('seeds-list');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/api/seeds');
        if (result.ok) {
            State.seeds = result.data;
            renderSeeds();
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state">فشل التحميل</div>';
    }
}

function renderSeeds() {
    const container = document.getElementById('seeds-list');

    if (!State.seeds || State.seeds.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد بذور</div>';
        return;
    }

    container.innerHTML = State.seeds.map(seed => `
        <div class="post-item">
            <div class="post-text">${escapeHtml(seed.text)}</div>
            <div class="post-meta">
                <span class="post-mood">${escapeHtml(seed.mood || 'عام')}</span>
                <span class="post-views">استُخدمت: ${seed.used_count}</span>
            </div>
        </div>
    `).join('');
}

function showAddSeed() {
    showModal('إضافة بذرة', `
        <div class="form-group">
            <label>نص البذرة</label>
            <textarea class="form-textarea" id="new-seed-text" placeholder="اكتب بذرة..."></textarea>
        </div>
        <div class="form-group">
            <label>النغمة</label>
            <select class="form-select" id="new-seed-mood">
                <option value="حزين">حزين</option>
                <option value="فلسفي">فلسفي</option>
                <option value="تحفيزي">تحفيزي</option>
                <option value="تأملي" selected>تأملي</option>
                <option value="ساخر">ساخر</option>
            </select>
        </div>
        <button class="action-btn full-width gradient-purple" onclick="App.saveSeed()">
            حفظ
        </button>
    `);
}

async function saveSeed() {
    const text = document.getElementById('new-seed-text').value.trim();
    const mood = document.getElementById('new-seed-mood').value;

    if (!text) {
        showToast('اكتب البذرة', 'error');
        return;
    }

    try {
        await apiCall('/api/seed/add', 'POST', { text, mood });
        showToast('تمت الإضافة', 'success');
        closeModal();
        loadSeeds();
    } catch (error) {
        showToast('فشل الحفظ', 'error');
    }
}

// ============================================================
// المفاتيح
// ============================================================

async function openKeys() {
    try {
        const result = await apiCall('/api/keys');
        if (result.ok) {
            const keys = result.data;
            showModal('مفاتيح Groq', `
                ${keys.length === 0 ? '<div class="empty-state">لا توجد مفاتيح</div>' :
                    keys.map(k => `
                        <div class="post-item" style="margin-bottom: 8px;">
                            <div class="post-text" style="font-family: monospace; font-size: 12px;">${escapeHtml(k.key)}</div>
                            <div class="post-meta">
                                <span class="post-mood">${k.status === 'active' ? '✅ نشط' : '❌ فاشل'}</span>
                                <span class="post-views">فشل: ${k.fail_count}</span>
                            </div>
                        </div>
                    `).join('')
                }
                <button class="action-btn full-width gradient-purple" style="margin-top: 12px;" onclick="App.showAddKey()">
                    ➕ إضافة مفتاح
                </button>
            `);
        }
    } catch (error) {
        showToast('فشل التحميل', 'error');
    }
}

function showAddKey() {
    showModal('إضافة مفتاح', `
        <div class="form-group">
            <label>مفتاح Groq</label>
            <input type="text" class="form-input" id="new-key" placeholder="gsk_...">
        </div>
        <button class="action-btn full-width gradient-purple" onclick="App.saveKey()">
            حفظ
        </button>
    `);
}

async function saveKey() {
    const key = document.getElementById('new-key').value.trim();
    if (!key) {
        showToast('أدخل المفتاح', 'error');
        return;
    }

    try {
        await apiCall('/api/key/add', 'POST', { key });
        showToast('تمت الإضافة', 'success');
        closeModal();
    } catch (error) {
        showToast('فشل الحفظ', 'error');
    }
}

// ============================================================
// الجدول
// ============================================================

async function openSchedule() {
    showModal('جدول النشر', `
        <div class="empty-state">
            إدارة الجدول — قريباً<br>
            <small>سيتم عرض أوقات النشر المحددة هنا</small>
        </div>
    `);
}

// ============================================================
// الإجراءات السريعة
// ============================================================

async function generatePost() {
    showToast('جاري التوليد...', 'info');
    try {
        // نستخدم أول بذرة
        const seedsResult = await apiCall('/api/seeds');
        if (!seedsResult.ok || !seedsResult.data?.length) {
            showToast('لا توجد بذور', 'error');
            return;
        }
        const seed = seedsResult.data[0];
        const result = await apiCall('/api/generate', 'POST', {
            seed: seed.text,
            mood: seed.mood
        });
        if (result.ok) {
            showToast('تم التوليد ✨', 'success');
            loadRecentPosts();
        } else {
            showToast(result.error || 'فشل التوليد', 'error');
        }
    } catch (error) {
        showToast('فشل التوليد', 'error');
    }
}

async function publishNow() {
    if (!confirm('نشر منشور الآن؟')) return;
    showToast('جاري النشر...', 'info');
    // ملاحظة: هذا الـ endpoint مو موجود في API حالياً
    // يمكن إضافته لاحقاً
    showToast('الميزة قيد التطوير', 'info');
}

async function createBackup() {
    showToast('جاري إنشاء النسخة...', 'info');
    try {
        const result = await apiCall('/api/backup', 'POST');
        if (result.ok) {
            showToast('✅ تم إنشاء النسخة', 'success');
        } else {
            showToast(result.error || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل النسخ الاحتياطي', 'error');
    }
}

async function sendReport() {
    showToast('جاري الإرسال...', 'info');
    try {
        const result = await apiCall('/api/report', 'POST');
        if (result.ok) {
            showToast('✅ تم إرسال التقرير', 'success');
        } else {
            showToast(result.error || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل الإرسال', 'error');
    }
}

async function reverseSeed() {
    showToast('جاري التوليد العكسي...', 'info');
    // يحتاج endpoint في API — نضيفه لاحقاً
    showToast('الميزة قيد التطوير', 'info');
}

function showBlacklist() {
    showModal('الكلمات الممنوعة', `
        <div class="empty-state">
            إدارة القائمة السوداء — قريباً
        </div>
    `);
}

// ============================================================
// Modal
// ============================================================

function showModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

// ============================================================
// Toast
// ============================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================
// أدوات
// ============================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// التشغيل
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // التحقق من تيليجرام
    if (!initTelegram()) {
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            document.getElementById('user-display').textContent = 'وضع تجريبي';
            switchPage('dashboard');
        }, 500);
        return;
    }

    // إعداد التنقل
    setupNavigation();

    // إخفاء شاشة التحميل
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        switchPage('dashboard');
    }, 500);
});

// ============================================================
// API للنافذة العالمية (للأزرار)
// ============================================================

window.App = {
    generatePost,
    publishNow,
    createBackup,
    sendReport,
    reverseSeed,
    showBlacklist,
    showAddChannel,
    saveChannel,
    toggleChannel,
    deleteChannel,
    showAddSeed,
    saveSeed,
    openKeys,
    showAddKey,
    saveKey,
    openSchedule,
    loadChannels,
    loadSeeds,
    loadPosts,
    switchPostTab,
    closeModal
};
