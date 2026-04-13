require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const db = require('./database');
const { workerKeyboard, deliveryKeyboard, adminKeyboard } = require('./keyboards');
const { registrationWizard, deliveryRegWizard, addJobWizard, addOrderWizard, editNameWizard, editPhoneWizard, editRegionWizard } = require('./scenes');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

// Setup Session
const localSession = new LocalSession({ database: 'session_db.json' });
bot.use(localSession.middleware());

// Setup Stage (Scenes)
const stage = new Scenes.Stage([registrationWizard, deliveryRegWizard, addJobWizard, addOrderWizard, editNameWizard, editPhoneWizard, editRegionWizard]);
bot.use(stage.middleware());

// Helper function to get user from DB
const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// Middleware to check blocked users
bot.use((ctx, next) => {
    if (ctx.from) {
        if (ctx.from.id === ADMIN_ID) return next(); // Admin hech qachon bloklanmaydi
        const user = getUser(ctx.from.id);
        if (user && user.is_blocked === 1) {
            return ctx.reply("Sizning hisobingiz bloklangan.");
        }
    }
    return next();
});

// START
bot.start((ctx) => {
    const user = getUser(ctx.from.id);
    if (!user) {
        return ctx.scene.enter('registration');
    }
    
    if (user.mode === 'delivery') {
        ctx.reply("Siz delivery rejimidasiz.", deliveryKeyboard);
    } else {
        ctx.reply("Asosiy menyu.", workerKeyboard);
    }
});

// ADMIN MENU
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("Admin menyusiga xush kelibsiz.", adminKeyboard);
});

// Function for jobs pagination
async function viewJobOffset(ctx, viloyat, offset, total, edit = false) {
    const job = db.prepare('SELECT * FROM jobs WHERE viloyat = ? ORDER BY created_at DESC LIMIT 1 OFFSET ?').get(viloyat, offset);
    if (!job) return;

    const msg = `
📌 **ISH E'LONI**
━━━━━━━━━━━━━━
🔹 **KASB:** ${job.ish_turi}
💰 **MAOSH:** ${job.maosh}
📍 **HUDUD:** ${job.viloyat}
📅 **SANA:** ${job.created_at}
━━━━━━━━━━━━━━
📊 *${offset + 1} / ${total}*
    `;
    
    const buttons = [];
    if (offset > 0) buttons.push(Markup.button.callback("⬅️ Oldingi", `view_job_${offset - 1}`));
    buttons.push(Markup.button.callback("📞 Aloqa olish", `contact_job_${job.id}`));
    if (offset < total - 1) buttons.push(Markup.button.callback("Keyingi ➡️", `view_job_${offset + 1}`));

    const markup = Markup.inlineKeyboard([buttons]);
    
    if (edit) {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: markup.reply_markup });
    } else {
        await ctx.reply(`✅ Topildi! Jami ${total} ta e'lon.`, { parse_mode: 'Markdown' });
        await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: markup.reply_markup });
    }
}

bot.hears('🔍 Ish qidirish', async (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user || user.mode !== 'worker') return;

    await ctx.reply("⏳ Qidirilmoqda...");
    const totalJobsStr = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE viloyat = ?').get(user.viloyat);
    const totalJobs = totalJobsStr ? totalJobsStr.c : 0;
    
    if (totalJobs === 0) {
        return ctx.reply(`❗ Hozircha ${user.viloyat} viloyatida ish topilmadi.\n\n💡 Siz quyidagilarni qilishingiz mumkin:\n➕ O'zingiz ish e'lon qilishingiz\n🚚 Yetkazib berish bo'limiga o'ting va daromad qiling!`, Markup.inlineKeyboard([
            [Markup.button.callback("🚚 Yetkazib berishga o'tish", "go_delivery")],
            [Markup.button.callback("➕ Ish e'lon qilish", "go_add_job")]
        ]));
    }

    await viewJobOffset(ctx, user.viloyat, 0, totalJobs, false);
});

