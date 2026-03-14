// ── Collection Page Logic (Firebase) ─────────────────
(async function() {
  const user = await Auth.requireStudent();
  if (!user) return;

  const initials = user.initials || user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('navAvatar').textContent     = initials;
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent   = user.name;
  document.getElementById('profilePhone').textContent  = user.phone || '';

  const unlockedIds = user.unlockedMonths || [];

  // Fetch unlocked months from Firestore
  let unlockedMonths = [];
  for (const id of unlockedIds) {
    const m = await MonthUtils.getById(id);
    if (m) unlockedMonths.push(m);
  }

  // Total lessons count
  let totalLessons = 0;
  for (const m of unlockedMonths) {
    totalLessons += m.lessonsCount || 0;
  }

  const joined = user.joinedAt?.toDate
    ? user.joinedAt.toDate().toLocaleDateString('en-US', { month:'long', year:'numeric' })
    : 'Recently';

  // Badges
  const badges = [];
  if (unlockedIds.length >= 1) badges.push({ cls:'badge-muted',   txt:'📚 Enrolled' });
  if (unlockedIds.length >= 3) badges.push({ cls:'badge-accent',  txt:'⭐ Trailblazer' });
  if (unlockedIds.length >= 6) badges.push({ cls:'badge-success', txt:'🔥 Knowledge Seeker' });
  document.getElementById('profileBadges').innerHTML =
    badges.map(b => `<span class="badge ${b.cls}">${b.txt}</span>`).join('') +
    `<span class="badge badge-muted">📅 Since ${joined}</span>`;

  document.getElementById('profileStats').innerHTML = `
    <div class="prof-stat"><div class="prof-stat-num">${unlockedIds.length}</div><div class="prof-stat-label">Archives</div></div>
    <div class="prof-stat"><div class="prof-stat-num">${totalLessons}</div><div class="prof-stat-label">Lessons</div></div>`;

  // ── Grid ──
  const grid = document.getElementById('collectionGrid');

  if (!unlockedMonths.length) {
    grid.innerHTML = `
      <div class="empty-collection">
        <div class="empty-icon">📭</div>
        <h3>Your collection is empty</h3>
        <p>Unlock your first month to build your personal knowledge archive.</p>
        <a href="payment.html" class="btn btn-primary">💳 Unlock Your First Month</a>
      </div>`;
    return;
  }

  grid.innerHTML = unlockedMonths.map((m, i) => {
    const icon    = MonthUtils.monthIcon(i);
    const relDate = (() => {
      try {
        const d = m.releaseDate?.toDate ? m.releaseDate.toDate() : new Date(m.releaseDate);
        return d.toLocaleDateString('en-US', { month:'short', year:'numeric' });
      } catch { return ''; }
    })();
    return `
    <div class="collection-card" onclick="window.location.href='player.html?month=${m.id}'">
      <div class="collection-card-band"></div>
      <div class="collection-card-body">
        <div class="collection-card-top">
          <div class="collection-card-icon">${icon}</div>
          <div style="text-align:right">
            <div class="collection-card-count">${m.lessonsCount||0}</div>
            <div class="collection-card-count-label">Lessons</div>
          </div>
        </div>
        <div class="collection-card-title">${m.label}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Released ${relDate} · Lifetime Access</div>
        <div class="collection-card-footer">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="event.stopPropagation();window.location.href='player.html?month=${m.id}'">▶ Watch</button>
          <span class="badge badge-success">✓ Owned</span>
        </div>
      </div>
    </div>`;
  }).join('');
})();
