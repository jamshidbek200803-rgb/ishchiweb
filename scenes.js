const { Scenes, Markup } = require('telegraf');
const { 
    workerKeyboard, 
    regionKeyboard, 
    sharePhoneKeyboard, 
    cancelKeyboard, 
    transportKeyboard,
    locationKeyboard
} = require('./keyboards');
const db = require('./database');

// Registration Wizard
const registrationWizard = new Scenes.WizardScene(
    'registration',
    (ctx) => {
        ctx.reply("Assalomu alaykum! Ishchi Botga xush kelibsiz.\n\nIltimos, ismingizni kiriting:", Markup.removeKeyboard());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        ctx.wizard.state.ism = ctx.message.text;
        ctx.reply("Rahmat. Endi telefon raqamingizni yuboring:", sharePhoneKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message && ctx.message.contact) {
            ctx.wizard.state.telefon = ctx.message.contact.phone_number;
        } else if (ctx.message && ctx.message.text) {
            ctx.wizard.state.telefon = ctx.message.text;
        } else {
            return ctx.reply("Iltimos, telefon raqamingizni yuboring (tugmachani bosib yoki matn ko'rinishida):");
        }
        ctx.reply("Qaysi viloyatdansiz? (Qidiruv va e'lonlar shu viloyat bo'yicha filtrlanadi)", regionKeyboard);
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        const viloyat = ctx.message.text;
        ctx.wizard.state.viloyat = viloyat;
        const userId = ctx.from.id;
        const adminId = parseInt(process.env.ADMIN_ID) || 0;
        
        // Filter for Xorazm
        const isXorazm = (viloyat === 'Xorazm');
        let isBlocked = (isXorazm || userId === adminId) ? 0 : 1;

        try {
            db.prepare(`
                INSERT INTO users (id, ism, telefon, viloyat, is_blocked)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                ism=excluded.ism, telefon=excluded.telefon, viloyat=excluded.viloyat, is_blocked=excluded.is_blocked
            `).run(userId, ctx.wizard.state.ism, ctx.wizard.state.telefon, viloyat, isBlocked);

            // Notify Admin
            const adminId = process.env.ADMIN_ID;
            if (adminId) {
                const adminMsg = `🆕 Yangi foydalanuvchi:\n\n👤 Ism: ${ctx.wizard.state.ism}\n📱 Tel: ${ctx.wizard.state.telefon}\n📍 Viloyat: ${viloyat}\n🆔 ID: ${userId}\nHolati: ${isXorazm ? 'Xorazm (Faol)' : '⚠️ Boshqa (Bloklangan)'}`;
                await ctx.telegram.sendMessage(adminId, adminMsg, Markup.inlineKeyboard([
                    [Markup.button.callback("✅ Blokdan chiqarish (Ochish)", `admin_unblock_${userId}`)],
                    [Markup.button.callback("🗑 O'chirish (Delete)", `admin_delete_user_${userId}`)]
                ]));
            }
        } catch (error) {
            console.error("DB error on registration: ", error);
        }

        if (isBlocked) {
            ctx.reply("Siz Xorazmdan bo'lmaganingiz uchun hisobingiz vaqtincha bloklandi. Admin ko'rib chiqadi.", Markup.removeKeyboard());
        } else {
            ctx.reply("Ro'yxatdan o'tish muvaffaqiyatli yakunlandi! Siz 'worker' (ishchi) rejimidasiz.", workerKeyboard);
        }
        return ctx.scene.leave();
    }
);