bot.action(/view_job_(\d+)/, async (ctx) => {
    const offset = parseInt(ctx.match[1]);
    const user = getUser(ctx.from.id);
    if (!user) return ctx.answerCbQuery();
    const totalJobsStr = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE viloyat = ?').get(user.viloyat);
    await viewJobOffset(ctx, user.viloyat, offset, totalJobsStr ? totalJobsStr.c : 0, true);
    ctx.answerCbQuery();
});

bot.hears("➕ Ish e'lon qilish", (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user || user.mode !== 'worker') return;
    ctx.scene.enter('add_job');
});

bot.hears('📋 Profil', async (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user) return;
    
    const info = `
👤 **Ism:** ${user.ism}
📱 **Tel:** ${user.telefon}
📍 **Viloyat:** ${user.viloyat}
🔄 **Holat:** ${user.mode === 'delivery' ? 'Kuryer rejimi' : 'Ishchi rejimi'}
🚗 **Transport:** ${user.transport ? user.transport : "Yo'q"}
    `;
    await ctx.reply(`💳 **Sizning ma'lumotlaringiz:**\n${info}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            Markup.button.callback("🔄 O'zgartirish", "change_profile")
        ])
    });
    ctx.reply("Quyidagilardan birini tanlang:", workerKeyboard);
});

bot.action(/contact_job_(\d+)/, (ctx) => {
    const jobId = ctx.match[1];
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (job) {
        ctx.reply(`📞 Aloqa raqami:\n\nKASB: ${job.ish_turi}\nTEL: ${job.telefon}`, workerKeyboard);
    }
    ctx.answerCbQuery();
});

bot.action('go_delivery', (ctx) => {
    ctx.answerCbQuery();
    const user = getUser(ctx.from.id);
    if (!user.transport) {
        ctx.scene.enter('delivery_reg');
    } else {
        db.prepare(`UPDATE users SET mode = 'delivery' WHERE id = ?`).run(ctx.from.id);
        ctx.reply("Siz delivery rejimiga o'tdingiz.", deliveryKeyboard);
    }
});

bot.action('go_add_job', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('add_job');
});

bot.action('change_profile', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("Nimani o'zgartirmoqchisiz?", Markup.inlineKeyboard([
        [Markup.button.callback("👤 Ism", "edit_name"), Markup.button.callback("📱 Raqam", "edit_phone")],
        [Markup.button.callback("🚗 Transport", "edit_transport")],
        [Markup.button.callback("🔄 Hammasi", "edit_all")]
    ]));
});

bot.action('edit_all', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('registration');
});
bot.action('edit_name', (ctx) => { ctx.answerCbQuery(); ctx.scene.enter('edit_name'); });
bot.action('edit_phone', (ctx) => { ctx.answerCbQuery(); ctx.scene.enter('edit_phone'); });
bot.action('edit_transport', (ctx) => { ctx.answerCbQuery(); ctx.scene.enter('delivery_reg'); });

bot.hears('🚚 Yetkazib berish', (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user) return;

    if (!user.transport) {
        // First time entering delivery
        ctx.scene.enter('delivery_reg');
    } else {
        db.prepare(`UPDATE users SET mode = 'delivery' WHERE id = ?`).run(ctx.from.id);
        ctx.reply("Siz delivery rejimiga o'tdingiz.", deliveryKeyboard);
    }
});

// Function for orders pagination
async function viewOrderOffset(ctx, viloyat, offset, total, edit = false) {
    const order = db.prepare(`SELECT * FROM orders WHERE viloyat = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1 OFFSET ?`).get(viloyat, offset);
    if (!order) return;

    let msg = `
📦 **ZAKAZ E'LONI №${order.id}**
━━━━━━━━━━━━━━
📍 **Manzil:** ${order.manzil}\n`;
    if (order.distance_km) msg += `📏 **Masofa:** ${order.distance_km} km\n`;
    msg += `💵 **Narx:** ${order.narx}\n━━━━━━━━━━━━━━\n📊 *${offset + 1} / ${total}*`;
    
    const buttons = [];
    if (offset > 0) buttons.push(Markup.button.callback("⬅️ Oldingi", `view_order_${offset - 1}`));
    buttons.push(Markup.button.callback('✅ Qabul qilish', `take_order_${order.id}`));
    if (offset < total - 1) buttons.push(Markup.button.callback("Keyingi ➡️", `view_order_${offset + 1}`));

    const markup = Markup.inlineKeyboard([buttons]);
    
    if (edit) {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: markup.reply_markup });
    } else {
        await ctx.reply(`✅ Topildi! Jami ${total} ta zakaz kutib turibdi.`, { parse_mode: 'Markdown' });
        await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: markup.reply_markup });
    }
}

bot.hears('📦 Zakazlar', async (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user || user.mode !== 'delivery') return;

    await ctx.reply("⏳ Yuklanmoqda...");
    const totalOrdersStr = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE viloyat = ? AND status = 'active'`).get(user.viloyat);
    const totalOrders = totalOrdersStr ? totalOrdersStr.c : 0;
    
    if (totalOrders === 0) {
        return ctx.reply(`❗ Hozircha ${user.viloyat} viloyatida aktiv zakazlar yo'q.\nKutib turing yoki ish qidirishga o'ting.`, deliveryKeyboard);
    }

    await viewOrderOffset(ctx, user.viloyat, 0, totalOrders, false);
});

