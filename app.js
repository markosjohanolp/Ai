// app.js
// ============================================================
// Mini App — كامل
// ============================================================

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
    schedules: [],
    instagram: [],
    blacklist: [],
    stats: {}
};

// ============================================================
// Telegram WebApp
// ============================================================

const tg = window.Telegram?.WebApp;

function initTelegram() {
    if (!tg) {
        showToast('⚠️ افتح التطبيق من داخل تيليجرام', 'error');
        return false;
    }
    tg.ready();
    tg.expand();

    State.user = tg.initDataUnsafe?.user;
    if (State.user) {
        document.getElementById('user-display').textContent =
            State.user.first_name || 'مستخدم';
    }

    State.initData = tg.initData || '';

    if (!State.initData) {
        showToast('⚠️ لا يمكن التحقق من الهوية', 'error');
        return false;
    }
    return true;
}

// ============================================================
// API
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
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`رد غير صالح: ${text.substring(0, 100)}`);
        }

        if (!response.ok && !data.error) {
            throw new Error(`HTTP ${response.status}`);
        }
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
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
}

function switchPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const page = document.getElementById(`page-${pageName}`);
    const btn = document.querySelector(`.nav-btn[data-page="${pageName}"]`);

    if (page) page.classList.add('active');
    if (btn) btn.classList.add('active');

    State.currentPage = pageName;
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
        case 'schedule':
            loadSchedules();
            break;
        case 'instagram':
            loadInstagram();
            break;
        case 'keys':
            loadKeys();
            break;
        case 'settings':
            // لا يحتاج تحميل
            break;
    }
}

// ============================================================
// Stats
// ============================================================

