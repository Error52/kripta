const STORAGE_KEY = 'neurocoffee_state_v2';

const defaultState = {
  categories: [
    { category_id: 1, category_name: 'Напитки', display_order: 1 },
    { category_id: 2, category_name: 'Салаты', display_order: 2 },
    { category_id: 3, category_name: 'Горячее', display_order: 3 }
  ],
  items: [
    { item_id: 1, category_id: 1, item_name: 'Кофе американо', price: 180, weight_grams: 250, is_available: true },
    { item_id: 2, category_id: 1, item_name: 'Чай зелёный', price: 150, weight_grams: 300, is_available: true },
    { item_id: 3, category_id: 2, item_name: 'Цезарь', price: 420, weight_grams: 320, is_available: true },
    { item_id: 4, category_id: 3, item_name: 'Паста карбонара', price: 530, weight_grams: 380, is_available: true },
    { item_id: 5, category_id: 3, item_name: 'Стейк', price: 1200, weight_grams: 400, is_available: false }
  ],
  waiters: [
    { waiter_id: 1, first_name: 'Анна', last_name: 'Иванова', phone: '+79990000001', shift: 'morning' },
    { waiter_id: 2, first_name: 'Олег', last_name: 'Смирнов', phone: '+79990000002', shift: 'evening' }
  ],
  tables: Array.from({ length: 8 }, (_, i) => ({
    table_id: i + 1,
    table_number: i + 1,
    seats: i % 2 ? 4 : 2,
    zone: i > 5 ? 'terrace' : 'main'
  })),
  orders: [],
  currentOrderId: null,
  seq: { category: 4, item: 6, waiter: 3, table: 9 }
};

const state = loadState();
const el = (id) => document.getElementById(id);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setActiveTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.id === tabId));
}

function renderTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      setActiveTab(btn.dataset.tab);
      renderAll();
    };
  });
}

function nextId(key) {
  const value = state.seq[key];
  state.seq[key] += 1;
  return value;
}

function waiterName(waiterId) {
  const w = state.waiters.find((x) => x.waiter_id === waiterId);
  return w ? `${w.first_name} ${w.last_name}` : 'Неизвестно';
}

function tableById(tableId) {
  return state.tables.find((t) => t.table_id === tableId);
}

function itemById(itemId) {
  return state.items.find((x) => x.item_id === itemId);
}

function categoryName(id) {
  return state.categories.find((c) => c.category_id === id)?.category_name || 'Без категории';
}

function getOrderById(orderId) {
  return state.orders.find((o) => o.order_id === orderId);
}

function getCurrentOrder() {
  const order = getOrderById(state.currentOrderId);
  return order && order.status === 'open' ? order : null;
}

function calcTotal(order) {
  return Number(order.items.reduce((sum, it) => sum + it.quantity * it.item_price, 0).toFixed(2));
}

function renderHall() {
  const grid = el('hallGrid');
  grid.innerHTML = '';
  const sorted = [...state.tables].sort((a, b) => a.table_number - b.table_number);
  sorted.forEach((t) => {
    const open = state.orders.find((o) => o.table_id === t.table_id && o.status === 'open');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `table-card ${open ? 'busy' : 'free'}`;
    card.innerHTML = `<strong>Стол №${t.table_number}</strong><br>Мест: ${t.seats}<br>Зона: ${t.zone}<br>${open ? `Заказ #${open.order_id}` : 'Свободен'}`;
    card.onclick = () => showTableDialog(t.table_id);
    grid.appendChild(card);
  });

  el('tablesAdminList').innerHTML = sorted.map((t) => `
    <div class="row-line">
      <span>Стол #${t.table_number} | мест: ${t.seats} | зона: ${t.zone}</span>
      <span>
        <button type="button" data-action="edit-table" data-id="${t.table_id}">Изменить</button>
        <button type="button" data-action="delete-table" data-id="${t.table_id}">Удалить</button>
      </span>
    </div>
  `).join('') || 'Нет столиков';
}