bot.action(/view_order_(\d+)/, async (ctx) => {
    const offset = parseInt(ctx.match[1]);
    const user = getUser(ctx.from.id);
    if (!user) return ctx.answerCbQuery();
    const totalOrdersStr = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE viloyat = ? AND status = 'active'`).get(user.viloyat);
    await viewOrderOffset(ctx, user.viloyat, offset, totalOrdersStr ? totalOrdersStr.c : 0, true);
    ctx.answerCbQuery();
});

bot.action(/take_order_(\d+)/, (ctx) => {
    const orderId = ctx.match[1];
    const user = getUser(ctx.from.id);
    if (!user || user.mode !== 'delivery') return;

    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
    if (!order || order.status !== 'active') {
        return ctx.answerCbQuery("Bu zakaz allaqachon olingan yoki bekor qilingan.", { show_alert: true });
    }

    try {
        db.prepare(`UPDATE orders SET status = 'taken', courier_id = ? WHERE id = ?`).run(ctx.from.id, orderId);
        ctx.answerCbQuery("Zakazni qabul qildingiz!", { show_alert: true });
        
        const owner = getUser(order.user_id);
        const ownerPhone = owner ? owner.telefon : "Noma'lum";
        
        let msg = `Zakaz qabul qilindi. Mijoz bilan bog'laning.\n📍 Manzil: ${order.manzil}\n`;
        if (order.distance_km) msg += `📏 Masofa: ${order.distance_km} km\n`;
        msg += `💵 Narx: ${order.narx}\n📱 Mijoz telefoni: ${ownerPhone}`;

        const buttons = [
            Markup.button.callback('✅ Yetkazib berildi (Done)', `done_order_${orderId}`)
        ];

        if (order.lat_from && order.lon_from && order.lat_to && order.lon_to) {
            const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${order.lat_from},${order.lon_from}&destination=${order.lat_to},${order.lon_to}`;
            buttons.unshift(Markup.button.url("🗺 Xaritada ko'rish", mapUrl));
        }
        
        ctx.reply(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
        
        // Notify user who created the order
        if (owner) {
            bot.telegram.sendMessage(owner.id, `🔔 **Sizning №${order.id} zakazingizni kuryer qabul qildi!**\n\n👤 **Kuryer:** ${user.ism}\n📱 **Tel:** ${user.telefon}`, { parse_mode: 'Markdown' });
            if (user.transport) {
                 bot.telegram.sendMessage(owner.id, `🚗 **Kuryer transporti:** ${user.transport}`, { parse_mode: 'Markdown' });
            }
        }
    } catch(e) {
        ctx.answerCbQuery("Xatolik yuz berdi.", { show_alert: true });
    }
});

bot.hears('📖 Qo\'llanma', (ctx) => {
    const guide = `
📖 **Ishchi Botidan Foydalanish Bo'yicha Yo'riqnoma**

Bot asosan ikki xil rejimda ishlaydi:
1️⃣ **Ishchi (Worker) rejimi:**
- Ish qidirish va o'zingiz ish e'lon qilishingiz mumkin.
- Profilingizni to'g'rilab, o'z viloyatingizdagi vakansiyalarni ko'rasiz.

2️⃣ **Yetkazib berish (Delivery) rejimi:**
- Kuryer bo'lib ishlash va zakazlar berish mumkin.
- Masofani avtomat hisoblash tizimi orqali zakaz bering.
- Kuryerlar uchun Google Maps navigatori o'rnatilgan.

⚒ **Adminlar uchun:**
- Barcha foydalanuvchilar va e'lonlar nazorat ostida.
- Admin menyusiga o'tish uchun maxsus buyruq mavjud.

Savollaringiz bo'lsa, adminga murojaat qiling!
    `;
    ctx.reply(guide, { parse_mode: 'Markdown' });
});

bot.hears('📍 Faol zakaz', (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user || user.mode !== 'delivery') return;

    const order = db.prepare(`SELECT * FROM orders WHERE courier_id = ? AND status = 'taken' LIMIT 1`).get(ctx.from.id);
    if (!order) {
        return ctx.reply("Sizda hozircha faol zakaz yo'q.");
    }

    let msg = `📍 FAOL ZAKAZ №${order.id}\nManzil: ${order.manzil}\n`;
    if (order.distance_km) msg += `📏 Masofa: ${order.distance_km} km\n`;
    msg += `Narx: ${order.narx}\n`;

    const buttons = [
        Markup.button.callback('✅ Yetkazib berildi (Done)', `done_order_${order.id}`)
    ];

    if (order.lat_from && order.lon_from && order.lat_to && order.lon_to) {
        const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${order.lat_from},${order.lon_from}&destination=${order.lat_to},${order.lon_to}`;
        buttons.unshift(Markup.button.url("🗺 Xaritada ko'rish", mapUrl));
    }

    ctx.reply(msg, Markup.inlineKeyboard(buttons));
});

