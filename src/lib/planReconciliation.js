// Kunci item berlebih (index >= maxAllowed) dan buka kunci item dalam kuota (index < maxAllowed).
// Urutan berdasarkan created_at ASC: yang paling lama tetap aktif.
// excludeDeleted: true untuk custom_categories agar soft-deleted rows tidak ikut dihitung kuota.
async function reconcileTable(supabase, table, userId, maxAllowed, excludeDeleted = false) {
  let q = supabase.from(table).select('id').eq('user_id', userId).order('created_at', { ascending: true });
  if (excludeDeleted) q = q.eq('is_deleted', false);
  const { data: items, error } = await q;

  if (error || !items) return;

  const toUnlock = items.slice(0, maxAllowed).map((i) => i.id);
  const toLock   = items.slice(maxAllowed).map((i) => i.id);

  if (toUnlock.length > 0) {
    await supabase.from(table).update({ is_locked: false }).in('id', toUnlock);
  }
  if (toLock.length > 0) {
    await supabase.from(table).update({ is_locked: true }).in('id', toLock);
  }
}

// Sama seperti reconcileTable, khusus tabel debts: kuota hanya dihitung dari
// catatan yang AKTIF (status='active') dan belum di-soft-delete (is_deleted=false).
// Catatan lunas/terhapus tidak menghabiskan kuota, jadi tidak ikut dikunci.
// Urutan created_at ASC: 5 catatan paling lama tetap aktif, sisanya dikunci.
async function reconcileDebts(supabase, userId, maxAllowed) {
  const { data: items, error } = await supabase
    .from('debts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error || !items) return;

  const toUnlock = items.slice(0, maxAllowed).map((i) => i.id);
  const toLock   = items.slice(maxAllowed).map((i) => i.id);

  if (toUnlock.length > 0) {
    await supabase.from('debts').update({ is_locked: false }).in('id', toUnlock);
  }
  if (toLock.length > 0) {
    await supabase.from('debts').update({ is_locked: true }).in('id', toLock);
  }
}

// Dipanggil saat Pro → Basic: kunci data yang melebihi limit Basic.
// maxWallets / maxSavingsGoals / maxCustomCategories / maxActiveDebts bisa Infinity (aman, slice(Infinity) = []).
export async function lockExcessOnDowngrade(supabase, userId, limits) {
  await reconcileTable(supabase, 'wallets',           userId, limits.maxWallets);
  await reconcileTable(supabase, 'savings',           userId, limits.maxSavingsGoals);
  await reconcileTable(supabase, 'custom_categories', userId, limits.maxCustomCategories, true);
  await reconcileDebts(supabase, userId, limits.maxActiveDebts);
}

// Dipanggil saat Basic → Pro: buka kunci semua item di 4 tabel.
export async function unlockAllOnUpgrade(supabase, userId) {
  await supabase.from('wallets').update({ is_locked: false }).eq('user_id', userId);
  await supabase.from('savings').update({ is_locked: false }).eq('user_id', userId);
  await supabase.from('custom_categories').update({ is_locked: false }).eq('user_id', userId);
  await supabase.from('debts').update({ is_locked: false }).eq('user_id', userId);
}