async function loadStats() {
    try {
        const result = await apiCall('/stats');
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
// Posts
// ============================================================

async function loadRecentPosts() {
    const container = document.getElementById('recent-posts');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/posts');
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
        const result = await apiCall('/posts');
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
// Channels
// ============================================================

async function loadChannels() {
    const container = document.getElementById('channels-list');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/channels');
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
                <p>${escapeHtml(ch.username)} • ${escapeHtml(ch.mood)}${ch.silent ? ' 🔇' : ''}</p>
            </div>
            <div class="channel-actions">
                <button class="icon-btn" onclick="App.toggleChannel('${ch.channel_id}')" title="تفعيل/تعطيل">
                    ${ch.active ? '⏸️' : '▶️'}
                </button>
                <button class="icon-btn" onclick="App.changeMood('${ch.channel_id}', '${ch.mood}')" title="تغيير النغمة">
                    🎭
                </button>
                <button class="icon-btn" onclick="App.toggleSilent('${ch.channel_id}')" title="وضع الصمت">
                    ${ch.silent ? '🔊' : '🔇'}
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
        await apiCall('/channel/toggle', 'POST', { channel_id: channelId });
        showToast('تم التبديل', 'success');
        loadChannels();
    } catch (error) {
        showToast('فشل التبديل', 'error');
    }
}

async function deleteChannel(channelId) {
    if (!confirm('حذف القناة؟')) return;
    try {
        await apiCall('/channel/delete', 'POST', { channel_id: channelId });
        showToast('تم الحذف', 'success');
        loadChannels();
    } catch (error) {
        showToast('فشل الحذف', 'error');
    }
}

async function toggleSilent(channelId) {
    try {
        await apiCall('/channel/silent', 'POST', { channel_id: channelId });
        showToast('تم تبديل وضع الصمت', 'success');
        loadChannels();
    } catch (error) {
        showToast('فشل', 'error');
    }
}

function changeMood(channelId, currentMood) {
    const moods = ['حزين', 'فلسفي', 'تحفيزي', 'تأملي', 'ساخر'];
    showModal('تغيير النغمة', `
        <div class="form-group">
            <label>النغمة الحالية: ${escapeHtml(currentMood)}</label>
            <select class="form-select" id="mood-select">
                ${moods.map(m => `<option value="${m}" ${m === currentMood ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
        </div>
        <button class="action-btn full-width gradient-purple" onclick="App.saveMood('${channelId}')">
            حفظ
        </button>
    `);
}

async function saveMood(channelId) {
    const mood = document.getElementById('mood-select').value;
    try {
        await apiCall('/channel/mood', 'POST', { channel_id: channelId, mood });
        showToast('تم التغيير', 'success');
        closeModal();
        loadChannels();
    } catch (error) {
        showToast('فشل', 'error');
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
        <button class="action-btn full-width gradient-purple" onclick="App.saveChannel()">حفظ</button>
    `);
}

async function saveChannel() {
    const channel_id = document.getElementById('new-channel-id').value.trim();
    const username = document.getElementById('new-channel-username').value.trim();
    const title = document.getElementById('new-channel-title').value.trim();

    if (!channel_id || !username) {
        showToast('املأ الحقول المطلوبة', 'error');
        return;
    }

    try {
        const result = await apiCall('/channel/add', 'POST', { channel_id, username, title });
        if (result.ok) {
            showToast('تمت الإضافة', 'success');
            closeModal();
            loadChannels();
        } else {
            showToast(result.message || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل الحفظ', 'error');
    }
}

// ============================================================
// Seeds
// ============================================================

async function loadSeeds() {
    const container = document.getElementById('seeds-list');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/seeds');
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
                <button class="icon-btn" style="width: 28px; height: 28px; font-size: 14px;" onclick="App.deleteSeed(${seed.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function deleteSeed(seedId) {
    if (!confirm('حذف البذرة؟')) return;
    try {
        await apiCall('/seed/delete', 'POST', { id: seedId });
        showToast('تم الحذف', 'success');
        loadSeeds();
    } catch (error) {
        showToast('فشل الحذف', 'error');
    }
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
        <button class="action-btn full-width gradient-purple" onclick="App.saveSeed()">حفظ</button>
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
        await apiCall('/seed/add', 'POST', { text, mood });
        showToast('تمت الإضافة', 'success');
        closeModal();
        loadSeeds();
    } catch (error) {
        showToast('فشل الحفظ', 'error');
    }
}

// ============================================================
// Keys
// ============================================================

async function loadKeys() {
    const container = document.getElementById('keys-list');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/keys');
        if (result.ok) {
            State.keys = result.data;
            renderKeys();
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state">فشل التحميل</div>';
    }
}

function renderKeys() {
    const container = document.getElementById('keys-list');
    if (!State.keys || State.keys.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد مفاتيح</div>';
        return;
    }

    container.innerHTML = State.keys.map(k => `
        <div class="post-item">
            <div class="post-text" style="font-family: monospace; font-size: 12px;">${escapeHtml(k.key)}</div>
            <div class="post-meta">
                <span class="post-mood">${k.status === 'active' ? '✅ نشط' : '❌ فاشل'}</span>
                <span class="post-views">فشل: ${k.fail_count}</span>
                <button class="icon-btn" style="width: 28px; height: 28px; font-size: 14px;" onclick="App.deleteKey(${k.id})">🗑️</button>
                ${k.status !== 'active'
                    ? `<button class="icon-btn" style="width: 28px; height: 28px; font-size: 14px;" onclick="App.reactivateKey(${k.id})">🔄</button>`
                    : ''
                }
            </div>
        </div>
    `).join('');
}

async function deleteKey(keyId) {
    if (!confirm('حذف المفتاح؟')) return;
    try {
        await apiCall('/key/delete', 'POST', { id: keyId });
        showToast('تم الحذف', 'success');
        loadKeys();
    } catch (error) {
        showToast('فشل', 'error');
    }
}

async function reactivateKey(keyId) {
    try {
        await apiCall('/key/reactivate', 'POST', { id: keyId });
        showToast('تم إعادة التفعيل', 'success');
        loadKeys();
    } catch (error) {
        showToast('فشل', 'error');
    }
}

function showAddKey() {
    showModal('إضافة مفتاح', `
        <div class="form-group">
            <label>مفتاح Groq</label>
            <input type="text" class="form-input" id="new-key" placeholder="gsk_...">
        </div>
        <button class="action-btn full-width gradient-purple" onclick="App.saveKey()">حفظ</button>
    `);
}

async function saveKey() {
    const key = document.getElementById('new-key').value.trim();
    if (!key) {
        showToast('أدخل المفتاح', 'error');
        return;
    }
    try {
        const result = await apiCall('/key/add', 'POST', { key });
        if (result.ok) {
            showToast('تمت الإضافة', 'success');
            closeModal();
            loadKeys();
        } else {
            showToast(result.message || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل', 'error');
    }
}

// ============================================================
// Schedule
// ============================================================

async function loadSchedules() {
    const container = document.getElementById('schedule-list');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/schedule');
        if (result.ok) {
            State.schedules = result.data;
            renderSchedules();
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state">فشل التحميل</div>';
    }
}

function renderSchedules() {
    const container = document.getElementById('schedule-list');
    if (!State.schedules || State.schedules.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد أوقات نشر</div>';
        return;
    }

    container.innerHTML = State.schedules.map(s => `
        <div class="post-item">
            <div class="post-text" style="font-size: 18px; font-weight: 700;">
                🕐 ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}
            </div>
            <div class="post-meta">
                <span class="post-mood">${escapeHtml(s.mood)}</span>
                <span class="post-views">${s.enabled ? '✅ مفعّل' : '⏸️ موقوف'}</span>
                <button class="icon-btn" style="width: 28px; height: 28px; font-size: 14px;" onclick="App.toggleSchedule(${s.id})">
                    ${s.enabled ? '⏸️' : '▶️'}
                </button>
                <button class="icon-btn" style="width: 28px; height: 28px; font-size: 14px;" onclick="App.deleteSchedule(${s.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function toggleSchedule(id) {
    try {
        await apiCall('/schedule/toggle', 'POST', { id });
        showToast('تم التبديل', 'success');
        loadSchedules();
    } catch (error) {
        showToast('فشل', 'error');
    }
}

async function deleteSchedule(id) {
    if (!confirm('حذف وقت النشر؟')) return;
    try {
        await apiCall('/schedule/delete', 'POST', { id });
        showToast('تم الحذف', 'success');
        loadSchedules();
    } catch (error) {
        showToast('فشل', 'error');
    }
}

function showAddSchedule() {
    const channelsOptions = State.channels.map(c =>
        `<option value="${c.channel_id}">${escapeHtml(c.title || c.username)}</option>`
    ).join('');

    showModal('إضافة وقت نشر', `
        <div class="form-group">
            <label>القناة</label>
            <select class="form-select" id="new-schedule-channel">
                <option value="">كل القنوات</option>
                ${channelsOptions}
            </select>
        </div>
        <div class="form-group">
            <label>الساعة (0-23)</label>
            <input type="number" class="form-input" id="new-schedule-hour" min="0" max="23" value="12">
        </div>
        <div class="form-group">
            <label>الدقيقة (0-59)</label>
            <input type="number" class="form-input" id="new-schedule-minute" min="0" max="59" value="0">
        </div>
        <div class="form-group">
            <label>النغمة</label>
            <select class="form-select" id="new-schedule-mood">
                <option value="حزين">حزين</option>
                <option value="فلسفي">فلسفي</option>
                <option value="تحفيزي">تحفيزي</option>
                <option value="تأملي" selected>تأملي</option>
                <option value="ساخر">ساخر</option>
            </select>
        </div>
        <button class="action-btn full-width gradient-purple" onclick="App.saveSchedule()">حفظ</button>
    `);
}

async function saveSchedule() {
    const channel_id = document.getElementById('new-schedule-channel').value;
    const hour = document.getElementById('new-schedule-hour').value;
    const minute = document.getElementById('new-schedule-minute').value;
    const mood = document.getElementById('new-schedule-mood').value;

    try {
        await apiCall('/schedule/add', 'POST', {
            channel_id, hour, minute, mood
        });
        showToast('تمت الإضافة', 'success');
        closeModal();
        loadSchedules();
    } catch (error) {
        showToast('فشل الحفظ', 'error');
    }
}

// ============================================================
// Instagram
// ============================================================

async function loadInstagram() {
    const container = document.getElementById('instagram-list');
    container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    try {
        const result = await apiCall('/instagram');
        if (result.ok) {
            State.instagram = result.data;
            renderInstagram();
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state">فشل التحميل</div>';
    }
}

function renderInstagram() {
    const container = document.getElementById('instagram-list');
    if (!State.instagram || State.instagram.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد حسابات مرتبطة</div>';
        return;
    }

    container.innerHTML = State.instagram.map(acc => `
        <div class="post-item">
            <div class="post-text">📷 @${escapeHtml(acc.username)}</div>
            <div class="post-meta">
                <span class="post-mood">${acc.status === 'active' ? '✅ نشط' : '❌'}</span>
                <button class="icon-btn" style="width: 28px; height: 28px; font-size: 14px;" onclick="App.unlinkInstagram(${acc.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function unlinkInstagram(id) {
    if (!confirm('فصل الحساب؟')) return;
    try {
        await apiCall('/instagram/unlink', 'POST', { id });
        showToast('تم الفصل', 'success');
        loadInstagram();
    } catch (error) {
        showToast('فشل', 'error');
    }
}

function showAddInstagram() {
    const channelsOptions = State.channels.map(c =>
        `<option value="${c.channel_id}">${escapeHtml(c.title || c.username)}</option>`
    ).join('');

    showModal('ربط حساب إنستكرام', `
        <div class="form-group">
            <label>القناة</label>
            <select class="form-select" id="new-instagram-channel">
                ${channelsOptions}
            </select>
        </div>
        <div class="form-group">
            <label>يوزر إنستكرام</label>
            <input type="text" class="form-input" id="new-instagram-username" placeholder="username">
        </div>
        <div class="form-group">
            <label>كلمة المرور</label>
            <input type="password" class="form-input" id="new-instagram-password" placeholder="••••••">
        </div>
        <button class="action-btn full-width gradient-pink" onclick="App.saveInstagram()">ربط</button>
    `);
}

async function saveInstagram() {
    const channel_id = document.getElementById('new-instagram-channel').value;
    const username = document.getElementById('new-instagram-username').value.trim();
    const password = document.getElementById('new-instagram-password').value;

    if (!channel_id || !username || !password) {
        showToast('املأ كل الحقول', 'error');
        return;
    }

    try {
        const result = await apiCall('/instagram/add', 'POST', {
            channel_id, username, password
        });
        if (result.ok) {
            showToast('تم الربط', 'success');
            closeModal();
            loadInstagram();
        } else {
            showToast(result.error || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل', 'error');
    }
}

// ============================================================
// Blacklist
// ============================================================

async function showBlacklist() {
    const container = document.getElementById('modal-body');
    showModal('الكلمات الممنوعة', '<div class="empty-state">جاري التحميل...</div>');

    try {
        const result = await apiCall('/blacklist');
        if (result.ok) {
            const words = result.data;
            document.getElementById('modal-body').innerHTML = `
                <div style="margin-bottom: 16px;">
                    <div class="form-group">
                        <input type="text" class="form-input" id="new-blacklist-word" placeholder="أضف كلمة...">
                    </div>
                    <button class="action-btn full-width gradient-pink" onclick="App.addBlacklist()">➕ إضافة</button>
                </div>
                ${words.length === 0
                    ? '<div class="empty-state">لا توجد كلمات</div>'
                    : words.map(w => `
                        <div class="post-item" style="margin-bottom: 6px;">
                            <div class="post-meta">
                                <span>${escapeHtml(w)}</span>
                                <button class="icon-btn" style="width: 28px; height: 28px; font-size: 14px;" onclick="App.deleteBlacklist('${escapeHtml(w)}')">🗑️</button>
                            </div>
                        </div>
                    `).join('')
                }
            `;
        }
    } catch (error) {
        showToast('فشل التحميل', 'error');
    }
}

async function addBlacklist() {
    const word = document.getElementById('new-blacklist-word').value.trim();
    if (!word) return;
    try {
        await apiCall('/blacklist/add', 'POST', { word });
        showToast('تمت الإضافة', 'success');
        showBlacklist();
    } catch (error) {
        showToast('فشل', 'error');
    }
}

async function deleteBlacklist(word) {
    try {
        await apiCall('/blacklist/delete', 'POST', { word });
        showToast('تم الحذف', 'success');
        showBlacklist();
    } catch (error) {
        showToast('فشل', 'error');
    }
}

// ============================================================
// Quick Actions
// ============================================================

async function generatePost() {
    showToast('جاري التوليد...', 'info');
    try {
        const seedsResult = await apiCall('/seeds');
        if (!seedsResult.ok || !seedsResult.data?.length) {
            showToast('لا توجد بذور', 'error');
            return;
        }
        const seed = seedsResult.data[0];
        const result = await apiCall('/generate', 'POST', {
            seed: seed.text, mood: seed.mood
        });
        if (result.ok) {
            showToast('✅ تم التوليد', 'success');
            if (State.currentPage === 'dashboard') loadRecentPosts();
        } else {
            showToast(result.error || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل التوليد', 'error');
    }
}

async function publishNow() {
    if (!confirm('نشر منشور الآن؟')) return;
    showToast('جاري النشر...', 'info');
    try {
        const result = await apiCall('/publish-now', 'POST');
        if (result.ok) {
            showToast('✅ تم النشر', 'success');
            loadRecentPosts();
        } else {
            showToast(result.error || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل النشر', 'error');
    }
}

async function createBackup() {
    showToast('جاري إنشاء النسخة...', 'info');
    try {
        const result = await apiCall('/backup', 'POST');
        if (result.ok) {
            showToast('✅ تم إنشاء النسخة', 'success');
        } else {
            showToast(result.error || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل', 'error');
    }
}

async function sendReport() {
    showToast('جاري الإرسال...', 'info');
    try {
        const result = await apiCall('/report', 'POST');
        if (result.ok) {
            showToast('✅ تم الإرسال', 'success');
        } else {
            showToast(result.error || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل', 'error');
    }
}

async function reverseSeed() {
    showToast('جاري التوليد العكسي...', 'info');
    try {
        const result = await apiCall('/reverse-seed', 'POST');
        if (result.ok) {
            showToast('✅ تم التوليد', 'success');
            if (result.data?.text) {
                showModal('عبارة جديدة', `
                    <div class="post-item">
                        <div class="post-text">${escapeHtml(result.data.text)}</div>
                        <div class="post-meta">
                            <span class="post-mood">${escapeHtml(result.data.mood)}</span>
                        </div>
                    </div>
                `);
            }
        } else {
            showToast(result.error || 'فشل', 'error');
        }
    } catch (error) {
        showToast('فشل', 'error');
    }
}

async function showBestHours() {
    try {
        const result = await apiCall('/best-hours');
        if (result.ok) {
            const hours = result.data;
            showModal('أفضل أوقات النشر', `
                ${hours.length === 0
                    ? '<div class="empty-state">لا توجد بيانات كافية</div>'
                    : hours.map(h => `
                        <div class="post-item" style="margin-bottom: 6px;">
                            <div class="post-text">🕐 الساعة ${h.hour}:00</div>
                            <div class="post-meta">
                                <span class="post-views">متوسط: ${h.avg_views} مشاهدة</span>
                            </div>
                        </div>
                    `).join('')
                }
            `);
        }
    } catch (error) {
        showToast('فشل', 'error');
    }
}

// ============================================================
// Modal & Toast
// ============================================================

function showModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// Start
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (!initTelegram()) {
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            document.getElementById('user-display').textContent = 'وضع تجريبي';
            setupNavigation();
            switchPage('dashboard');
        }, 500);
        return;
    }

    setupNavigation();

    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        switchPage('dashboard');
    }, 300);
});

// ============================================================
// Global API
// ============================================================

window.App = {
    // Quick actions
    generatePost, publishNow, createBackup, sendReport, reverseSeed,
    showBestHours, showBlacklist, addBlacklist, deleteBlacklist,
    // Channels
    showAddChannel, saveChannel, toggleChannel, deleteChannel,
    changeMood, saveMood, toggleSilent, loadChannels,
    // Seeds
    showAddSeed, saveSeed, deleteSeed, loadSeeds,
    // Keys
    showAddKey, saveKey, deleteKey, reactivateKey, loadKeys,
    // Schedule
    showAddSchedule, saveSchedule, toggleSchedule, deleteSchedule, loadSchedules,
    // Instagram
    showAddInstagram, saveInstagram, unlinkInstagram, loadInstagram,
    // Posts
    loadPosts, switchPostTab,
    // Modal
    closeModal
};