function showTableDialog(tableId) {
  const dlg = el('tableDialog');
  el('dialogTitle').textContent = `Столик #${tableById(tableId)?.table_number || tableId}`;
  const select = el('waiterSelect');
  select.innerHTML = state.waiters.map((w) => `<option value="${w.waiter_id}">${w.first_name} ${w.last_name} (${w.shift})</option>`).join('');
  el('openOrderConfirm').onclick = (e) => {
    e.preventDefault();
    openOrderForTable(tableId, Number(select.value));
    dlg.close();
    setActiveTab('orders');
    renderAll();
  };
  dlg.showModal();
}

function openOrderForTable(tableId, waiterId) {
  let order = state.orders.find((o) => o.table_id === tableId && o.status === 'open');
  if (!order) {
    order = {
      order_id: Date.now(),
      table_id: tableId,
      waiter_id: waiterId,
      order_date: new Date().toISOString(),
      status: 'open',
      total_amount: 0,
      payment_method: null,
      items: []
    };
    state.orders.push(order);
  }
  state.currentOrderId = order.order_id;
  saveState();
}

function renderMenuFilters() {
  const sorted = [...state.categories].sort((a, b) => a.display_order - b.display_order);
  const options = sorted.map((c) => `<option value="${c.category_id}">${c.category_name}</option>`).join('');
  el('categoryFilter').innerHTML = `<option value="all">Все</option>${options}`;
  el('itemCategoryInput').innerHTML = options;
}

function renderMenuList() {
  const f = el('categoryFilter').value;
  const q = el('itemSearch').value.toLowerCase();
  const filtered = state.items
    .filter((i) => (f === 'all' || i.category_id === Number(f)) && i.item_name.toLowerCase().includes(q));

  el('menuList').innerHTML = filtered.map((i) => `
    <div class="row-line">
      <span>${i.item_name} | ${categoryName(i.category_id)} | ${i.price.toFixed(2)} ₽ ${i.is_available ? '' : ' (нет)'}</span>
      <button type="button" ${i.is_available ? '' : 'disabled'} data-action="add-item-to-order" data-id="${i.item_id}">+ В заказ</button>
    </div>
  `).join('') || 'Нет позиций';
}

function addItemToCurrentOrder(itemId) {
  const order = getCurrentOrder();
  if (!order) return alert('Сначала откройте заказ со столика.');
  const item = itemById(itemId);
  if (!item || !item.is_available) return alert('Блюдо недоступно.');

  const row = order.items.find((x) => x.item_id === itemId);
  if (row) row.quantity += 1;
  else order.items.push({ item_id: itemId, quantity: 1, item_price: item.price, notes: '' });

  order.total_amount = calcTotal(order);
  saveState();
  renderOrder();
}

function renderOrder() {
  const order = getCurrentOrder();
  if (!order) {
    el('currentOrderMeta').textContent = 'Нет открытого заказа';
    el('orderItems').innerHTML = 'Откройте заказ через раздел «Зал». ';
    el('orderTotal').textContent = '0.00';
    return;
  }

  const table = tableById(order.table_id);
  el('currentOrderMeta').textContent = `Заказ #${order.order_id} | стол #${table?.table_number ?? '-'} | официант: ${waiterName(order.waiter_id)}`;
  el('orderItems').innerHTML = order.items.map((oi) => {
    const it = itemById(oi.item_id);
    return `
      <div class="order-row">
        <strong>${it?.item_name || 'Удалённая позиция'}</strong>
        <span>${oi.item_price.toFixed(2)} ₽ × ${oi.quantity} = ${(oi.item_price * oi.quantity).toFixed(2)} ₽</span>
        <label>Примечание <input data-action="note" data-id="${oi.item_id}" value="${oi.notes || ''}" /></label>
        <div>
          <button type="button" data-action="qty" data-id="${oi.item_id}" data-delta="1">+</button>
          <button type="button" data-action="qty" data-id="${oi.item_id}" data-delta="-1">-</button>
          <button type="button" data-action="remove" data-id="${oi.item_id}">Удалить</button>
        </div>
      </div>
    `;
  }).join('') || 'Пусто';

  el('orderTotal').textContent = calcTotal(order).toFixed(2);
}

