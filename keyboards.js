const { Markup } = require('telegraf');

const workerKeyboard = Markup.keyboard([
    ['🔍 Ish qidirish', '🚚 Yetkazib berish'],
    ['➕ Ish e\'lon qilish', '📁 Mening e\'lonlarim'],
    ['📋 Profil', '📖 Qo\'llanma']
]).resize();

const deliveryKeyboard = Markup.keyboard([
    ['📦 Zakazlar', '📍 Faol zakaz'],
    ['➕ Zakaz berish', '📁 Mening zakazlarim'],
    ['⬅️ Ortga', '📖 Qo\'llanma']
]).resize();

const regionKeyboard = Markup.keyboard([
    ['Toshkent', 'Andijon', 'Buxoro'],
    ['Farg\'ona', 'Jizzax', 'Xorazm'],
    ['Namangan', 'Navoiy', 'Qashqadaryo'],
    ['Qoraqalpog\'iston', 'Samarqand', 'Sirdaryo'],
    ['Surxondaryo']
]).resize();

const transportKeyboard = Markup.keyboard([
    ['🚗 Mashina', '🏍 Moto'],
    ['🚲 Velosiped', '🚶 Piyoda']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['📊 Statistika'],
    ['🗑 E\'lon o\'chirish', '🚫 Userni bloklash'],
    ['⬅️ Ortga (Worker)']
]).resize();

const sharePhoneKeyboard = Markup.keyboard([
    Markup.button.contactRequest('📱 Telefon raqamni yuborish')
]).resize();

const cancelKeyboard = Markup.keyboard([
    ['❌ Bekor qilish']
]).resize();

const locationKeyboard = Markup.keyboard([
    [Markup.button.locationRequest('📍 Lokatsiyani yuborish')],
    ['❌ Bekor qilish']
]).resize();

module.exports = {
    workerKeyboard,
    deliveryKeyboard,
    regionKeyboard,
    transportKeyboard,
    sharePhoneKeyboard,
    cancelKeyboard,
    locationKeyboard,
    adminKeyboard
};
