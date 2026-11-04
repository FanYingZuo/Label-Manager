document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const countGreenEl = document.getElementById('count-green');
    const countYellowEl = document.getElementById('count-yellow');
    const countRedEl = document.getElementById('count-red');
    const todayDisplayEl = document.getElementById('today-display');
    const shelvesContainerEl = document.getElementById('shelves-container');
    const btnAddShelf = document.getElementById('btn-add-shelf');
    const btnRemoveLastShelf = document.getElementById('btn-remove-last-shelf');

    // Modal Elements
    const itemModal = document.getElementById('item-modal');
    const itemForm = document.getElementById('item-form');
    const formShelfId = document.getElementById('form-shelf-id');
    const formItemName = document.getElementById('form-item-name');
    const formThawDays = document.getElementById('form-thaw-days');
    const formKeepDays = document.getElementById('form-keep-days');
    const formThawDate = document.getElementById('form-thaw-date');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalTitle = document.getElementById('modal-title');

    // Toast
    const toastEl = document.getElementById('toast');

    // State
    let draggedData = null; // { itemId, sourceShelfId, sourceIndex }

    // 取得今天 YYYY-MM-DD
    function getTodayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const todayStr = getTodayString();
    todayDisplayEl.textContent = `今天：${todayStr}`;

    // 顯示 Toast 訊息
    function showToast(message, type = 'info') {
        toastEl.textContent = message;
        toastEl.className = `toast ${type}`;
        setTimeout(() => {
            toastEl.className = 'toast hidden';
        }, 3000);
    }

    // 載入資料
    async function loadData() {
        try {
            const [shelvesRes, summaryRes] = await Promise.all([
                fetch('/api/shelves'),
                fetch('/api/status/summary')
            ]);

            if (!shelvesRes.ok || !summaryRes.ok) {
                throw new Error('伺服器連線失敗');
            }

            const shelves = await shelvesRes.json();
            const summary = await summaryRes.json();

            renderSummary(summary);
            renderShelves(shelves);
        } catch (err) {
            console.error(err);
            shelvesContainerEl.innerHTML = `<div class="loading-state" style="color: #c62828;">載入失敗：${err.message}</div>`;
        }
    }

    // 渲染頂部狀態統計
    function renderSummary(summary) {
        countGreenEl.textContent = summary.green || 0;
        countYellowEl.textContent = summary.yellow || 0;
        countRedEl.textContent = summary.red || 0;
    }

    // 渲染層架
    function renderShelves(shelves) {
        shelvesContainerEl.innerHTML = '';

        if (shelves.length === 0) {
            shelvesContainerEl.innerHTML = '<div class="loading-state">目前尚無層架，請點擊上方按鈕新增。</div>';
            return;
        }

        shelves.forEach((shelf, shelfIndex) => {
            const shelfCard = document.createElement('div');
            shelfCard.className = 'shelf-card';
            shelfCard.dataset.shelfId = shelf.id;

            // Header
            const header = document.createElement('div');
            header.className = 'shelf-header';

            const titleArea = document.createElement('div');
            titleArea.className = 'shelf-title-area';

            const badge = document.createElement('span');
            badge.className = 'shelf-badge';
            badge.textContent = `層 ${shelfIndex + 1}`;

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'shelf-name-input';
            nameInput.value = shelf.name;
            nameInput.title = '點擊可編輯層架名稱，留空自動還原預設名稱';
            
            // 編輯層架名稱事件
            nameInput.addEventListener('blur', async () => {
                if (nameInput.value !== shelf.name) {
                    await updateShelfName(shelf.id, nameInput.value);
                }
            });
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    nameInput.blur();
                }
            });

            const countSpan = document.createElement('span');
            countSpan.className = 'shelf-item-count';
            countSpan.textContent = `（${shelf.items.length} 品項）`;

            titleArea.appendChild(badge);
            titleArea.appendChild(nameInput);
            titleArea.appendChild(countSpan);
            header.appendChild(titleArea);
            shelfCard.appendChild(header);

            // Items Rack
            const rack = document.createElement('div');
            rack.className = 'shelf-items-rack';
            rack.dataset.shelfId = shelf.id;

            // 啟用拖曳放置到該層
            setupRackDropZone(rack, shelf.id);

            // 渲染品項卡片
            shelf.items.forEach((item, itemIndex) => {
                const itemCard = createItemCard(item, shelf.id, itemIndex);
                rack.appendChild(itemCard);
            });

            // 右側「+」新增方塊
            const addCard = document.createElement('div');
            addCard.className = 'add-item-card';
            addCard.title = `在「${shelf.name}」新增品項`;
            addCard.innerHTML = `
                <div class="add-item-icon">＋</div>
                <div class="add-item-text">新增品項</div>
            `;
            addCard.addEventListener('click', () => openAddItemModal(shelf.id, shelf.name));
            rack.appendChild(addCard);

            shelfCard.appendChild(rack);
            shelvesContainerEl.appendChild(shelfCard);
        });
    }

    // 建立品項卡片
    function createItemCard(item, shelfId, itemIndex) {
        const card = document.createElement('div');
        const colorClass = item.statusColor.toLowerCase();
        card.className = `item-card card-${colorClass}`;
        card.draggable = true;
        card.dataset.itemId = item.id;
        card.dataset.shelfId = shelfId;
        card.dataset.itemIndex = itemIndex;

        // 狀態 Badge 樣式
        const pillClass = `pill-${colorClass}`;

        card.innerHTML = `
            <div>
                <div class="item-card-header">
                    <span class="item-name">${escapeHtml(item.name)}</span>
                    <button type="button" class="btn-delete" title="刪除品項">✕</button>
                </div>
                <div class="item-status-pill ${pillClass}">
                    ${item.statusText}
                </div>
                <div class="item-dates">
                    <div class="date-row">
                        <span>解凍日：</span>
                        <span>${item.thawDate} (解${item.thawDays})</span>
                    </div>
                    <div class="date-row">
                        <span>開封日：</span>
                        <span>${item.openDate} (放${item.keepDays})</span>
                    </div>
                    <div class="date-row discard">
                        <span>丟棄日：</span>
                        <span>${item.discardDate}</span>
                    </div>
                </div>
            </div>
            <div>
                <button type="button" class="btn btn-retag">換標（更新為今日）</button>
            </div>
        `;

        // 綁定換標按鈕
        const retagBtn = card.querySelector('.btn-retag');
        retagBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRetag(item);
        });

        // 綁定刪除按鈕
        const deleteBtn = card.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDelete(item);
        });

        // 綁定拖曳事件
        card.addEventListener('dragstart', (e) => {
            draggedData = {
                itemId: item.id,
                sourceShelfId: shelfId,
                sourceIndex: itemIndex
            };
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            document.querySelectorAll('.shelf-items-rack').forEach(r => r.classList.remove('drag-over'));
        });

        return card;
    }

    // 設定層架放置區
    function setupRackDropZone(rack, shelfId) {
        rack.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            rack.classList.add('drag-over');
        });

        rack.addEventListener('dragleave', (e) => {
            if (!rack.contains(e.relatedTarget)) {
                rack.classList.remove('drag-over');
            }
        });

        rack.addEventListener('drop', async (e) => {
            e.preventDefault();
            rack.classList.remove('drag-over');

            if (!draggedData) return;

            // 計算放置位置的 index
            const afterElement = getDragAfterElement(rack, e.clientX, e.clientY);
            let targetIndex;

            if (afterElement == null) {
                // 放到最後面（在「+」方塊前面）
                const itemCards = rack.querySelectorAll('.item-card:not(.dragging)');
                targetIndex = itemCards.length;
            } else {
                targetIndex = parseInt(afterElement.dataset.itemIndex, 10);
            }

            try {
                const res = await fetch('/api/items/move', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemId: draggedData.itemId,
                        targetShelfId: shelfId,
                        targetIndex: targetIndex
                    })
                });

                if (!res.ok) {
                    throw new Error('移動失敗');
                }

                await loadData();
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
            } finally {
                draggedData = null;
            }
        });
    }

    // 計算滑鼠落在哪個卡片之前
    function getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.item-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // 在同一列以 X 軸為主，跨列以 Y 軸為主
            const inSameRow = (y >= box.top && y <= box.bottom);
            const offset = inSameRow ? (x - box.left - box.width / 2) : (y - box.top - box.height / 2);

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // 更新層架名稱
    async function updateShelfName(shelfId, newName) {
        try {
            const res = await fetch(`/api/shelves/${shelfId}/name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            if (!res.ok) throw new Error('更新層架名稱失敗');
            await loadData();
            showToast('已更新層架名稱', 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    }

    // 換標行為
    async function handleRetag(item) {
        if (!confirm(`確定要將「${item.name}」換標為今日嗎？\n解凍日將更新為 ${todayStr}，並重新計算丟棄日。`)) {
            return;
        }

        try {
            const res = await fetch(`/api/items/${item.id}/retag`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ thawDate: todayStr })
            });

            if (!res.ok) throw new Error('換標失敗');
            await loadData();
            showToast(`已完成「${item.name}」換標！`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    }

    // 刪除品項
    async function handleDelete(item) {
        if (!confirm(`確定要刪除品項「${item.name}」嗎？`)) {
            return;
        }

        try {
            const res = await fetch(`/api/items/${item.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('刪除失敗');
            await loadData();
            showToast(`已刪除「${item.name}」`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    }

    // 新增層架
    btnAddShelf.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/shelves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!res.ok) throw new Error('新增層架失敗');
            await loadData();
            showToast('成功新增層架', 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    });

    // 移除最後一層
    btnRemoveLastShelf.addEventListener('click', async () => {
        if (!confirm('確定要移除最後一層層架嗎？\n注意：若該層仍有品項則無法移除。')) {
            return;
        }

        try {
            const res = await fetch('/api/shelves/last', {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || '移除層架失敗');
            }

            await loadData();
            showToast('已成功移除最後一層層架', 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    });

    // 打開新增品項視窗
    function openAddItemModal(shelfId, shelfName) {
        formShelfId.value = shelfId;
        modalTitle.textContent = `在「${shelfName}」新增品項`;
        itemForm.reset();
        formThawDays.value = 1;
        formKeepDays.value = 2;
        formThawDate.value = todayStr;
        itemModal.classList.remove('hidden');
        formItemName.focus();
    }

    // 關閉新增品項視窗
    function closeAddItemModal() {
        itemModal.classList.add('hidden');
    }

    modalCloseBtn.addEventListener('click', closeAddItemModal);
    modalCancelBtn.addEventListener('click', closeAddItemModal);

    itemModal.addEventListener('click', (e) => {
        if (e.target === itemModal) {
            closeAddItemModal();
        }
    });

    // 送出新增品項表單
    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const shelfId = formShelfId.value;
        const name = formItemName.value.trim();
        const thawDays = parseInt(formThawDays.value, 10);
        const keepDays = parseInt(formKeepDays.value, 10);
        const thawDate = formThawDate.value;

        if (!name) {
            alert('請輸入品名');
            return;
        }

        try {
            const res = await fetch(`/api/shelves/${shelfId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    thawDays: thawDays,
                    keepDays: keepDays,
                    thawDate: thawDate
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || '新增品項失敗');
            }

            closeAddItemModal();
            await loadData();
            showToast(`已成功新增品項「${name}」！`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    });

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 初始化載入
    loadData();
});