function closeCurrentOrder() {
  const order = getCurrentOrder();
  if (!order) return;
  if (!order.items.length) return alert('Нельзя закрыть пустой заказ.');
  order.total_amount = calcTotal(order);
  order.status = 'paid';
  order.payment_method = el('paymentMethod').value;
  state.currentOrderId = null;
  saveState();
  renderAll();
}

function cancelCurrentOrder() {
  const order = getCurrentOrder();
  if (!order) return;
  order.status = 'cancelled';
  order.payment_method = null;
  state.currentOrderId = null;
  saveState();
  renderAll();
}

function selectOrder(orderId) {
  const order = getOrderById(orderId);
  if (!order) return;
  if (order.status !== 'open') return alert('Можно открыть только текущий (open) заказ.');
  state.currentOrderId = orderId;
  setActiveTab('orders');
  saveState();
  renderAll();
}

function renderOrdersBoards() {
  const open = state.orders.filter((o) => o.status === 'open').sort((a, b) => b.order_id - a.order_id);
  const archive = state.orders.filter((o) => o.status !== 'open').sort((a, b) => b.order_id - a.order_id);

  el('openOrdersList').innerHTML = open.map((o) => `
    <div class="row-line">
      <span>#${o.order_id} | стол #${tableById(o.table_id)?.table_number ?? '-'} | ${waiterName(o.waiter_id)} | ${calcTotal(o).toFixed(2)} ₽</span>
      <button type="button" data-action="open-order" data-id="${o.order_id}">Открыть</button>
    </div>
  `).join('') || 'Нет открытых заказов';

  el('archiveOrdersList').innerHTML = archive.map((o) => `
    <div class="row-line">
      <span>#${o.order_id} | ${o.status} | ${new Date(o.order_date).toLocaleString('ru-RU')} | ${o.total_amount?.toFixed(2) || calcTotal(o).toFixed(2)} ₽ | ${o.payment_method || '-'}</span>
    </div>
  `).join('') || 'Архив пуст';
}

function renderMenuCrud() {
  const sortedCategories = [...state.categories].sort((a, b) => a.display_order - b.display_order);
  el('categoryList').innerHTML = sortedCategories.map((c) => `
    <div class="row-line">
      <span>${c.category_name} (order=${c.display_order})</span>
      <span>
        <button type="button" data-action="edit-category" data-id="${c.category_id}">Изменить</button>
        <button type="button" data-action="delete-category" data-id="${c.category_id}">Удалить</button>
      </span>
    </div>
  `).join('') || 'Нет категорий';

  el('menuCrudList').innerHTML = state.items.map((i) => `
    <div class="row-line">
      <span>${i.item_name} | ${categoryName(i.category_id)} | ${i.price.toFixed(2)} ₽ | ${i.weight_grams || '-'} г | ${i.is_available ? 'доступно' : 'нет'}</span>
      <span>
        <button type="button" data-action="edit-item" data-id="${i.item_id}">Изменить</button>
        <button type="button" data-action="toggle-item" data-id="${i.item_id}">${i.is_available ? 'Скрыть' : 'Включить'}</button>
        <button type="button" data-action="delete-item" data-id="${i.item_id}">Удалить</button>
      </span>
    </div>
  `).join('') || 'Нет блюд';
}

