// ── Admin Panel Logic (Firebase) ─────────────────────
(async function() {
  const user = await Auth.requireAdmin();
  if (!user) return;

  const initials = user.initials || user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('navAvatar').textContent = initials;

  let currentQFilter = 'pending';
  let currentVMMonth = '';
  let allMonths = [];

  // ── Load initial data ──
  allMonths = await MonthUtils.getAll();
  if (allMonths.length) currentVMMonth = allMonths[0].id;

  // ── Sidebar stats ──
  async function renderSidebarStats() {
    const pendingSnap = await fbDb.collection('paymentSlips').where('status','==','pending').get();
    const studentsSnap = await fbDb.collection('users').where('role','==','student').get();
    const lessonsSnap  = await fbDb.collection('lessons').get();

    const pending  = pendingSnap.size;
    const students = studentsSnap.size;
    const lessons  = lessonsSnap.size;

    const el = document.getElementById('pendingCount');
    if (el) el.textContent = pending > 0 ? pending : '';

    document.getElementById('adminSideStats').innerHTML = `
      <div class="admin-stat-row"><span class="admin-stat-label">⏳ Pending</span><span class="admin-stat-value" style="color:var(--warning)">${pending}</span></div>
      <div class="admin-stat-row"><span class="admin-stat-label">👥 Students</span><span class="admin-stat-value">${students}</span></div>
      <div class="admin-stat-row"><span class="admin-stat-label">🎬 Lessons</span><span class="admin-stat-value">${lessons}</span></div>
      <div class="admin-stat-row"><span class="admin-stat-label">📚 Months</span><span class="admin-stat-value">${allMonths.length}</span></div>`;
  }

  // ── Tab switching ──
  window.showTab = function(tab) {
    ['queue','videos','students'].forEach(t => {
      const el = document.getElementById(`tab${t.charAt(0).toUpperCase()+t.slice(1)}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    ['sideQueueBtn','sideVideosBtn','sideStudentsBtn'].forEach((id,i) => {
      document.getElementById(id)?.classList.toggle('active', ['queue','videos','students'][i] === tab);
    });
    ['tabQueueBtn','tabVideosBtn','tabStudentsBtn'].forEach((id,i) => {
      document.getElementById(id)?.classList.toggle('active', ['queue','videos','students'][i] === tab);
    });
    if (tab === 'queue')    renderQueue();
    if (tab === 'videos')   renderVideoManager();
    if (tab === 'students') renderStudents();
  };

  // ── Queue ──
  window.filterQueue = function(filter, el) {
    document.querySelectorAll('[data-qfilter]').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    currentQFilter = filter;
    renderQueue();
  };

  async function renderQueue() {
    const list = document.getElementById('queueList');
    list.innerHTML = `<div style="text-align:center;padding:40px"><div class="loader" style="margin:0 auto"></div></div>`;

    let slips = await PaymentUtils.getSlips();
    if (currentQFilter !== 'all') slips = slips.filter(s => s.status === currentQFilter);

    const statusMap = { pending:'badge-warning', approved:'badge-success', rejected:'badge-danger' };
    const statusTxt = { pending:'⏳ Pending', approved:'✓ Approved', rejected:'✕ Rejected' };
    const initOf = name => name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

    if (!slips.length) {
      list.innerHTML = `<div class="queue-empty"><div class="empty-icon">${currentQFilter==='pending'?'🎉':'📭'}</div><p>${currentQFilter==='pending'?'All caught up! No pending slips.':'No submissions here.'}</p></div>`;
      return;
    }

    list.innerHTML = slips.map(slip => {
      const submittedAt = slip.submittedAt?.toDate ? slip.submittedAt.toDate() : new Date(slip.submittedAt);
      const timeAgo = formatTimeAgo(submittedAt);
      const hasImage = slip.slipUrl && slip.slipUrl.startsWith('data:image');
      return `
      <div class="queue-card">
        <div class="queue-card-top">
          <div class="queue-student-info">
            <div class="queue-avatar">${initOf(slip.userName||'?')}</div>
            <div><div class="queue-student-name">${slip.userName||'Unknown'}</div>
            <div class="queue-student-phone">📱 ${slip.userPhone||''}</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="badge ${statusMap[slip.status]}">${statusTxt[slip.status]}</span>
            <div class="slip-thumb" onclick="openSlipModal('${slip.id}')" title="View slip">
              ${hasImage ? `<img src="${slip.slipUrl}" alt="Slip"/>` : '🧾'}
            </div>
          </div>
        </div>
        <div class="queue-meta">
          <div class="queue-meta-item"><div class="queue-meta-label">Month</div><div class="queue-meta-value">📅 ${slip.monthLabel||slip.monthId}</div></div>
          <div class="queue-meta-item"><div class="queue-meta-label">Bank</div><div class="queue-meta-value">🏦 ${slip.bank||'N/A'}</div></div>
          <div class="queue-meta-item"><div class="queue-meta-label">Amount</div><div class="queue-meta-value" style="color:var(--accent-2)">LKR ${(slip.amount||0).toLocaleString()}</div></div>
          <div class="queue-meta-item"><div class="queue-meta-label">Submitted</div><div class="queue-meta-value">${timeAgo}</div></div>
        </div>
        ${slip.note ? `<div class="queue-note">💬 "${slip.note}"</div>` : ''}
        ${slip.status === 'pending' ? `
        <div class="queue-actions">
          <button class="btn btn-success btn-sm" onclick="approveSlip('${slip.id}')">✓ Approve & Unlock</button>
          <button class="btn btn-danger btn-sm" onclick="rejectSlip('${slip.id}')">✕ Reject</button>
          <span class="queue-time">${submittedAt.toLocaleString()}</span>
        </div>` : `<div class="queue-actions"><span class="queue-time">Processed · ${submittedAt.toLocaleString()}</span></div>`}
      </div>`;
    }).join('');
  }

  window.approveSlip = async function(slipId) {
    try {
      await PaymentUtils.approve(slipId);
      Toast.success('Payment approved! Student access unlocked. ✓');
      renderQueue();
      renderSidebarStats();
    } catch(e) { Toast.error('Failed to approve. ' + e.message); }
  };

  window.rejectSlip = async function(slipId) {
    try {
      await PaymentUtils.reject(slipId);
      Toast.error('Payment rejected.');
      renderQueue();
      renderSidebarStats();
    } catch(e) { Toast.error('Failed to reject. ' + e.message); }
  };

  window.openSlipModal = async function(slipId) {
    const snap = await fbDb.collection('paymentSlips').doc(slipId).get();
    if (!snap.exists) return;
    const slip = { id: snap.id, ...snap.data() };
    const hasImage = slip.slipUrl && slip.slipUrl.startsWith('data:image');
    const submittedAt = slip.submittedAt?.toDate ? slip.submittedAt.toDate() : new Date();
    document.getElementById('slipModalContent').innerHTML = `
      ${hasImage ? `<img class="slip-img-big" src="${slip.slipUrl}" alt="Payment Slip"/>` : `<div style="text-align:center;padding:40px;font-size:48px;background:rgba(255,255,255,0.03);border-radius:var(--radius);margin-bottom:16px">🧾</div>`}
      <div class="slip-modal-info">
        <div><strong>Student:</strong> ${slip.userName||'—'}</div>
        <div><strong>Phone:</strong> ${slip.userPhone||'—'}</div>
        <div><strong>Month:</strong> ${slip.monthLabel||slip.monthId}</div>
        <div><strong>Bank:</strong> ${slip.bank||'N/A'}</div>
        <div><strong>Amount:</strong> LKR ${(slip.amount||0).toLocaleString()}</div>
        <div><strong>Note:</strong> ${slip.note||'—'}</div>
        <div><strong>Submitted:</strong> ${submittedAt.toLocaleString()}</div>
      </div>
      ${slip.status === 'pending' ? `
      <div class="slip-modal-actions">
        <button class="btn btn-ghost btn-sm" onclick="closeSlipModal()">Close</button>
        <button class="btn btn-danger btn-sm" onclick="rejectSlip('${slip.id}');closeSlipModal()">✕ Reject</button>
        <button class="btn btn-success btn-sm" onclick="approveSlip('${slip.id}');closeSlipModal()">✓ Approve</button>
      </div>` : `<div class="slip-modal-actions"><button class="btn btn-ghost btn-sm" onclick="closeSlipModal()">Close</button></div>`}`;
    document.getElementById('slipModal').classList.add('active');
  };
  window.closeSlipModal = function() { document.getElementById('slipModal').classList.remove('active'); };
  document.getElementById('slipModal').addEventListener('click', e => { if (e.target.id === 'slipModal') closeSlipModal(); });

  // ── Video Manager ──
  function renderVideoManager() {
    const sel = document.getElementById('vmMonth');
    sel.innerHTML = '<option value="">-- Select Month --</option>' +
      allMonths.map(m => `<option value="${m.id}">${m.label}</option>`).join('');

    document.getElementById('vmMonthList').innerHTML = allMonths.map(m =>
      `<button class="vm-month-btn ${m.id === currentVMMonth ? 'active' : ''}" onclick="vmSelectMonth('${m.id}',this)">${m.label.replace(' 2026','')}</button>`
    ).join('');

    renderVMLessons();
  }

  window.vmSelectMonth = function(monthId, el) {
    currentVMMonth = monthId;
    document.querySelectorAll('.vm-month-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    renderVMLessons();
  };

  async function renderVMLessons() {
    const container = document.getElementById('vmLessonsDisplay');
    container.innerHTML = `<div style="text-align:center;padding:20px"><div class="loader" style="margin:0 auto"></div></div>`;
    if (!currentVMMonth) { container.innerHTML = ''; return; }

    const month   = allMonths.find(m => m.id === currentVMMonth);
    const lessons = await MonthUtils.getLessons(currentVMMonth);

    container.innerHTML = `<h3 style="margin-bottom:14px">${month?.label||currentVMMonth} — ${lessons.length} Lessons</h3>` +
      (lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:14px">No lessons yet. Add one using the form.</p>' :
       lessons.map(l => `
        <div class="vm-lesson-row">
          <div class="vm-lesson-num">${l.order}</div>
          <div class="vm-lesson-info">
            <div class="vm-lesson-title">${l.title}</div>
            <div class="vm-lesson-meta">🎬 ID: ${l.youtubeId} · ⏱ ${l.duration}</div>
          </div>
          <button class="vm-delete-btn" onclick="deleteLesson('${l.id}','${l.monthId}')" title="Remove">🗑</button>
        </div>`).join(''));
  }

  window.addLesson = async function() {
    const monthId  = document.getElementById('vmMonth').value;
    const title    = document.getElementById('vmTitle').value.trim();
    const ytId     = document.getElementById('vmYtId').value.trim();
    const duration = document.getElementById('vmDuration').value.trim() || '00:00';
    if (!monthId || !title || !ytId) { Toast.error('Please fill Month, Title, and YouTube ID.'); return; }

    const existing = await MonthUtils.getLessons(monthId);
    await fbDb.collection('lessons').add({
      monthId, title, duration, youtubeId: ytId, order: existing.length + 1
    });
    await fbDb.collection('months').doc(monthId).update({ lessonsCount: existing.length + 1 });

    // Refresh allMonths
    allMonths = await MonthUtils.getAll();

    ['vmMonth','vmTitle','vmYtId','vmDuration'].forEach(id => document.getElementById(id).value = '');
    Toast.success(`Lesson "${title}" added! ✓`);
    currentVMMonth = monthId;
    renderVideoManager();
    renderSidebarStats();
  };

  window.deleteLesson = async function(lessonId, monthId) {
    await fbDb.collection('lessons').doc(lessonId).delete();
    const remaining = await MonthUtils.getLessons(monthId);
    // Re-sequence
    const batch = fbDb.batch();
    remaining.forEach((l, i) => batch.update(fbDb.collection('lessons').doc(l.id), { order: i+1 }));
    batch.update(fbDb.collection('months').doc(monthId), { lessonsCount: remaining.length });
    await batch.commit();
    allMonths = await MonthUtils.getAll();
    Toast.info('Lesson removed.');
    renderVMLessons();
    renderSidebarStats();
  };

  // ── Students ──
  async function renderStudents() {
    const snap = await fbDb.collection('users').where('role','==','student').get();
    const students = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const initOf   = name => (name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

    if (!students.length) {
      document.getElementById('studentsList').innerHTML = '<p style="color:var(--text-muted)">No students yet.</p>';
      return;
    }

    const tbody = students.map(s => {
      const ini  = s.initials || initOf(s.name||'?');
      const pills = (s.unlockedMonths||[]).map(mid => {
        const m = allMonths.find(x => x.id === mid);
        return `<span class="month-pill">${m ? m.label.replace(' 2026','') : mid}</span>`;
      }).join('') || '<span style="color:var(--text-muted);font-size:12px">None</span>';
      const joined = s.joinedAt?.toDate ? s.joinedAt.toDate().toLocaleDateString() : '—';
      return `
      <tr>
        <td><div class="student-cell">
          <div class="student-mini-avatar">${ini}</div>
          <div><div class="student-name">${s.name||'—'}</div><div class="student-phone">${s.phone||''}</div></div>
        </div></td>
        <td><div class="month-pills">${pills}</div></td>
        <td><span style="color:var(--accent-light);font-weight:700">${(s.unlockedMonths||[]).length}</span></td>
        <td style="color:var(--text-muted);font-size:12px">${joined}</td>
      </tr>`;
    }).join('');

    document.getElementById('studentsList').innerHTML = `
      <table class="students-table">
        <thead><tr><th>Student</th><th>Unlocked Months</th><th>Count</th><th>Joined</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>`;
  }

  function formatTimeAgo(date) {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'Just now';
  }

  // ── Init ──
  await renderSidebarStats();
  showTab('queue');
})();
