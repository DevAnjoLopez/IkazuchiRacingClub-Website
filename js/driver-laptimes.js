const DRIVER_NAME = document.querySelector('.driver-title')?.textContent.trim() || '';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return '';
  }
}

async function loadDriverLapTimes() {
  const container = document.getElementById('laptimesContainer');
  if (!container) return;

  if (typeof supabaseClient === 'undefined' || !supabaseClient || !DRIVER_NAME) {
    container.innerHTML = '<p style="color:var(--muted)">Event times are temporarily unavailable.</p>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('lap_times')
    .select('driver_name, map, race, car, input_method, leaderboard_laptime, track, time, created_at')
    .eq('driver_name', DRIVER_NAME)
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<p style="color:var(--muted)">Could not load event times right now.</p>';
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    container.innerHTML = '<p style="color:var(--muted)">No event times yet. Posts from the index page will appear here.</p>';
    return;
  }

  const trackOrder = [];
  const groups = new Map();
  rows.forEach(row => {
    const map = row.map || row.track;
    if (!groups.has(map)) {
      groups.set(map, []);
      trackOrder.push(map);
    }
    groups.get(map).push(row);
  });

  container.innerHTML = trackOrder.map(track => `
    <h2 class="cat-heading"><span class="cat-tag">${escapeHtml(track)}</span></h2>
    <div class="detail-card">
      <table>
        <thead><tr><th>Name</th><th>Race</th><th>Car</th><th>Input</th><th>Event time</th><th>Date posted</th></tr></thead>
        <tbody>${groups.get(track).map(row => `
          <tr>
            <td>${escapeHtml(row.driver_name)}</td>
            <td>${escapeHtml(row.race || 'Race not recorded')}</td>
            <td>${escapeHtml(row.car || 'Car not recorded')}</td>
            <td>${escapeHtml(row.input_method || 'Not recorded')}</td>
            <td class="t">${escapeHtml(row.leaderboard_laptime || row.time)}</td>
            <td>${formatDate(row.created_at)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `).join('');
}

loadDriverLapTimes();