function renderWaiters() {
  el('waitersList').innerHTML = state.waiters.map((w) => `
    <div class="row-line">
      <span>${w.first_name} ${w.last_name} | ${w.phone || '-'} | ${w.shift}</span>
      <span>
        <button type="button" data-action="edit-waiter" data-id="${w.waiter_id}">Изменить</button>
        <button type="button" data-action="delete-waiter" data-id="${w.waiter_id}">Удалить</button>
      </span>
    </div>
  `).join('') || 'Нет официантов';
}

function formatMoney(v) {
  return `${Number(v || 0).toFixed(2)} ₽`;
}

function renderReports() {
  const selectedDate = el('reportDate').value;
  const selectedShift = el('reportShift').value;
  const paid = state.orders.filter((o) => o.status === 'paid');

  const shiftRows = state.waiters
    .filter((w) => w.shift === selectedShift)
    .map((w) => {
      const rows = paid.filter((o) => o.waiter_id === w.waiter_id && (!selectedDate || o.order_date.slice(0, 10) === selectedDate));
      const groupPay = rows.reduce((acc, r) => {
        const key = r.payment_method || 'unknown';
        if (!acc[key]) acc[key] = { count: 0, sum: 0 };
        acc[key].count += 1;
        acc[key].sum += r.total_amount || calcTotal(r);
        return acc;
      }, {});
      const subtotal = rows.reduce((s, r) => s + (r.total_amount || calcTotal(r)), 0);
      const avg = rows.length ? subtotal / rows.length : 0;
      return { waiter: waiterName(w.waiter_id), orders: rows.length, subtotal, avg, groupPay };
    });

  el('shiftReport').textContent = shiftRows.map((r) => {
    const byPay = Object.entries(r.groupPay).map(([k, v]) => `  ${k}: ${v.count} шт / ${formatMoney(v.sum)}`).join('\n') || '  нет оплат';
    return `${r.waiter}\nзаказов: ${r.orders}, сумма: ${formatMoney(r.subtotal)}, средний чек: ${formatMoney(r.avg)}\n${byPay}`;
  }).join('\n\n') || 'Нет данных';

  const dishStats = {};
  paid.forEach((o) => {
    o.items.forEach((it) => {
      if (!dishStats[it.item_id]) dishStats[it.item_id] = { qty: 0, sum: 0 };
      dishStats[it.item_id].qty += it.quantity;
      dishStats[it.item_id].sum += it.quantity * it.item_price;
    });
  });
  const top = Object.entries(dishStats)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 10)
    .map(([id, st], idx) => `${idx + 1}. ${itemById(Number(id))?.item_name || `ID ${id}`} — ${st.qty} шт, ${formatMoney(st.sum)}`);
  el('popularReport').textContent = top.join('\n') || 'Нет данных';

  const zoneStats = {};
  paid.forEach((o) => {
    const zone = tableById(o.table_id)?.zone || 'unknown';
    const day = new Date(o.order_date).toLocaleDateString('ru-RU', { weekday: 'long' });
    const key = `${zone} / ${day}`;
    if (!zoneStats[key]) zoneStats[key] = { sum: 0, count: 0 };
    zoneStats[key].sum += o.total_amount || calcTotal(o);
    zoneStats[key].count += 1;
  });
  el('avgReport').textContent = Object.entries(zoneStats)
    .map(([k, v]) => `${k}: ${formatMoney(v.sum / v.count)}`)
    .join('\n') || 'Нет данных';
}

function resetCategoryForm() {
  el('categoryIdInput').value = '';
  el('categoryNameInput').value = '';
  el('categoryOrderInput').value = 0;
}

function resetItemForm() {
  el('itemIdInput').value = '';
  el('itemNameInput').value = '';
  el('itemPriceInput').value = '';
  el('itemWeightInput').value = '';
  el('itemAvailableInput').checked = true;
}

function resetTableForm() {
  el('tableIdInput').value = '';
  el('tableNumberInput').value = '';
  el('tableSeatsInput').value = '';
  el('tableZoneInput').value = 'main';
}