// Delivery Transport Registration Wizard
const deliveryRegWizard = new Scenes.WizardScene(
    'delivery_reg',
    (ctx) => {
        ctx.reply("Delivery rejimiga o'tish uchun, transport turini tanlang:", transportKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        const transport = ctx.message.text;
        
        try {
            db.prepare(`UPDATE users SET transport = ?, mode = 'delivery' WHERE id = ?`)
              .run(transport, ctx.from.id);
            
            const { deliveryKeyboard } = require('./keyboards');
            ctx.reply(`Transport (${transport}) saqlandi. Siz 'delivery' rejimidasiz.`, deliveryKeyboard);
        } catch (error) {
            console.error(error);
            ctx.reply("Xatolik yuz berdi.");
        }
        return ctx.scene.leave();
    }
);

// Add Job Wizard
const addJobWizard = new Scenes.WizardScene(
    'add_job',
    (ctx) => {
        ctx.reply("Yangi ish e'lon qilish. Ish turini kiriting (masalan, Payvandchi, Dasturchi):", cancelKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message && ctx.message.text === '❌ Bekor qilish') {
            ctx.reply("Bekor qilindi.", workerKeyboard);
            return ctx.scene.leave();
        }
        if (!ctx.message || !ctx.message.text) return;
        ctx.wizard.state.ish_turi = ctx.message.text;
        ctx.reply("Qaysi viloyatda ish joylashgan?", regionKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        ctx.wizard.state.viloyat = ctx.message.text;
        ctx.reply("Maosh qancha? (masalan: 5 000 000 so'm yoki Kelishiladi)", cancelKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        ctx.wizard.state.maosh = ctx.message.text;
        ctx.reply("Aloqa uchun telefon raqam:", cancelKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        ctx.wizard.state.telefon = ctx.message.text;
        
        try {
            db.prepare(`
                INSERT INTO jobs (ish_turi, viloyat, maosh, telefon, user_id)
                VALUES (?, ?, ?, ?, ?)
            `).run(ctx.wizard.state.ish_turi, ctx.wizard.state.viloyat, ctx.wizard.state.maosh, ctx.wizard.state.telefon, ctx.from.id);
            ctx.reply("E'loningiz muvaffaqiyatli saqlandi!", workerKeyboard);
        } catch(e) {
            console.error(e);
            ctx.reply("Xatolik yuz berdi.", workerKeyboard);
        }
        return ctx.scene.leave();
    }
);

// Add Order Wizard
const addOrderWizard = new Scenes.WizardScene(
    'add_order',
    (ctx) => {
        ctx.reply("📍 Zakazni **OLISH** joyini yuboring (A nuqta):", locationKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message && ctx.message.text === '❌ Bekor qilish') {
            const { deliveryKeyboard } = require('./keyboards');
            ctx.reply("Bekor qilindi.", deliveryKeyboard);
            return ctx.scene.leave();
        }
        if (!ctx.message || !ctx.message.location) {
            return ctx.reply("Iltimos, pastdagi tugmani bosing yoki lokatsiya yuboring.");
        }
        ctx.wizard.state.from = ctx.message.location;
        ctx.reply("🏁 Endi zakazni **YETKAZIB BERISH** joyini yuboring (B nuqta):", locationKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message && ctx.message.text === '❌ Bekor qilish') {
            const { deliveryKeyboard } = require('./keyboards');
            ctx.reply("Bekor qilindi.", deliveryKeyboard);
            return ctx.scene.leave();
        }
        if (!ctx.message || !ctx.message.location) {
            return ctx.reply("Iltimos, lokatsiya yuboring.");
        }
        ctx.wizard.state.to = ctx.message.location;

        // Calculate distance (Haversine)
        const lat1 = ctx.wizard.state.from.latitude;
        const lon1 = ctx.wizard.state.from.longitude;
        const lat2 = ctx.wizard.state.to.latitude;
        const lon2 = ctx.wizard.state.to.longitude;

        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = (R * c).toFixed(2);
        
        ctx.wizard.state.distance = distance;
        const estimatedPrice = Math.round(distance * 5000); // 5000 som per km

        ctx.reply(`📏 Masofa: ${distance} km\n💰 Tavsiyaviy narx: ${estimatedPrice} so'm\n\nIltimos, o'z narxingizni kiriting (yoki tavsiyani yozing):`, cancelKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        ctx.wizard.state.narx = ctx.message.text;
        ctx.reply("Qaysi viloyatda?", regionKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        ctx.wizard.state.viloyat = ctx.message.text;
        
        try {
            const { from, to, distance, narx, viloyat } = ctx.wizard.state;
            db.prepare(`
                INSERT INTO orders (manzil, narx, viloyat, user_id, status, lat_from, lon_from, lat_to, lon_to, distance_km)
                VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
            `).run(`Lokatsiya asosida (${distance} km)`, narx, viloyat, ctx.from.id, from.latitude, from.longitude, to.latitude, to.longitude, distance);

            const { deliveryKeyboard } = require('./keyboards');
            ctx.reply("Zakaz muvaffaqiyatli qo'shildi! Kuryerlar uni ko'rishadi.", deliveryKeyboard);
        } catch(e) {
            console.error(e);
            const { deliveryKeyboard } = require('./keyboards');
            ctx.reply("Xatolik yuz berdi.", deliveryKeyboard);
        }
        return ctx.scene.leave();
    }
);



// Edit Name Wizard
const editNameWizard = new Scenes.WizardScene(
    'edit_name',
    (ctx) => {
        ctx.reply("Yangi ismingizni kiriting:", cancelKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message && ctx.message.text === '❌ Bekor qilish') {
            ctx.reply("Bekor qilindi.", workerKeyboard);
            return ctx.scene.leave();
        }
        if (!ctx.message || !ctx.message.text) return;
        const newName = ctx.message.text;
        db.prepare('UPDATE users SET ism = ? WHERE id = ?').run(newName, ctx.from.id);
        ctx.reply("Ismingiz o'zgartirildi!", workerKeyboard);
        return ctx.scene.leave();
    }
);

// Edit Phone Wizard
const editPhoneWizard = new Scenes.WizardScene(
    'edit_phone',
    (ctx) => {
        ctx.reply("Yangi telefon raqamingizni yuboring:", sharePhoneKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        let phone;
        if (ctx.message && ctx.message.contact) {
            phone = ctx.message.contact.phone_number;
        } else if (ctx.message && ctx.message.text) {
            phone = ctx.message.text;
        } else {
            return ctx.reply("Iltimos, qaytadan yuboring.");
        }
        db.prepare('UPDATE users SET telefon = ? WHERE id = ?').run(phone, ctx.from.id);
        ctx.reply("Telefon raqamingiz o'zgartirildi!", workerKeyboard);
        return ctx.scene.leave();
    }
);

// Edit Region Wizard
const editRegionWizard = new Scenes.WizardScene(
    'edit_region',
    (ctx) => {
        ctx.reply("Yangi viloyatingizni tanlang:", regionKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return;
        const region = ctx.message.text;
        db.prepare('UPDATE users SET viloyat = ? WHERE id = ?').run(region, ctx.from.id);
        ctx.reply("Viloyatingiz o'zgartirildi!", workerKeyboard);
        return ctx.scene.leave();
    }
);



module.exports = {
    registrationWizard,
    deliveryRegWizard,
    addJobWizard,
    addOrderWizard,
    editNameWizard,
    editPhoneWizard,
    editRegionWizard
};
