# database.py
# ============================================================
# قاعدة البيانات — كل الجداول والعمليات
# ============================================================

import sqlite3
from datetime import datetime
from config import DB_PATH


# ============================================================
# تهيئة قاعدة البيانات
# ============================================================

def init_db():
    """ينشئ كل الجداول إذا ما موجودة"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # --- المفاتيح ---
    c.execute('''CREATE TABLE IF NOT EXISTS keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        status TEXT DEFAULT 'active',
        fail_count INTEGER DEFAULT 0,
        last_used TEXT,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # --- القنوات ---
    c.execute('''CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT UNIQUE,
        channel_username TEXT,
        title TEXT,
        active INTEGER DEFAULT 1,
        mood TEXT DEFAULT 'عام',
        silent INTEGER DEFAULT 0,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # --- البذور ---
    c.execute('''CREATE TABLE IF NOT EXISTS seeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT,
        mood TEXT,
        used_count INTEGER DEFAULT 0,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # --- العبارات ---
    c.execute('''CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT,
        mood TEXT,
        channel_id TEXT,
        fingerprint TEXT,
        published INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        published_at TEXT
    )''')

    # --- الإحصائيات ---
    c.execute('''CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT,
        post_id INTEGER,
        hour INTEGER,
        views INTEGER DEFAULT 0,
        date TEXT
    )''')

    # --- السجل اليومي ---
    c.execute('''CREATE TABLE IF NOT EXISTS daily_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE,
        posts_count INTEGER DEFAULT 0
    )''')

    # --- التقارير ---
    c.execute('''CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start TEXT,
        content TEXT,
        sent INTEGER DEFAULT 0
    )''')

    # ============================================================
    # جداول جديدة
    # ============================================================

    # --- الجدول اليدوي (المطور يحدد الأوقات) ---
    c.execute('''CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT,
        hour INTEGER,
        minute INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        mood TEXT DEFAULT 'تأملي',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # --- حسابات إنستكرام ---
    c.execute('''CREATE TABLE IF NOT EXISTS instagram_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT,
        username TEXT,
        password TEXT,
        status TEXT DEFAULT 'active',
        last_check TEXT,
        linked_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # --- الصور المولّدة ---
    c.execute('''CREATE TABLE IF NOT EXISTS generated_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        filepath TEXT,
        template TEXT,
        published_instagram INTEGER DEFAULT 0,
        instagram_error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # --- الأفكار المستخدمة (لمنع التكرار) ---
    c.execute('''CREATE TABLE IF NOT EXISTS used_ideas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idea_summary TEXT,
        mood TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # --- الكلمات في القائمة السوداء ---
    c.execute('''CREATE TABLE IF NOT EXISTS blacklist_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # --- سجل النشر على إنستكرام ---
    c.execute('''CREATE TABLE IF NOT EXISTS instagram_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        image_id INTEGER,
        account_id INTEGER,
        status TEXT,
        error TEXT,
        posted_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    conn.commit()
    conn.close()


def get_conn():
    """يرجع اتصال بقاعدة البيانات"""
    return sqlite3.connect(DB_PATH)


# ============================================================
# المفاتيح
# ============================================================

def add_key(key):
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO keys (key) VALUES (?)", (key,))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def get_active_keys():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, key FROM keys WHERE status='active' ORDER BY fail_count ASC, id ASC")
    rows = c.fetchall()
    conn.close()
    return rows


def get_all_keys():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, key, status, fail_count FROM keys ORDER BY id")
    rows = c.fetchall()
    conn.close()
    return rows


def mark_key_used(key_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE keys SET last_used=datetime('now'), fail_count=0 WHERE id=?", (key_id,))
    conn.commit()
    conn.close()


def mark_key_failed(key_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE keys SET fail_count = fail_count + 1 WHERE id=?", (key_id,))
    c.execute("SELECT fail_count FROM keys WHERE id=?", (key_id,))
    row = c.fetchone()
    if row and row[0] >= 3:
        c.execute("UPDATE keys SET status='failed' WHERE id=?", (key_id,))
    conn.commit()
    conn.close()


def delete_key(key_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM keys WHERE id=?", (key_id,))
    conn.commit()
    conn.close()


def reactivate_key(key_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE keys SET status='active', fail_count=0 WHERE id=?", (key_id,))
    conn.commit()
    conn.close()


# ============================================================
# القنوات
# ============================================================

def add_channel(channel_id, username, title):
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO channels (channel_id, channel_username, title) VALUES (?, ?, ?)",
                  (channel_id, username, title))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def get_channels(active_only=True):
    conn = get_conn()
    c = conn.cursor()
    if active_only:
        c.execute("SELECT id, channel_id, channel_username, title, active, mood, silent FROM channels WHERE active=1")
    else:
        c.execute("SELECT id, channel_id, channel_username, title, active, mood, silent FROM channels")
    rows = c.fetchall()
    conn.close()
    return rows


def toggle_channel(channel_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE channels SET active = 1 - active WHERE channel_id=?", (channel_id,))
    conn.commit()
    conn.close()


def delete_channel(channel_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM channels WHERE channel_id=?", (channel_id,))
    conn.commit()
    conn.close()


def set_channel_mood(channel_id, mood):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE channels SET mood=? WHERE channel_id=?", (mood, channel_id))
    conn.commit()
    conn.close()


def toggle_silent(channel_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE channels SET silent = 1 - silent WHERE channel_id=?", (channel_id,))
    conn.commit()
    conn.close()


# ============================================================
# البذور
# ============================================================

def add_seed(text, mood):
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO seeds (text, mood) VALUES (?, ?)", (text, mood))
    conn.commit()
    conn.close()


def get_seeds(limit=100):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, text, mood, used_count FROM seeds ORDER BY used_count ASC, id DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return rows


def get_seeds_diverse(limit=3):
    """يجيب بذور من نغمات مختلفة"""
    conn = get_conn()
    c = conn.cursor()
    c.execute("""SELECT id, text, mood, used_count FROM seeds
                 WHERE id IN (SELECT MIN(id) FROM seeds GROUP BY mood)
                 ORDER BY RANDOM() LIMIT ?""", (limit,))
    rows = c.fetchall()
    conn.close()
    return rows


def delete_seed(seed_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM seeds WHERE id=?", (seed_id,))
    conn.commit()
    conn.close()


def increment_seed_use(seed_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE seeds SET used_count = used_count + 1 WHERE id=?", (seed_id,))
    conn.commit()
    conn.close()


# ============================================================
# العبارات
# ============================================================

def add_post(text, mood, channel_id, fingerprint):
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO posts (text, mood, channel_id, fingerprint) VALUES (?, ?, ?, ?)",
              (text, mood, channel_id, fingerprint))
    conn.commit()
    conn.close()


def get_pending_posts(limit=50):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, text, mood, channel_id, attempts FROM posts WHERE published=0 AND attempts < 3 LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return rows


def get_published_posts(limit=50):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, text, mood, views, published_at FROM posts WHERE published=1 ORDER BY published_at DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return rows


def get_recent_posts(limit=10):
    """آخر المنشورات — لفحص التشابه"""
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT text FROM posts ORDER BY id DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return rows


def mark_published(post_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE posts SET published=1, published_at=datetime('now') WHERE id=?", (post_id,))
    conn.commit()
    conn.close()


def increment_attempt(post_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE posts SET attempts = attempts + 1 WHERE id=?", (post_id,))
    conn.commit()
    conn.close()


def update_views(post_id, views):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE posts SET views=? WHERE id=?", (views, post_id))
    conn.commit()
    conn.close()


def check_duplicate(fingerprint):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id FROM posts WHERE fingerprint=?", (fingerprint,))
    row = c.fetchone()
    conn.close()
    return row is not None


def get_top_posts(limit=5):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, text, views FROM posts WHERE published=1 ORDER BY views DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return rows


# ============================================================
# الإحصائيات
# ============================================================

def log_stat(channel_id, post_id, hour, views):
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO stats (channel_id, post_id, hour, views, date) VALUES (?, ?, ?, ?, date('now'))",
              (channel_id, post_id, hour, views))
    conn.commit()
    conn.close()


def get_best_hours(channel_id=None, limit=5):
    conn = get_conn()
    c = conn.cursor()
    if channel_id:
        c.execute("""SELECT hour, AVG(views) as avg_views, COUNT(*) as cnt
                     FROM stats WHERE channel_id=? GROUP BY hour
                     HAVING cnt >= 2 ORDER BY avg_views DESC LIMIT ?""", (channel_id, limit))
    else:
        c.execute("""SELECT hour, AVG(views) as avg_views, COUNT(*) as cnt
                     FROM stats GROUP BY hour
                     HAVING cnt >= 2 ORDER BY avg_views DESC LIMIT ?""", (limit,))
    rows = c.fetchall()
    conn.close()
    return rows


def get_weekly_stats():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM posts WHERE published=1 AND published_at >= datetime('now', '-7 days')")
    posts_count = c.fetchone()[0]
    c.execute("SELECT AVG(views) FROM posts WHERE published=1 AND views > 0")
    avg_views = c.fetchone()[0] or 0
    c.execute("SELECT text, views FROM posts WHERE published=1 ORDER BY views DESC LIMIT 1")
    top = c.fetchone()
    conn.close()
    return {"posts_count": posts_count, "avg_views": round(avg_views, 1), "top": top}


# ============================================================
# السجل اليومي
# ============================================================

def can_post_today(max_posts):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT posts_count FROM daily_log WHERE date=date('now')")
    row = c.fetchone()
    conn.close()
    if not row:
        return True
    return row[0] < max_posts


def increment_daily():
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO daily_log (date, posts_count) VALUES (date('now'), 1) ON CONFLICT(date) DO UPDATE SET posts_count = posts_count + 1")
    conn.commit()
    conn.close()


# ============================================================
# التقارير
# ============================================================

def save_report(week_start, content):
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO reports (week_start, content) VALUES (?, ?)", (week_start, content))
    conn.commit()
    conn.close()


def mark_report_sent(report_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE reports SET sent=1 WHERE id=?", (report_id,))
    conn.commit()
    conn.close()


def get_unsent_reports():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, content FROM reports WHERE sent=0")
    rows = c.fetchall()
    conn.close()
    return rows


# ============================================================
# الجدول اليدوي
# ============================================================

def add_schedule(channel_id, hour, minute=0, mood="تأملي"):
    """إضافة وقت نشر للجدول"""
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO schedule (channel_id, hour, minute, mood) VALUES (?, ?, ?, ?)",
              (channel_id, hour, minute, mood))
    conn.commit()
    conn.close()


def get_schedules(active_only=True):
    conn = get_conn()
    c = conn.cursor()
    if active_only:
        c.execute("SELECT id, channel_id, hour, minute, mood, enabled FROM schedule WHERE enabled=1 ORDER BY hour, minute")
    else:
        c.execute("SELECT id, channel_id, hour, minute, mood, enabled FROM schedule ORDER BY hour, minute")
    rows = c.fetchall()
    conn.close()
    return rows


def delete_schedule(schedule_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM schedule WHERE id=?", (schedule_id,))
    conn.commit()
    conn.close()


def toggle_schedule(schedule_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE schedule SET enabled = 1 - enabled WHERE id=?", (schedule_id,))
    conn.commit()
    conn.close()


# ============================================================
# إنستكرام
# ============================================================

def add_instagram_account(channel_id, username, password):
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO instagram_accounts (channel_id, username, password) VALUES (?, ?, ?)",
              (channel_id, username, password))
    conn.commit()
    conn.close()


def get_instagram_accounts(active_only=True):
    conn = get_conn()
    c = conn.cursor()
    if active_only:
        c.execute("SELECT id, channel_id, username, password, status FROM instagram_accounts WHERE status='active'")
    else:
        c.execute("SELECT id, channel_id, username, password, status FROM instagram_accounts")
    rows = c.fetchall()
    conn.close()
    return rows


def get_instagram_account_by_channel(channel_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, channel_id, username, password, status FROM instagram_accounts WHERE channel_id=? AND status='active' LIMIT 1",
              (channel_id,))
    row = c.fetchone()
    conn.close()
    return row


def delete_instagram_account(account_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM instagram_accounts WHERE id=?", (account_id,))
    conn.commit()
    conn.close()


def update_instagram_status(account_id, status):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE instagram_accounts SET status=?, last_check=datetime('now') WHERE id=?",
              (status, account_id))
    conn.commit()
    conn.close()


# ============================================================
# الصور المولّدة
# ============================================================

def save_generated_image(post_id, filepath, template):
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO generated_images (post_id, filepath, template) VALUES (?, ?, ?)",
              (post_id, filepath, template))
    image_id = c.lastrowid
    conn.commit()
    conn.close()
    return image_id


def mark_image_published_instagram(image_id, error=None):
    conn = get_conn()
    c = conn.cursor()
    if error:
        c.execute("UPDATE generated_images SET published_instagram=0, instagram_error=? WHERE id=?",
                  (error, image_id))
    else:
        c.execute("UPDATE generated_images SET published_instagram=1, instagram_error=NULL WHERE id=?",
                  (image_id,))
    conn.commit()
    conn.close()


# ============================================================
# الأفكار المستخدمة
# ============================================================

def save_used_idea(idea_summary, mood):
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO used_ideas (idea_summary, mood) VALUES (?, ?)", (idea_summary, mood))
    conn.commit()
    conn.close()


def get_recent_ideas(limit=20):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT idea_summary FROM used_ideas ORDER BY id DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return [r[0] for r in rows]


# ============================================================
# القائمة السوداء
# ============================================================

def add_blacklist_word(word):
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO blacklist_words (word) VALUES (?)", (word,))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def get_blacklist_words():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT word FROM blacklist_words")
    rows = c.fetchall()
    conn.close()
    return [r[0] for r in rows]


def delete_blacklist_word(word):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM blacklist_words WHERE word=?", (word,))
    conn.commit()
    conn.close()


# ============================================================
# إحصائيات سريعة
# ============================================================

def count_all_posts():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM posts WHERE published=1")
    r = c.fetchone()[0]
    conn.close()
    return r


def count_all_seeds():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM seeds")
    r = c.fetchone()[0]
    conn.close()
    return r


def count_active_keys():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM keys WHERE status='active'")
    r = c.fetchone()[0]
    conn.close()
    return r


def count_active_channels():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM channels WHERE active=1")
    r = c.fetchone()[0]
    conn.close()
    return r


# ============================================================
# النسخ الاحتياطي
# ============================================================

def get_all_data_for_backup():
    conn = get_conn()
    c = conn.cursor()
    data = {}
    for table in ["keys", "channels", "seeds", "posts", "stats",
                  "schedule", "instagram_accounts", "used_ideas",
                  "blacklist_words"]:
        try:
            c.execute(f"SELECT * FROM {table}")
            data[table] = c.fetchall()
        except Exception:
            data[table] = []
    conn.close()
    return data