bot.action(/done_order_(\d+)/, (ctx) => {
    const orderId = ctx.match[1];
    try {
        db.prepare(`UPDATE orders SET status = 'done' WHERE id = ?`).run(orderId);
        ctx.answerCbQuery("Barakalla! Zakaz bajarildi.", { show_alert: true });
        ctx.editMessageReplyMarkup(); // remove buttons
        ctx.reply("Zakaz muvaffaqiyatli yakunlandi.");
    } catch(e) {}
});

bot.hears('➕ Zakaz berish', (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user || user.mode !== 'delivery') return;
    // Note: in workers menu 'Delivery' means being a courier, but anyone can post an order. 
    // Usually customers post orders. Let's let delivery couriers also post orders, or normal workers.
    ctx.scene.enter('add_order');
});

bot.hears('⬅️ Ortga', (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user) return;
    db.prepare(`UPDATE users SET mode = 'worker' WHERE id = ?`).run(ctx.from.id);
    ctx.reply("Siz worker (ishchi) rejimiga qaytdingiz.", workerKeyboard);
});

// -- ADMIN COMMANDS --
bot.hears('📊 Statistika', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const usersCount = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c;
    const jobsCount = db.prepare(`SELECT COUNT(*) as c FROM jobs`).get().c;
    const ordersCount = db.prepare(`SELECT COUNT(*) as c FROM orders`).get().c;
    
    ctx.reply(`Statistika:\n👥 Foydalanuvchilar: ${usersCount}\n📋 Ishlar: ${jobsCount}\n📦 Zakazlar: ${ordersCount}`);
});

bot.hears('⬅️ Ortga (Worker)', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("Asosiy menyu.", workerKeyboard);
});