function resetWaiterForm() {
  el('waiterIdInput').value = '';
  el('waiterFirstNameInput').value = '';
  el('waiterLastNameInput').value = '';
  el('waiterPhoneInput').value = '';
  el('waiterShiftInput').value = 'morning';
}

function setupForms() {
  el('categoryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = Number(el('categoryIdInput').value);
    const payload = {
      category_name: el('categoryNameInput').value.trim(),
      display_order: Number(el('categoryOrderInput').value || 0)
    };
    if (!payload.category_name) return;
    if (id) {
      const row = state.categories.find((c) => c.category_id === id);
      Object.assign(row, payload);
    } else {
      state.categories.push({ category_id: nextId('category'), ...payload });
    }
    saveState();
    resetCategoryForm();
    renderAll();
  });

  el('itemForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = Number(el('itemIdInput').value);
    const payload = {
      item_name: el('itemNameInput').value.trim(),
      category_id: Number(el('itemCategoryInput').value),
      price: Number(el('itemPriceInput').value),
      weight_grams: Number(el('itemWeightInput').value || 0) || null,
      is_available: el('itemAvailableInput').checked
    };
    if (!payload.item_name || !payload.price) return;
    if (id) {
      const row = state.items.find((i) => i.item_id === id);
      Object.assign(row, payload);
    } else {
      state.items.push({ item_id: nextId('item'), ...payload });
    }
    saveState();
    resetItemForm();
    renderAll();
  });

  el('tableForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = Number(el('tableIdInput').value);
    const payload = {
      table_number: Number(el('tableNumberInput').value),
      seats: Number(el('tableSeatsInput').value),
      zone: el('tableZoneInput').value
    };
    const duplicate = state.tables.find((t) => t.table_number === payload.table_number && t.table_id !== id);
    if (duplicate) return alert('Такой номер столика уже есть.');

    if (id) {
      Object.assign(tableById(id), payload);
    } else {
      state.tables.push({ table_id: nextId('table'), ...payload });
    }
    saveState();
    resetTableForm();
    renderAll();
  });

  el('waiterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = Number(el('waiterIdInput').value);
    const payload = {
      first_name: el('waiterFirstNameInput').value.trim(),
      last_name: el('waiterLastNameInput').value.trim(),
      phone: el('waiterPhoneInput').value.trim(),
      shift: el('waiterShiftInput').value
    };
    if (!payload.first_name || !payload.last_name) return;
    if (id) {
      const row = state.waiters.find((w) => w.waiter_id === id);
      Object.assign(row, payload);
    } else {
      state.waiters.push({ waiter_id: nextId('waiter'), ...payload });
    }
    saveState();
    resetWaiterForm();
    renderAll();
  });

  el('categoryFormReset').onclick = resetCategoryForm;
  el('itemFormReset').onclick = resetItemForm;
  el('tableFormReset').onclick = resetTableForm;
  el('waiterFormReset').onclick = resetWaiterForm;
}

