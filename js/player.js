// ── Secure Video Player Logic (Firebase) ─────────────
(async function() {
  const user = await Auth.requireStudent();
  if (!user) return;

  const initials = user.initials || user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('navAvatar').textContent = initials;

  const params  = new URLSearchParams(window.location.search);
  const monthId = params.get('month');

  if (!monthId) { Toast.error('No month specified.'); setTimeout(() => history.back(), 1500); return; }

  // ── Firestore access check ──
  const hasAccess = (user.unlockedMonths || []).includes(monthId);
  if (!hasAccess) {
    Toast.error('You do not have access to this month.');
    setTimeout(() => window.location.href = 'dashboard.html', 1500);
    return;
  }

  const [month, lessons] = await Promise.all([
    MonthUtils.getById(monthId),
    MonthUtils.getLessons(monthId)
  ]);

  if (!month || !lessons.length) {
    Toast.error('No lessons found for this month.');
    setTimeout(() => history.back(), 1500);
    return;
  }

  document.title = `EduArchive — ${month.label}`;
  document.getElementById('monthTitle').textContent = month.label;

  let player;
  let apiReady = false;
  let isPlayerReady = false;

  window.onYouTubeIframeAPIReady = function() {
    apiReady = true;
    checkAndPlayFirst();
  };

  function checkAndPlayFirst() {
    if (apiReady && lessons.length > 0) {
      playLesson(0);
    }
  }

  const lessonList   = document.getElementById('lessonList');
  const placeholder  = document.getElementById('videoPlaceholder');
  const secureWrap   = document.getElementById('secureWrapper');
  const videoTitle   = document.getElementById('videoTitle');
  const videoSub     = document.getElementById('videoSub');
  const videoCtrl    = document.getElementById('videoControls');
  const lessonDesc   = document.getElementById('lessonDescription');
  const prevBtn      = document.getElementById('prevBtn');
  const nextBtn      = document.getElementById('nextBtn');
  const lessonCtr    = document.getElementById('lessonCounter');
  const progressWrap = document.getElementById('progressWrap');

  let currentIndex = 0;

  progressWrap.innerHTML = `
    <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:100%"></div></div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:5px">${lessons.length} lessons · Lifetime Access</div>`;

  function renderList() {
    lessonList.innerHTML = lessons.map((lesson, i) => `
      <div class="lesson-item ${i === currentIndex ? 'active' : ''}" data-index="${i}" onclick="playLesson(${i})">
        <div class="lesson-num">${lesson.order}</div>
        <div class="lesson-text">
          <div class="lesson-name">${lesson.title}</div>
          <div class="lesson-dur">🕐 ${lesson.duration}</div>
        </div>
        <div class="lesson-play-icon">${i === currentIndex ? '▶' : '›'}</div>
      </div>`).join('');
  }

  window.playLesson = function(index) {
    if (index < 0 || index >= lessons.length) return;
    currentIndex = index;
    const lesson = lessons[index];

    videoTitle.textContent = `${lesson.order}. ${lesson.title}`;
    videoSub.textContent   = `${month.label} · Lesson ${lesson.order} of ${lessons.length} · ${lesson.duration}`;
    lessonCtr.textContent  = `${index + 1} / ${lessons.length}`;

    placeholder.style.display  = 'none';
    secureWrap.style.display   = 'block';
    videoCtrl.style.display    = 'flex';
    lessonDesc.style.display   = 'block';
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === lessons.length - 1;

    if (!player) {
      isPlayerReady = false;
      player = new YT.Player('ytPlayer', {
        height: '100%',
        width: '100%',
        videoId: lesson.youtubeId,
        playerVars: {
          'autoplay': 1,
          'modestbranding': 1,
          'rel': 0,
          'controls': 1,
          'iv_load_policy': 3
        },
        events: {
          'onReady': (event) => {
            isPlayerReady = true;
            event.target.playVideo();
          },
          'onError': (e) => {
            console.error('[Player] YT API Error:', e.data);
            if (e.data === 153 || e.data === 2) {
              console.log('[Player] Falling back to traditional iframe...');
              secureWrap.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${lesson.youtubeId}?autoplay=1&rel=0" frameborder="0" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
            }
          }
        }
      });
    } else if (isPlayerReady && typeof player.loadVideoById === 'function') {
      player.loadVideoById(lesson.youtubeId);
    } else {
      console.log('[Player] YT API busy or not ready, trying iframe fallback...');
      secureWrap.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${lesson.youtubeId}?autoplay=1&rel=0" frameborder="0" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      player = null; // Reset for next time
    }

    renderList();
    const el = lessonList.querySelector(`[data-index="${index}"]`);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  prevBtn.addEventListener('click', () => playLesson(currentIndex - 1));
  nextBtn.addEventListener('click', () => playLesson(currentIndex + 1));

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'l') playLesson(currentIndex + 1);
    if (e.key === 'ArrowLeft'  || e.key === 'j') playLesson(currentIndex - 1);
  });

  renderList();
  if (apiReady) checkAndPlayFirst();
})();