bot.hears('🗑 E\'lon o\'chirish', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const jobs = db.prepare(`SELECT id, ish_turi, maosh FROM jobs ORDER BY created_at DESC LIMIT 10`).all();
    const orders = db.prepare(`SELECT id, manzil, narx FROM orders ORDER BY created_at DESC LIMIT 10`).all();

    if (jobs.length === 0 && orders.length === 0) return ctx.reply("Hech qanday e'lon topilmadi.");

    if (jobs.length > 0) {
        let msg = "📋 ISH E'LONLARI (Oxirgi 10 ta):\n\n";
        const buttons = [];
        jobs.forEach(j => {
            msg += `🔹 #${j.id}: ${j.ish_turi} (${j.maosh})\n`;
            buttons.push([Markup.button.callback(`🗑 Job #${j.id}`, `del_job_${j.id}`)]);
        });
        buttons.push([Markup.button.callback("⬅️ Ortga", "admin_main")]);
        await ctx.reply(msg, Markup.inlineKeyboard(buttons));
    }

    if (orders.length > 0) {
        let msg = "📦 ZAKAZLAR (Oxirgi 10 ta):\n\n";
        const buttons = [];
        orders.forEach(o => {
            msg += `🔸 #${o.id}: ${o.manzil} (${o.narx})\n`;
            buttons.push([Markup.button.callback(`🗑 Order #${o.id}`, `del_order_${o.id}`)]);
        });
        buttons.push([Markup.button.callback("⬅️ Ortga", "admin_main")]);
        await ctx.reply(msg, Markup.inlineKeyboard(buttons));
    }
});

bot.hears('🚫 Userni bloklash', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const users = db.prepare(`SELECT id, ism, viloyat FROM users WHERE is_blocked = 0 AND id != ? ORDER BY created_at DESC LIMIT 15`).all(ADMIN_ID);
    
    if (users.length === 0) return ctx.reply("Bloklanmagan foydalanuvchilar topilmadi.");

    let msg = "🚫 Bloklash uchun foydalanuvchini tanlang:\n\n";
    const buttons = [];
    users.forEach(u => {
        msg += `👤 ${u.ism} (${u.viloyat}) - ID: ${u.id}\n`;
        buttons.push([Markup.button.callback(`🚫 ${u.ism} (ID: ${u.id})`, `block_user_${u.id}`)]);
    });
    buttons.push([Markup.button.callback("⬅️ Ortga", "admin_main")]);

    ctx.reply(msg, Markup.inlineKeyboard(buttons));
});

bot.action('admin_main', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("Admin menyusiga xush kelibsiz.", Markup.keyboard([
        ['📊 Statistika'],
        ['🗑 E\'lon o\'chirish', '🚫 Userni bloklash'],
        ['⬅️ Ortga (Worker)']
    ]).resize());
});

bot.hears(/\/deljob_(\d+)/, (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    db.prepare(`DELETE FROM jobs WHERE id = ?`).run(ctx.match[1]);
    ctx.reply(`Job #${ctx.match[1]} o'chirildi!`);
});

bot.hears(/\/delorder_(\d+)/, (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    db.prepare(`DELETE FROM orders WHERE id = ?`).run(ctx.match[1]);
    ctx.reply(`Order #${ctx.match[1]} o'chirildi!`);
});

bot.hears(/\/block_(\d+)/, (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    db.prepare(`UPDATE users SET is_blocked = 1 WHERE id = ?`).run(ctx.match[1]);
    ctx.reply(`User ${ctx.match[1]} bloklandi!`);
});

bot.hears(/\/unblock_(\d+)/, (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    db.prepare(`UPDATE users SET is_blocked = 0 WHERE id = ?`).run(ctx.match[1]);
    ctx.reply(`User ${ctx.match[1]} blokdan chiqarildi!`);
});

// Admin Callbacks for Lists
bot.action(/block_user_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const userId = ctx.match[1];
    db.prepare(`UPDATE users SET is_blocked = 1 WHERE id = ?`).run(userId);
    await ctx.answerCbQuery("Foydalanuvchi bloklandi.");
    await ctx.editMessageText(ctx.callbackQuery.message.text + `\n\n✅ Bloklandi (ID: ${userId})`);
});