function handleGlobalClicks(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);

  if (action === 'add-item-to-order') addItemToCurrentOrder(id);
  if (action === 'open-order') selectOrder(id);

  if (action === 'edit-category') {
    const row = state.categories.find((c) => c.category_id === id);
    el('categoryIdInput').value = row.category_id;
    el('categoryNameInput').value = row.category_name;
    el('categoryOrderInput').value = row.display_order;
    setActiveTab('menu');
  }
  if (action === 'delete-category') {
    state.categories = state.categories.filter((c) => c.category_id !== id);
    state.items.forEach((i) => { if (i.category_id === id) i.category_id = state.categories[0]?.category_id || 0; });
    saveState();
    renderAll();
  }

  if (action === 'edit-item') {
    const row = state.items.find((i) => i.item_id === id);
    el('itemIdInput').value = row.item_id;
    el('itemNameInput').value = row.item_name;
    el('itemCategoryInput').value = row.category_id;
    el('itemPriceInput').value = row.price;
    el('itemWeightInput').value = row.weight_grams || '';
    el('itemAvailableInput').checked = !!row.is_available;
    setActiveTab('menu');
  }
  if (action === 'toggle-item') {
    const row = state.items.find((i) => i.item_id === id);
    row.is_available = !row.is_available;
    saveState();
    renderAll();
  }
  if (action === 'delete-item') {
    const used = state.orders.some((o) => o.items.some((it) => it.item_id === id));
    if (used) return alert('Нельзя удалить блюдо: уже использовалось в заказах.');
    state.items = state.items.filter((i) => i.item_id !== id);
    saveState();
    renderAll();
  }

  if (action === 'edit-table') {
    const row = tableById(id);
    el('tableIdInput').value = row.table_id;
    el('tableNumberInput').value = row.table_number;
    el('tableSeatsInput').value = row.seats;
    el('tableZoneInput').value = row.zone;
    setActiveTab('hall');
  }
  if (action === 'delete-table') {
    const hasOpen = state.orders.some((o) => o.table_id === id && o.status === 'open');
    if (hasOpen) return alert('Нельзя удалить столик с открытым заказом.');
    state.tables = state.tables.filter((t) => t.table_id !== id);
    saveState();
    renderAll();
  }

  if (action === 'edit-waiter') {
    const row = state.waiters.find((w) => w.waiter_id === id);
    el('waiterIdInput').value = row.waiter_id;
    el('waiterFirstNameInput').value = row.first_name;
    el('waiterLastNameInput').value = row.last_name;
    el('waiterPhoneInput').value = row.phone;
    el('waiterShiftInput').value = row.shift;
    setActiveTab('settings');
  }
  if (action === 'delete-waiter') {
    const hasOpen = state.orders.some((o) => o.waiter_id === id && o.status === 'open');
    if (hasOpen) return alert('Нельзя удалить официанта с открытым заказом.');
    state.waiters = state.waiters.filter((w) => w.waiter_id !== id);
    saveState();
    renderAll();
  }

  if (action === 'qty') {
    const delta = Number(btn.dataset.delta);
    const order = getCurrentOrder();
    if (!order) return;
    const row = order.items.find((it) => it.item_id === id);
    row.quantity += delta;
    order.items = order.items.filter((it) => it.quantity > 0);
    order.total_amount = calcTotal(order);
    saveState();
    renderOrder();
    renderOrdersBoards();
  }
  if (action === 'remove') {
    const order = getCurrentOrder();
    if (!order) return;
    order.items = order.items.filter((it) => it.item_id !== id);
    order.total_amount = calcTotal(order);
    saveState();
    renderOrder();
    renderOrdersBoards();
  }
}

function setupOrderInputs() {
  el('orderItems').addEventListener('change', (e) => {
    if (e.target.dataset.action !== 'note') return;
    const order = getCurrentOrder();
    if (!order) return;
    const row = order.items.find((it) => it.item_id === Number(e.target.dataset.id));
    row.notes = e.target.value;
    saveState();
  });
}

function exportCsv() {
  const rows = [['order_id', 'table_number', 'waiter', 'status', 'payment_method', 'total_amount', 'order_date']];
  state.orders.forEach((o) => {
    rows.push([
      o.order_id,
      tableById(o.table_id)?.table_number || '',
      waiterName(o.waiter_id),
      o.status,
      o.payment_method || '',
      (o.total_amount || calcTotal(o)).toFixed(2),
      o.order_date
    ]);
  });
  const csv = rows.map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'neurocoffee_orders.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function printReceipt() {
  const order = getCurrentOrder();
  if (!order) return alert('Нет открытого заказа для печати.');
  const text = [
    'НейроКоффе',
    `Чек заказа #${order.order_id}`,
    `Столик: ${tableById(order.table_id)?.table_number || '-'}`,
    `Официант: ${waiterName(order.waiter_id)}`,
    '----------------'
  ];
  order.items.forEach((it) => {
    const item = itemById(it.item_id);
    text.push(`${item?.item_name || 'item'} x${it.quantity} = ${(it.item_price * it.quantity).toFixed(2)} ₽`);
  });
  text.push('----------------');
  text.push(`Итого: ${calcTotal(order).toFixed(2)} ₽`);
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write(`<pre>${text.join('\n')}</pre>`);
  w.document.close();
  w.print();
}


