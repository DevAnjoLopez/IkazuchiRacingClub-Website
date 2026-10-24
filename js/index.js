
    const $ = s => document.querySelector(s);
    const mobileToggle = $('#mobileMenuToggle');
    const mobileMenu = $('#mobileMenu');
    mobileToggle.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', String(open));
    });
    mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      mobileToggle.setAttribute('aria-expanded', 'false');
    }));
    const loginBtn = $('#loginBtn');
    const loginOverlay = $('#loginOverlay');
    const loginClose = $('#loginClose');
    const loginForm = $('#loginForm');
    const loginError = $('#loginError');
    const loginSubmitBtn = $('#loginSubmitBtn');
    const myLapTimesSection = $('#my-laptimes');
    const loggedInAs = $('#loggedInAs');
    const lapTimeForm = $('#lapTimeForm');
    const formMsg = $('#formMsg');
    const myLapTimesList = $('#myLapTimesList');
    const filterDriver = $('#filterDriver');
    const logoutBtn = $('#logoutBtn');

    let currentAdmin = null;
    let currentLapTimes = [];

    const TIME_RE = /^\d{1,2}:\d{2}\.\d{3}$/;
    const TIME_HINT = 'Leaderboard laptime must look like 1:23.456 (minutes:seconds.milliseconds).';

    function escapeHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function formatDate(iso) {
      try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
      catch { return ''; }
    }

    let officialRunRows = [];
    let officialRunsLoadError = false;

    function populateRunFilter(id, label, values) {
      const select = $('#' + id);
      const selected = select.value;
      const uniqueValues = Array.from(new Set(values.filter(Boolean)));
      select.innerHTML = '<option value="">All ' + label + '</option>' + optionsHtml(uniqueValues, selected);
    }

    function populateOfficialRunFilters() {
      const drivers = Array.from(document.querySelectorAll('#drivers .driver-card h3')).map(node => node.textContent.trim()).concat(officialRunRows.map(row => row.driver_name || ''));
      const maps = KNOWN_TRACKS.concat(officialRunRows.map(row => row.map || row.track || ''));
      const races = Object.values(KNOWN_RACES_BY_MAP).flat().concat(officialRunRows.map(row => row.race || ''));
      const inputs = KNOWN_INPUTS.concat(officialRunRows.map(row => row.input_method || ''));
      populateRunFilter('runFilterDriver', 'drivers', drivers);
      populateRunFilter('runFilterMap', 'maps', maps);
      populateRunFilter('runFilterRace', 'races', races);
      populateRunFilter('runFilterInput', 'inputs', inputs);
    }

    function renderOfficialRuns() {
      const tbody = $('#officialRunsBody');
      const filters = {
        driver: $('#runFilterDriver').value,
        map: $('#runFilterMap').value,
        race: $('#runFilterRace').value,
        input: $('#runFilterInput').value
      };
      const rows = officialRunRows.filter(row =>
        (!filters.driver || row.driver_name === filters.driver) &&
        (!filters.map || (row.map || row.track) === filters.map) &&
        (!filters.race || row.race === filters.race) &&
        (!filters.input || row.input_method === filters.input)
      );
      if (!rows.length) {
        const message = officialRunsLoadError
          ? 'Event times are temporarily unavailable.'
          : officialRunRows.length
            ? 'No event times match these filters.'
            : 'No event times have been posted yet.';
        tbody.innerHTML = '<tr><td colspan="7">' + escapeHtml(message) + '</td></tr>';
        $('#officialRunsStatus').textContent = officialRunsLoadError ? 'Unable to load runs' : '0 runs shown';
        return;
      }
      tbody.innerHTML = rows.map(row => '<tr>' +
        '<td>' + escapeHtml(row.driver_name) + '</td>' +
        '<td>' + escapeHtml(row.map || row.track) + '</td>' +
        '<td>' + escapeHtml(row.race || 'Race not recorded') + '</td>' +
        '<td>' + escapeHtml(row.car || 'Car not recorded') + '</td>' +
        '<td class="time">' + escapeHtml(row.leaderboard_laptime || row.time) + '</td>' +
        '<td>' + escapeHtml(row.input_method || 'Not recorded') + '</td>' +
        '<td>' + escapeHtml(formatDate(row.created_at)) + '</td>' +
        '</tr>').join('');
      $('#officialRunsStatus').textContent = rows.length + (rows.length === 1 ? ' run shown' : ' runs shown');
    }

    async function loadOfficialRuns() {
      const tbody = $('#officialRunsBody');
      if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        officialRunsLoadError = true;
        renderOfficialRuns();
        return;
      }
      officialRunsLoadError = false;
      $('#officialRunsStatus').textContent = 'Loading event times...';
      try {
        const { data, error } = await supabaseClient
          .from('lap_times')
          .select('driver_name, map, race, car, input_method, leaderboard_laptime, track, time, created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        officialRunRows = data || [];
        populateOfficialRunFilters();
        renderOfficialRuns();
      } catch (err) {
        officialRunsLoadError = true;
        officialRunRows = [];
        tbody.innerHTML = '<tr><td colspan="7">Event times are temporarily unavailable.</td></tr>';
        $('#officialRunsStatus').textContent = 'Unable to load runs';
        console.error('Could not load official runs:', err);
      }
    }
    const optionsHtml = (list, selected = '') =>
      list.map(v => `<option value="${escapeHtml(v)}" ${v === selected ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');

    function populateRaceSelect(select, map, selected = '') {
      const races = KNOWN_RACES_BY_MAP[map] || [];
      select.innerHTML = races.length
        ? '<option value="" disabled>Select race</option>' + optionsHtml(races, selected || races[0])
        : '<option value="" disabled selected>Select a map first</option>';
      select.disabled = !races.length;
      if (selected && races.includes(selected)) select.value = selected;
    }

    function configReady() {
      return !!supabaseClient && !String(SUPABASE_URL).includes('YOUR_');
    }

    async function clubApi(action, payload = {}) {
      const accessCode = sessionStorage.getItem('ikazuchiClubAccess');
      if (!accessCode) throw new Error('Enter the club access code to continue.');
      const { data, error } = await supabaseClient.functions.invoke('club-portal', {
        body: { action, accessCode, ...payload }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    }

    function showMsg(text, isError) {
      formMsg.textContent = text;
      formMsg.className = 'form-msg' + (isError ? ' is-error' : '');
    }

    function openLogin() { loginOverlay.classList.add('open'); document.body.classList.add('no-scroll'); setTimeout(() => $('#loginPassword').focus(), 120); }
    function closeLogin() { loginOverlay.classList.remove('open'); document.body.classList.remove('no-scroll'); loginError.textContent = ''; }

    loginBtn.addEventListener('click', () => {
      if (currentAdmin) myLapTimesSection.scrollIntoView({ behavior: 'smooth' });
      else openLogin();
    });
    loginClose.addEventListener('click', closeLogin);
    loginOverlay.addEventListener('click', e => { if (e.target === loginOverlay) closeLogin(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLogin(); });

    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      loginError.textContent = '';

      if (!configReady()) {
        loginError.textContent = "Supabase isn't set up yet. Add your URL and key in supabase-config.js.";
        return;
      }

      const accessCode = $('#loginPassword').value;

      loginSubmitBtn.disabled = true;
      loginSubmitBtn.textContent = 'VERIFYING...';
      try {
        const { data, error } = await supabaseClient.functions.invoke('club-portal', { body: { action: 'verify', accessCode } });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Invalid club access code.');
        sessionStorage.setItem('ikazuchiClubAccess', accessCode);
        loginForm.reset();
        closeLogin();
        await refreshAuthUI();
        myLapTimesSection.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        loginError.textContent = err instanceof Error ? err.message : String(err);
      } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = 'OPEN DRIVER PORTAL';
      }
    });

    logoutBtn.addEventListener('click', async () => {
      sessionStorage.removeItem('ikazuchiClubAccess');
      await refreshAuthUI();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#ltDriver').insertAdjacentHTML('beforeend', optionsHtml(KNOWN_DRIVERS));
    $('#ltTrack').insertAdjacentHTML('beforeend', optionsHtml(KNOWN_TRACKS));
    $('#ltInput').insertAdjacentHTML('beforeend', optionsHtml(KNOWN_INPUTS));
    $('#ltTrack').addEventListener('change', () => populateRaceSelect($('#ltRace'), $('#ltTrack').value));
    filterDriver.insertAdjacentHTML('beforeend', optionsHtml(KNOWN_DRIVERS));
    $('#carList').innerHTML = KNOWN_CARS.map(car => `<option value="${escapeHtml(car)}"></option>`).join('');
    filterDriver.addEventListener('change', renderLapTimesList);
    ['runFilterDriver', 'runFilterMap', 'runFilterRace', 'runFilterInput'].forEach(id => $('#' + id).addEventListener('change', renderOfficialRuns));
    $('#refreshOfficialRuns').addEventListener('click', loadOfficialRuns);

    lapTimeForm.addEventListener('submit', async e => {
      e.preventDefault();
      showMsg('');

      const leaderboardLaptime = $('#ltTime').value.trim();
      if (!TIME_RE.test(leaderboardLaptime)) { showMsg(TIME_HINT, true); return; }

      try {
        await clubApi('create-lap', {
          driver_name: $('#ltDriver').value,
          map: $('#ltTrack').value,
          race: $('#ltRace').value,
          car: $('#ltCar').value.trim(),
          input_method: $('#ltInput').value,
          leaderboard_laptime: leaderboardLaptime
        });
        lapTimeForm.reset();
        $('#ltRace').innerHTML = '<option value="" disabled selected>Select a map first</option>';
        $('#ltRace').disabled = true;
        showMsg('Leaderboard laptime posted.');
        await loadLapTimes();
      } catch (err) {
        showMsg('Could not post: ' + (err.message || err), true);
      }
    });

    async function loadLapTimes() {
      if (!currentAdmin) { myLapTimesList.innerHTML = ''; return; }
      const { data, error } = await supabaseClient
        .from('lap_times')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { myLapTimesList.innerHTML = '<p class="section-description">Could not load leaderboard laptimes.</p>'; return; }
      currentLapTimes = data;
      renderLapTimesList();
      await loadOfficialRuns();
    }

    function renderLapTimesList() {
      const who = filterDriver.value;
      const rows = currentLapTimes.filter(r => !who || r.driver_name === who);
      if (!rows.length) {
        myLapTimesList.innerHTML = '<p class="section-description">' + (who ? 'No leaderboard laptimes for this driver yet.' : 'No leaderboard laptimes posted yet.') + '</p>';
        return;
      }
      myLapTimesList.innerHTML = rows.map(row => `
        <div class="my-laptime-row" data-id="${escapeHtml(row.id)}">
          <span><b>${escapeHtml(row.driver_name)}</b> &middot; ${escapeHtml(row.map || row.track)} &middot; ${escapeHtml(row.race || 'Race not recorded')} &middot; ${escapeHtml(row.car || 'Car not recorded')} &middot; ${escapeHtml(row.input_method || 'Input not recorded')} &middot; <span class="mono">${escapeHtml(row.leaderboard_laptime || row.time)}</span> &middot; <span style="color:var(--muted)">Posted ${formatDate(row.created_at)}</span></span>
          <span class="my-laptime-actions">
            <button class="my-laptime-edit" data-id="${escapeHtml(row.id)}">Edit</button>
            <button class="my-laptime-delete" data-id="${escapeHtml(row.id)}">Delete</button>
          </span>
        </div>
      `).join('');
    }

    function startEdit(id) {
      const row = currentLapTimes.find(r => r.id === id);
      const el = myLapTimesList.querySelector(`[data-id="${id}"]`);
      if (!row || !el) return;
      el.innerHTML = `
        <div class="my-laptime-edit-form">
          <select class="edit-driver">${optionsHtml(KNOWN_DRIVERS, row.driver_name)}</select>
          <select class="edit-track">${optionsHtml(KNOWN_TRACKS, row.map || row.track)}</select>
          <select class="edit-race"></select>
          <input class="edit-car" list="carList" value="${escapeHtml(row.car)}" placeholder="Car">
          <select class="edit-input" required><option value="" disabled ${row.input_method ? '' : 'selected'}>Select input</option>${optionsHtml(KNOWN_INPUTS, row.input_method || '')}</select>
          <input class="edit-time" value="${escapeHtml(row.leaderboard_laptime || row.time)}" placeholder="1:23.456">
          <span class="my-laptime-actions">
            <button class="my-laptime-save" data-id="${escapeHtml(id)}">Save</button>
            <button class="my-laptime-cancel">Cancel</button>
          </span>
        </div>
      `;
      const trackSelect = el.querySelector('.edit-track');
      const raceSelect = el.querySelector('.edit-race');
      populateRaceSelect(raceSelect, trackSelect.value, row.race || '');
      trackSelect.addEventListener('change', () => populateRaceSelect(raceSelect, trackSelect.value));
    }

    async function saveEdit(id) {
      const el = myLapTimesList.querySelector(`[data-id="${id}"]`);
      const leaderboardLaptime = el.querySelector('.edit-time').value.trim();
      if (!TIME_RE.test(leaderboardLaptime)) { alert(TIME_HINT); return; }
      const inputMethod = el.querySelector('.edit-input').value;
      if (!inputMethod) { alert('Choose Keyboard, Mouse, Controller, or Wheel for input.'); return; }
      const payload = {
        driver_name: el.querySelector('.edit-driver').value,
        map: el.querySelector('.edit-track').value,
        race: el.querySelector('.edit-race').value,
        car: el.querySelector('.edit-car').value.trim(),
        input_method: inputMethod,
        leaderboard_laptime: leaderboardLaptime
      };
      try {
        await clubApi('update-lap', { id, ...payload });
        await loadLapTimes();
      } catch (err) { alert('Could not save: ' + (err.message || err)); }
    }

    myLapTimesList.addEventListener('click', async e => {
      const editBtn = e.target.closest('.my-laptime-edit');
      if (editBtn) { startEdit(editBtn.dataset.id); return; }

      const saveBtn = e.target.closest('.my-laptime-save');
      if (saveBtn) { await saveEdit(saveBtn.dataset.id); return; }

      if (e.target.closest('.my-laptime-cancel')) { renderLapTimesList(); return; }

      const delBtn = e.target.closest('.my-laptime-delete');
      if (delBtn) {
        if (!confirm('Delete this leaderboard laptime?')) return;
        try {
          await clubApi('delete-lap', { id: delBtn.dataset.id });
          await loadLapTimes();
        } catch (err) { alert('Could not delete: ' + (err.message || err)); }
      }
    });

    document.querySelectorAll('.dash-tab').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach(b => b.classList.toggle('on', b === btn));
      $('#panelLaps').style.display = btn.dataset.tab === 'laps' ? 'block' : 'none';
      $('#panelJournals').style.display = btn.dataset.tab === 'journals' ? 'block' : 'none';
    }));

    const journalForm = $('#journalForm');
    const journalMsg = $('#journalMsg');
    const journalAdminList = $('#journalAdminList');
    let currentJournals = [];
    $('#jAuthor').insertAdjacentHTML('beforeend', optionsHtml(KNOWN_DRIVERS));

    function showJournalMsg(text, isError) {
      journalMsg.textContent = text;
      journalMsg.className = 'form-msg' + (isError ? ' is-error' : '');
    }

    async function uploadJournalImage(file) {
      if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
      if (file.size > 3 * 1024 * 1024) throw new Error('Photo is over 3 MB. Please use a smaller one.');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the selected photo.'));
        reader.readAsDataURL(file);
      });
      const base64 = String(dataUrl).split(',')[1];
      const result = await clubApi('upload-image', { base64, contentType: file.type });
      return result.image_url;
    }

    async function removeStoredImage(url) {
      try {
        await clubApi('remove-image', { image_url: url });
      } catch (err) {  }
    }

    async function loadJournals() {
      if (!configReady()) {
        if (currentAdmin) journalAdminList.innerHTML = '<p class="section-description">Journal entries will appear once the database is connected.</p>';
        return;
      }
      const { data, error } = await supabaseClient
        .from('journals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (currentAdmin) journalAdminList.innerHTML = '<p class="section-description">Could not load journal entries right now.</p>';
        return;
      }
      currentJournals = data || [];
      renderAdminJournals();
    }
    function renderAdminJournals() {
      if (!currentAdmin) { journalAdminList.innerHTML = ''; return; }
      if (!currentJournals.length) {
        journalAdminList.innerHTML = '<p class="section-description">No journals posted yet.</p>';
        return;
      }
      journalAdminList.innerHTML = currentJournals.map(j => `
        <div class="my-laptime-row" data-jid="${escapeHtml(j.id)}">
          <span><b>${escapeHtml(j.title)}</b> &middot; ${escapeHtml(j.author)} <span style="color:var(--muted)">${formatDate(j.created_at)}${j.image_url ? ' &middot; with photo' : ''}</span></span>
          <span class="my-laptime-actions">
            <button class="my-laptime-edit" data-id="${escapeHtml(j.id)}">Edit</button>
            <button class="my-laptime-delete" data-id="${escapeHtml(j.id)}">Delete</button>
          </span>
        </div>
      `).join('');
    }

    journalForm.addEventListener('submit', async e => {
      e.preventDefault();
      showJournalMsg('');

      const btn = journalForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'POSTING…';
      try {
        const file = $('#jImage').files[0];
        const image_url = file ? await uploadJournalImage(file) : null;
        await clubApi('create-journal', {
          title: $('#jTitle').value.trim(),
          author: $('#jAuthor').value,
          story: $('#jBody').value.trim(),
          image_url
        });
        journalForm.reset();
        showJournalMsg('Journal posted. It is now live on the site.');
        await loadJournals();
      } catch (err) {
        showJournalMsg('Could not post: ' + (err.message || err), true);
      } finally {
        btn.disabled = false;
        btn.textContent = 'POST JOURNAL';
      }
    });

    function startJournalEdit(id) {
      const j = currentJournals.find(x => x.id === id);
      const el = journalAdminList.querySelector(`[data-jid="${id}"]`);
      if (!j || !el) return;
      el.innerHTML = `
        <div class="j-edit-form">
          <input type="text" class="je-title" maxlength="120" value="${escapeHtml(j.title)}" placeholder="Title">
          <select class="je-author">${optionsHtml(KNOWN_DRIVERS, j.author)}</select>
          <textarea class="je-body" rows="7">${escapeHtml(j.body)}</textarea>
          <label class="je-row">Replace photo: <input type="file" class="je-image" accept="image/*"></label>
          ${j.image_url ? '<label class="je-row"><input type="checkbox" class="je-remove-img"> Remove current photo</label>' : ''}
          <span class="my-laptime-actions">
            <button class="my-laptime-save" data-id="${escapeHtml(id)}">Save</button>
            <button class="my-laptime-cancel">Cancel</button>
          </span>
        </div>
      `;
    }

    async function saveJournalEdit(id) {
      const j = currentJournals.find(x => x.id === id);
      const el = journalAdminList.querySelector(`[data-jid="${id}"]`);
      if (!j || !el) return;
      const title = el.querySelector('.je-title').value.trim();
      const body = el.querySelector('.je-body').value.trim();
      if (!title || !body) { alert('Title and story can\'t be empty.'); return; }
      try {
        let image_url = j.image_url;
        const removeBox = el.querySelector('.je-remove-img');
        if (removeBox && removeBox.checked) image_url = null;
        const newFile = el.querySelector('.je-image').files[0];
        if (newFile) image_url = await uploadJournalImage(newFile);

        await clubApi('update-journal', { id, title, author: el.querySelector('.je-author').value, story: body, image_url });
        if (j.image_url && j.image_url !== image_url) removeStoredImage(j.image_url);
        await loadJournals();
      } catch (err) {
        alert('Could not save: ' + (err.message || err));
      }
    }

    journalAdminList.addEventListener('click', async e => {
      const editBtn = e.target.closest('.my-laptime-edit');
      if (editBtn) { startJournalEdit(editBtn.dataset.id); return; }

      const saveBtn = e.target.closest('.my-laptime-save');
      if (saveBtn) { await saveJournalEdit(saveBtn.dataset.id); return; }

      if (e.target.closest('.my-laptime-cancel')) { renderAdminJournals(); return; }

      const delBtn = e.target.closest('.my-laptime-delete');
      if (delBtn) {
        const j = currentJournals.find(x => x.id === delBtn.dataset.id);
        if (!confirm('Delete this journal? This can\'t be undone.')) return;
        try {
          await clubApi('delete-journal', { id: delBtn.dataset.id });
          if (j && j.image_url) await removeStoredImage(j.image_url);
          await loadJournals();
        } catch (err) { alert('Could not delete: ' + (err.message || err)); }
      }
    });

    async function refreshAuthUI() {
      if (!configReady()) return;
      const savedCode = sessionStorage.getItem('ikazuchiClubAccess');
      currentAdmin = null;
      if (savedCode) {
        try {
          await clubApi('verify');
          currentAdmin = { email: 'Club member' };
        } catch (err) {
          sessionStorage.removeItem('ikazuchiClubAccess');
          console.error('Could not verify club access:', err);
        }
      }
      if (currentAdmin) {
        loginBtn.textContent = 'Dashboard';
        myLapTimesSection.style.display = 'block';
        loggedInAs.textContent = 'Shared club access is active. Manage leaderboard laptimes here; changes appear automatically on the matching driver profile.';
        loadLapTimes();
        renderAdminJournals();
      } else {
        loginBtn.textContent = 'Access code';
        myLapTimesSection.style.display = 'none';
        myLapTimesList.innerHTML = '';
        journalAdminList.innerHTML = '';
      }
    }

    loadOfficialRuns();
    loadJournals();

    if (configReady()) {
      refreshAuthUI();
    }
  