bot.action(/del_job_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const jobId = ctx.match[1];
    db.prepare(`DELETE FROM jobs WHERE id = ?`).run(jobId);
    await ctx.answerCbQuery("Ish e'loni o'chirildi.");
    await ctx.editMessageText(ctx.callbackQuery.message.text + `\n\n✅ O'chirildi (Job #${jobId})`);
});

bot.action(/del_order_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const orderId = ctx.match[1];
    db.prepare(`DELETE FROM orders WHERE id = ?`).run(orderId);
    await ctx.answerCbQuery("Zakaz e'loni o'chirildi.");
    await ctx.editMessageText(ctx.callbackQuery.message.text + `\n\n✅ O'chirildi (Order #${orderId})`);
});

// Admin Callbacks for New User Review
bot.action(/admin_unblock_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const userId = ctx.match[1];
    db.prepare(`UPDATE users SET is_blocked = 0 WHERE id = ?`).run(userId);
    await ctx.answerCbQuery("Foydalanuvchi blokdan chiqarildi.");
    await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n✅ STATUS: Blokdan chiqarildi");
    
    try {
        await bot.telegram.sendMessage(userId, "Xush kelibsiz! Admin hisobingizni faollashtirdi. Endi botdan foydalanishingiz mumkin.", workerKeyboard);
    } catch (e) {
        console.error("Error notifying user: ", e);
    }
});

bot.action(/admin_delete_user_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const userId = ctx.match[1];
    db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    await ctx.answerCbQuery("Foydalanuvchi o'chirildi.");
    await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n🗑 STATUS: O'chirib tashlandi");
});

// My Jobs
bot.hears('📁 Mening e\'lonlarim', async (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user) return;
    const totalJobs = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE user_id = ?').get(ctx.from.id).c;
    if (totalJobs === 0) return ctx.reply("Sizda e'lon qilingan ishlar yo'q.");
    await viewMyJobOffset(ctx, ctx.from.id, 0, totalJobs, false);
});

async function viewMyJobOffset(ctx, userId, offset, total, edit = false) {
     const job = db.prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET ?').get(userId, offset);
     if (!job) {
         if (edit) return ctx.editMessageText("Boshqa e'lon qolmadi.");
         return;
     }

     const msg = `🔹 KASB: ${job.ish_turi}\n💰 MAOSH: ${job.maosh}\n📅 Sana: ${job.created_at}\n\n📊 ${offset + 1} / ${total}`;
     const buttons = [];
     if (offset > 0) buttons.push(Markup.button.callback("⬅️ Oldingi", `my_job_${offset - 1}`));
     buttons.push(Markup.button.callback("🗑 O'chirish", `del_my_job_${job.id}`));
     if (offset < total - 1) buttons.push(Markup.button.callback("Keyingi ➡️", `my_job_${offset + 1}`));

     const markup = Markup.inlineKeyboard([buttons]);
     if (edit) {
        await ctx.editMessageText(msg, markup);
     } else {
        await ctx.reply(`Sizning e'lonlaringiz (${total} ta):`);
        await ctx.reply(msg, markup);
     }
}

bot.action(/my_job_(\d+)/, async (ctx) => {
    const offset = parseInt(ctx.match[1]);
    const total = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE user_id = ?').get(ctx.from.id).c;
    await viewMyJobOffset(ctx, ctx.from.id, offset, total, true);
    ctx.answerCbQuery();
});

bot.action(/del_my_job_(\d+)/, async (ctx) => {
    const jobId = ctx.match[1];
    ctx.answerCbQuery();
    ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
        [Markup.button.callback("✅ Tasdiqlash", `confirm_del_job_${jobId}`)],
        [Markup.button.callback("❌ Bekor qilish", `cancel_del`)]
    ]).reply_markup);
    ctx.reply("⚠️ Haqiqatan ham ushbu e'lonni o'chirmoqchimisiz?");
});