function appendBackupLog(message) {
  const log = el('backupLog');
  const line = `[${new Date().toLocaleString('ru-RU')}] ${message}`;
  log.textContent = `${line}
${log.textContent || ''}`.trim();
}

async function postBackupAction(url, payload) {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json().catch(() => ({}));
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function createFullBackup() {
  appendBackupLog('Запуск полного backup...');
  const result = await postBackupAction('/api/backup/full');
  if (result.ok) appendBackupLog(`Готово: ${result.data.message || 'полный backup создан'}`);
  else appendBackupLog(`Demo: выполните scripts/cafe_backup.sh full. Ошибка API: ${result.error}`);
}

async function copyBinlogBackup() {
  appendBackupLog('Запуск копирования binlog...');
  const result = await postBackupAction('/api/backup/binlog');
  if (result.ok) appendBackupLog(`Готово: ${result.data.message || 'binlog скопирован'}`);
  else appendBackupLog(`Demo: выполните scripts/cafe_backup.sh binlog. Ошибка API: ${result.error}`);
}

async function createMonthlyBackup() {
  appendBackupLog('Запуск месячного архива...');
  const result = await postBackupAction('/api/backup/monthly');
  if (result.ok) appendBackupLog(`Готово: ${result.data.message || 'месячный архив создан'}`);
  else appendBackupLog(`Demo: выполните scripts/cafe_backup.sh monthly. Ошибка API: ${result.error}`);
}

async function restoreFromBackup() {
  const filePath = el('restoreFileInput').value.trim();
  if (!filePath) return appendBackupLog('Укажите путь до backup файла.');
  appendBackupLog(`Запуск восстановления из ${filePath} ...`);
  const result = await postBackupAction('/api/restore', { file_path: filePath });
  if (result.ok) appendBackupLog(`Готово: ${result.data.message || 'восстановление завершено'}`);
  else appendBackupLog(`Demo: выполните mysql < ${filePath}. Ошибка API: ${result.error}`);
}

function renderAll() {
  renderHall();
  renderMenuFilters();
  renderMenuList();
  renderOrder();
  renderOrdersBoards();
  renderMenuCrud();
  renderWaiters();
  renderReports();
}

function bindMainEvents() {
  el('categoryFilter').addEventListener('change', renderMenuList);
  el('itemSearch').addEventListener('input', renderMenuList);
  el('closeOrderBtn').addEventListener('click', closeCurrentOrder);
  el('cancelOrderBtn').addEventListener('click', cancelCurrentOrder);
  el('calcReports').addEventListener('click', renderReports);
  el('exportCsv').addEventListener('click', exportCsv);
  el('printReceipt').addEventListener('click', printReceipt);
  el('exitApp').addEventListener('click', () => alert('Для выхода закройте вкладку браузера.'));
  el('backupFullBtn').addEventListener('click', createFullBackup);
  el('backupBinlogBtn').addEventListener('click', copyBinlogBackup);
  el('backupMonthlyBtn').addEventListener('click', createMonthlyBackup);
  el('restoreBackupBtn').addEventListener('click', restoreFromBackup);
  document.body.addEventListener('click', handleGlobalClicks);
}

function init() {
  const now = new Date().toISOString().slice(0, 10);
  el('reportDate').value = now;
  renderTabs();
  setupForms();
  setupOrderInputs();
  bindMainEvents();
  renderAll();
}

init();