bot.action(/confirm_del_job_(\d+)/, async (ctx) => {
    const jobId = ctx.match[1];
    db.prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?').run(jobId, ctx.from.id);
    ctx.answerCbQuery("E'lon o'chirildi!", { show_alert: true });
    
    const total = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE user_id = ?').get(ctx.from.id).c;
    if (total === 0) {
        await ctx.editMessageText("Sizning hamma e'lonlaringiz o'chirildi.");
    } else {
        await viewMyJobOffset(ctx, ctx.from.id, 0, total, true);
    }
});

bot.action('cancel_del', (ctx) => {
    ctx.answerCbQuery("O'chirish bekor qilindi.");
    ctx.editMessageReplyMarkup(); 
});

// My Orders
bot.hears('📁 Mening zakazlarim', async (ctx) => {
    const user = getUser(ctx.from.id);
    if (!user) return;
    const totalOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ?").get(ctx.from.id).c;
    if (totalOrders === 0) return ctx.reply("Sizda faol zakazlar yo'q.");
    await viewMyOrderOffset(ctx, ctx.from.id, 0, totalOrders, false);
});

async function viewMyOrderOffset(ctx, userId, offset, total, edit = false) {
     const order = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET ?").get(userId, offset);
     if (!order) {
         if (edit) return ctx.editMessageText("Boshqa zakaz qolmadi.");
         return;
     }

     const statusTxt = order.status === 'active' ? "🟢 Kuryer kutilyapti" : order.status === 'taken' ? "🟡 Kuryer olgan" : "✅ Yakunlangan";
     let msg = `📦 Zakaz №${order.id}\n📍 Manzil: ${order.manzil}\n`;
     if (order.distance_km) msg += `📏 Masofa: ${order.distance_km} km\n`;
     msg += `💵 Narx: ${order.narx}\nHolati: ${statusTxt}\n\n📊 ${offset + 1} / ${total}`;
     const buttons = [];
     if (offset > 0) buttons.push(Markup.button.callback("⬅️ Oldingi", `my_order_${offset - 1}`));
     if (order.status === 'active' || order.status === 'taken') {
         buttons.push(Markup.button.callback("🗑 O'chirish", `del_my_order_${order.id}`));
     }
     if (offset < total - 1) buttons.push(Markup.button.callback("Keyingi ➡️", `my_order_${offset + 1}`));

     const markup = Markup.inlineKeyboard([buttons]);
     if (edit) {
        await ctx.editMessageText(msg, markup);
     } else {
        await ctx.reply(`Sizning zakazlaringiz (${total} ta):`);
        await ctx.reply(msg, markup);
     }
}

bot.action(/my_order_(\d+)/, async (ctx) => {
    const offset = parseInt(ctx.match[1]);
    const total = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ?").get(ctx.from.id).c;
    await viewMyOrderOffset(ctx, ctx.from.id, offset, total, true);
    ctx.answerCbQuery();
});

bot.action(/del_my_order_(\d+)/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery();
    ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
        [Markup.button.callback("✅ Tasdiqlash", `confirm_del_order_${orderId}`)],
        [Markup.button.callback("❌ Bekor qilish", `cancel_del`)]
    ]).reply_markup);
    ctx.reply("⚠️ Haqiqatan ham ushbu zakazni o'chirmoqchimisiz?");
});

bot.action(/confirm_del_order_(\d+)/, async (ctx) => {
    const orderId = ctx.match[1];
    db.prepare('DELETE FROM orders WHERE id = ? AND user_id = ?').run(orderId, ctx.from.id);
    ctx.answerCbQuery("Zakaz o'chirildi!", { show_alert: true });
    
    const total = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ?").get(ctx.from.id).c;
    if (total === 0) {
        await ctx.editMessageText("Sizning hamma zakazlaringiz o'chirildi.");
    } else {
        await viewMyOrderOffset(ctx, ctx.from.id, 0, total, true);
    }
});

// Error handling
bot.catch((err, ctx) => {
    console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

bot.launch().then(() => console.log('Bot is running...'));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
