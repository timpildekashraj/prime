/**
 * PrimeHealth Non-Clinical Engagement Demo — Frontend Logic
 * Vanilla JS, no frameworks, no build step
 */

let selectedPatientId = null;
let allPatients = [];
let topicChart = null;

const TOPIC_LABELS = {
  reception:          'Reception & Registration',
  appointment:        'Appointment & Scheduling',
  wait_time:          'Queue Management',
  doctor_consultation:'Doctor Consultation',
  nursing_staff:      'Nursing & Staff Behaviour',
  pharmacy:           'Pharmacy',
  billing:            'Billing & Insurance',
  facility:           'Facility & Cleanliness',
  care_coordination:  'Care Coordination & Discharge',
  general:            'General Feedback',
};

const TOPIC_COLORS = {
  reception:          '#0E2841',
  appointment:        '#F39C12',
  wait_time:          '#E97132',
  doctor_consultation:'#196B24',
  nursing_staff:      '#156082',
  pharmacy:           '#16A085',
  billing:            '#C0392B',
  facility:           '#0F9ED5',
  care_coordination:  '#8E44AD',
  general:            '#7F8C8D',
};

const BAND_CONFIG = {
  green: {
    bg: 'bg-green-600',
    border: 'border-green-400',
    text: 'text-green-600',
    label: 'Positive Experience',
    emoji: '🟢',
  },
  amber: {
    bg: 'bg-amber-500',
    border: 'border-amber-400',
    text: 'text-amber-600',
    label: 'Monitor — Recent Issues',
    emoji: '🟡',
  },
  red: {
    bg: 'bg-red-600',
    border: 'border-red-500',
    text: 'text-red-600',
    label: 'At Risk — Action Required',
    emoji: '🔴',
  },
};

const SENTIMENT_CONFIG = {
  positive: { cls: 'bg-green-600 text-white', label: '😊 POSITIVE' },
  neutral:  { cls: 'bg-gray-400 text-white',  label: '😐 NEUTRAL' },
  negative: { cls: 'bg-red-600 text-white',   label: '😠 NEGATIVE' },
};

const URGENCY_CONFIG = {
  low:      'text-gray-400',
  medium:   'text-amber-600',
  high:     'text-orange-600 font-bold',
  critical: 'text-red-600 font-bold animate-pulse',
};

const CHANNEL_ICONS = {
  whatsapp: '💬',
  email:    '📧',
  phone:    '📞',
  google:   '⭐',
  doctify:  '🏥',
  survey:   '📋',
  kiosk:    '🖥️',
  app:      '📱',
};

const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  email:    'Email',
  phone:    'Phone Call',
  google:   'Google Reviews',
  doctify:  'Doctify',
  survey:   'Post-Visit Survey',
  kiosk:    'In-Person Kiosk',
  app:      'Mobile App',
};

// ── Stars ─────────────────────────────────────────────────────────────────────
function renderStars(count) {
  return '★'.repeat(count) + '☆'.repeat(5 - count);
}

// ── Patient List ──────────────────────────────────────────────────────────────
const FETCH_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

async function loadPatients() {
  const res = await fetch('/api/patients', { headers: FETCH_HEADERS });
  allPatients = await res.json();

  // Apply current sort order before rendering
  sortPatients(currentSort);
}

// ── Sort Patient List ─────────────────────────────────────────────────────────
let currentSort = 'desc';

function sortPatients(order) {
  currentSort = order;

  // Update button styles
  const descBtn = document.getElementById('sort-desc');
  const ascBtn  = document.getElementById('sort-asc');
  if (descBtn && ascBtn) {
    if (order === 'desc') {
      descBtn.className = 'flex-1 text-xs py-1 px-2 rounded-md font-semibold transition-colors bg-prime-orange text-white';
      ascBtn.className  = 'flex-1 text-xs py-1 px-2 rounded-md font-semibold transition-colors bg-gray-100 text-gray-500';
    } else {
      ascBtn.className  = 'flex-1 text-xs py-1 px-2 rounded-md font-semibold transition-colors bg-red-600 text-white';
      descBtn.className = 'flex-1 text-xs py-1 px-2 rounded-md font-semibold transition-colors bg-gray-100 text-gray-500';
    }
  }

  const sorted = [...allPatients].sort((a, b) =>
    order === 'desc' ? b.score - a.score : a.score - b.score
  );

  const container = document.getElementById('patient-list');
  container.innerHTML = '';
  sorted.forEach(p => {
    const cfg  = BAND_CONFIG[p.colour_band] || BAND_CONFIG.green;
    const card = document.createElement('div');
    card.className = `patient-card cursor-pointer rounded-lg p-3 border ${cfg.border} bg-white hover:bg-gray-50 transition-colors shadow-sm`;
    card.dataset.id = p.id;
    card.onclick = () => selectPatient(p.id);
    card.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <div class="font-semibold text-sm text-gray-900 truncate">${p.name}</div>
        <span class="${cfg.text} text-lg">${cfg.emoji}</span>
      </div>
      <div class="text-xs text-prime-gray flex items-center gap-2">
        <span>${renderStars(p.stars)}</span>
        <span>${p.score.toFixed(1)}</span>
      </div>
      <div class="text-xs text-gray-400 mt-1">${p.id}</div>
      <div class="text-xs text-gray-400">${p.segment} · ${p.last_visit}</div>
      ${p.open_complaints > 0 ? `<div class="text-xs text-red-600 mt-1">⚠ ${p.open_complaints} open complaint${p.open_complaints > 1 ? 's' : ''}</div>` : ''}
    `;
    container.appendChild(card);
  });

  // Re-highlight selected patient after re-render
  if (selectedPatientId) {
    const card = document.querySelector(`[data-id="${selectedPatientId}"]`);
    if (card) card.classList.add('ring-2', 'ring-prime-orange', 'bg-orange-50');
  }
}

// ── Header Search — type Patient ID + Enter or click Search ──────────────────
async function searchPatient() {
  const raw   = document.getElementById('patient-search').value.trim();
  const msgEl = document.getElementById('search-msg');

  if (!raw) return;

  const patientId = raw.toUpperCase();
  msgEl.textContent = 'Searching...';
  msgEl.className   = 'text-xs text-gray-400 min-w-[80px]';

  try {
    const res = await fetch(`/api/patients/${patientId}`, { headers: FETCH_HEADERS });

    if (!res.ok) {
      msgEl.textContent = 'Not found';
      msgEl.className   = 'text-xs text-red-400 min-w-[80px]';
      return;
    }

    const patient = await res.json();

    // Load the profile
    selectedPatientId = patient.id;
    renderProfileWidget(patient);
    renderSignalHistory(patient);
    renderSuggestedActions(patient);
    renderResponsePanel(patient);
    document.getElementById('no-patient-warning').classList.add('hidden');

    // Highlight card in left list
    document.querySelectorAll('.patient-card').forEach(c =>
      c.classList.remove('ring-2', 'ring-prime-orange', 'bg-orange-50')
    );
    const card = document.querySelector(`[data-id="${patient.id}"]`);
    if (card) {
      card.classList.add('ring-2', 'ring-prime-orange', 'bg-orange-50');
      card.scrollIntoView({ block: 'nearest' });
    }

    msgEl.textContent = patient.name;
    msgEl.className   = 'text-xs text-green-400 min-w-[80px]';

  } catch (err) {
    msgEl.textContent = 'Error';
    msgEl.className   = 'text-xs text-red-400 min-w-[80px]';
    console.error('Search error:', err);
  }
}

// ── Select Patient (click on left list) ───────────────────────────────────────
async function selectPatient(patientId) {
  selectedPatientId = patientId;

  document.querySelectorAll('.patient-card').forEach(c =>
    c.classList.remove('ring-2', 'ring-prime-orange', 'bg-orange-50')
  );
  const active = document.querySelector(`[data-id="${patientId}"]`);
  if (active) active.classList.add('ring-2', 'ring-prime-orange', 'bg-orange-50');

  const res     = await fetch(`/api/patients/${patientId}`, { headers: FETCH_HEADERS });
  const patient = await res.json();

  renderProfileWidget(patient);
  renderSignalHistory(patient);
  renderSuggestedActions(patient);
  renderResponsePanel(patient);
  document.getElementById('no-patient-warning').classList.add('hidden');

  // Clear search box message since user clicked directly
  const msgEl = document.getElementById('search-msg');
  if (msgEl) { msgEl.textContent = ''; }
}

// ── Render Profile Widget ─────────────────────────────────────────────────────
function renderProfileWidget(patient) {
  const cfg    = BAND_CONFIG[patient.colour_band] || BAND_CONFIG.green;
  const widget = document.getElementById('profile-widget');

  // Destroy existing chart before wiping innerHTML
  if (topicChart) { topicChart.destroy(); topicChart = null; }

  widget.className = `rounded-xl border-2 ${cfg.border} p-5 shrink-0 transition-all duration-500 bg-white shadow-sm`;

  widget.innerHTML = `
    <div class="flex items-start gap-5">

      <!-- Score Badge -->
      <div class="score-badge ${cfg.bg} rounded-xl px-5 py-3 text-center min-w-[110px] shrink-0">
        <div class="text-3xl font-black text-white">${patient.score.toFixed(1)}</div>
        <div class="text-white text-sm font-bold mt-1">${renderStars(patient.stars)}</div>
        <div class="text-white text-xs mt-1 font-semibold uppercase tracking-wide">${patient.colour_band.toUpperCase()}</div>
      </div>

      <!-- Patient Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <div class="text-xl font-bold text-gray-900">${patient.name}</div>
          ${patient.name_ar ? `<div class="text-prime-gray text-sm">${patient.name_ar}</div>` : ''}
        </div>
        <div class="text-prime-gray text-sm mt-1">${patient.id} &nbsp;|&nbsp; ${patient.segment} &nbsp;|&nbsp; Age ${patient.age}</div>
        <div class="text-gray-400 text-xs mt-1">Last visit: ${patient.last_visit} — ${patient.last_clinic}</div>

        <div class="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-prime-gray">Sentiment trend</span>
            <span class="${cfg.text} font-semibold">${patient.sentiment_trend}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-prime-gray">Visits (12m)</span>
            <span class="text-gray-900 font-medium">${patient.total_visits_12m}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-prime-gray">Open complaints</span>
            <span class="${patient.open_complaints > 0 ? 'text-red-600 font-bold' : 'text-green-600'}">${patient.open_complaints}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-prime-gray">Appreciation notes</span>
            <span class="text-green-600">${patient.appreciation_notes}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-prime-gray">Preferred language</span>
            <span class="text-gray-900 font-medium">${patient.preferred_language}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-prime-gray">Active alerts</span>
            <span class="${patient.active_alerts.length > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}">${patient.active_alerts.length}</span>
          </div>
        </div>
      </div>

      <!-- Feedback Topic Chart -->
      <div class="shrink-0 flex flex-col items-center gap-1" style="width:220px;">
        <div style="width:210px; height:210px; position:relative;">
          <canvas id="topic-chart"></canvas>
        </div>
        <div class="text-xs text-gray-400 uppercase tracking-widest">Departments Visited</div>
      </div>

    </div>

    ${patient.active_alerts.length > 0 ? `
    <div class="mt-4 border-t border-gray-200 pt-4">
      <div class="text-xs text-red-600 font-semibold uppercase tracking-widest mb-2">Active Alerts</div>
      <div class="space-y-1">
        ${patient.active_alerts.map(a => `
          <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            ⚠ ${a.summary}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;

  // Render chart after HTML is in DOM
  renderTopicChart(patient.signals);
}

// ── Suggested Actions ─────────────────────────────────────────────────────────
function renderSuggestedActions(patient) {
  const panel = document.getElementById('suggested-actions');
  const list  = document.getElementById('actions-list');
  if (!panel || !list) return;

  const actions = buildActions(patient);

  if (actions.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  list.innerHTML = actions.map(a => `
    <div class="flex items-start gap-2 p-2 rounded-lg ${a.bg} border ${a.border}">
      <span class="text-base shrink-0 mt-0.5">${a.icon}</span>
      <div>
        <div class="text-xs font-semibold ${a.titleColor}">${a.title}</div>
        <div class="text-xs text-prime-gray mt-0.5">${a.desc}</div>
      </div>
    </div>
  `).join('');

  panel.classList.remove('hidden');
}

function buildActions(patient) {
  const actions = [];
  const band    = patient.colour_band;
  const signals = patient.signals || [];

  // Collect topics from recent signals
  const topics = signals.map(s => s.topic);
  const negativeSignals = signals.filter(s => s.sentiment === 'negative');
  const hasHighUrgency  = signals.some(s => s.urgency === 'high' || s.urgency === 'critical');

  // ── RED band actions ───────────────────────────────────────────────────────
  // Action card styles — two tiers only (Prime Health brand)
  const URGENT = { bg: 'bg-orange-50', border: 'border-orange-200', titleColor: 'text-orange-700' };
  const POSITIVE = { bg: 'bg-green-50', border: 'border-green-200', titleColor: 'text-green-700' };
  const NEUTRAL = { bg: 'bg-gray-50', border: 'border-gray-200', titleColor: 'text-gray-700' };

  if (band === 'red') {
    actions.push({
      icon: '🚨', ...URGENT,
      title: 'Immediate Callback Required',
      desc:  'Patient is at risk. Assign to Patient Relations Manager for same-day callback.',
    });
  }

  if (topics.includes('billing')) {
    actions.push({
      icon: '💳', ...URGENT,
      title: 'Resolve Billing Dispute',
      desc:  'Coordinate with billing team to clarify insurance co-pay. Contact patient within 24 hours.',
    });
  }

  if (topics.includes('wait_time') && negativeSignals.some(s => s.topic === 'wait_time')) {
    actions.push({
      icon: '⏱️', ...URGENT,
      title: 'Notify Clinic Operations',
      desc:  `Share queue management feedback with ${patient.last_clinic} manager to review patient flow.`,
    });
  }

  if (topics.includes('nursing_staff') && negativeSignals.some(s => s.topic === 'nursing_staff')) {
    actions.push({
      icon: '👩‍⚕️', ...URGENT,
      title: 'Escalate to Department Head',
      desc:  'Nursing/staff behaviour complaint flagged. Requires HR coaching review within 48 hours.',
    });
  }

  if (topics.includes('reception') && negativeSignals.some(s => s.topic === 'reception')) {
    actions.push({
      icon: '🏨', ...URGENT,
      title: 'Review Reception Experience',
      desc:  'Patient raised a reception issue. Notify front desk supervisor for immediate review.',
    });
  }

  if (topics.includes('facility') && negativeSignals.some(s => s.topic === 'facility')) {
    actions.push({
      icon: '🏥', ...URGENT,
      title: 'Facilities Maintenance Alert',
      desc:  'Cleanliness or facility concern raised. Notify facilities team for same-day inspection.',
    });
  }

  if (topics.includes('appointment')) {
    actions.push({
      icon: '📅', ...NEUTRAL,
      title: 'Review Appointment Process',
      desc:  'Patient raised appointment issue. Check if notification process was followed.',
    });
  }

  if (topics.includes('pharmacy')) {
    actions.push({
      icon: '💊', ...NEUTRAL,
      title: 'Pharmacy Follow-Up',
      desc:  'Contact pharmacy manager to address patient concern about medication service.',
    });
  }

  if (topics.includes('doctor_consultation') && signals.some(s => s.topic === 'doctor_consultation' && s.sentiment === 'positive')) {
    actions.push({
      icon: '⭐', ...POSITIVE,
      title: 'Share Positive Feedback with Doctor',
      desc:  'Patient praised the consultation. Forward appreciation note to the clinical team.',
    });
  }

  if (band === 'green' && patient.open_complaints === 0) {
    actions.push({
      icon: '🎁', ...POSITIVE,
      title: 'Invite to My Prime Rewards',
      desc:  'High-satisfaction patient. Ideal candidate for loyalty programme enrolment.',
    });
    actions.push({
      icon: '📝', ...POSITIVE,
      title: 'Request Public Review',
      desc:  'Ask patient to leave a Google Review or Doctify testimonial to boost clinic rating.',
    });
  }

  if (band === 'amber') {
    actions.push({
      icon: '📋', ...NEUTRAL,
      title: 'Add Priority Note in HIS',
      desc:  'Flag patient profile in HIS so all staff give extra attention at next visit.',
    });
  }

  if (hasHighUrgency && patient.open_complaints > 0) {
    actions.push({
      icon: '📞', ...URGENT,
      title: `${patient.open_complaints} Open Complaint${patient.open_complaints > 1 ? 's' : ''} — Follow Up`,
      desc:  'Unresolved complaints detected. Assign to case manager for closure within 48 hours.',
    });
  }

  return actions;
}

// ── Topic Donut Chart ─────────────────────────────────────────────────────────
function renderTopicChart(signals) {
  const canvas = document.getElementById('topic-chart');
  if (!canvas) return;

  // Count topics from signal history
  const counts = {};
  (signals || []).forEach(s => {
    if (s.topic) counts[s.topic] = (counts[s.topic] || 0) + 1;
  });

  if (Object.keys(counts).length === 0) return;

  const keys   = Object.keys(counts);
  const labels = keys.map(k => TOPIC_LABELS[k] || k);
  const data   = keys.map(k => counts[k]);
  const colors = keys.map(k => TOPIC_COLORS[k] || '#7F8C8D');

  topicChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:     '#f9fafb',
        borderWidth:     2,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color:    '#6D6E70',
            font:     { size: 8 },
            padding:  4,
            boxWidth: 8,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} visit${ctx.raw > 1 ? 's' : ''}`,
          },
        },
      },
      cutout: '58%',
    },
  });
}

// ── Render Signal History ─────────────────────────────────────────────────────
function renderSignalHistory(patient) {
  const signals  = patient.signals || [];
  const clinic   = patient.last_clinic || '';
  const container = document.getElementById('signal-history');
  document.getElementById('signal-count').textContent = `${signals.length} signal${signals.length !== 1 ? 's' : ''}`;

  if (signals.length === 0) {
    container.innerHTML = '<div class="text-gray-400 text-sm text-center py-8">No signals recorded yet</div>';
    return;
  }

  container.innerHTML = signals.map(s => {
    const borderColor  = s.sentiment === 'positive' ? 'border-green-400' : s.sentiment === 'negative' ? 'border-red-400' : 'border-gray-300';
    const sentimentDot = s.sentiment === 'positive' ? 'bg-green-500'     : s.sentiment === 'negative' ? 'bg-red-500'     : 'bg-gray-400';
    const sentimentCls = s.sentiment === 'positive' ? 'text-green-600'   : s.sentiment === 'negative' ? 'text-red-600'   : 'text-gray-400';
    const icon         = CHANNEL_ICONS[s.channel]  || '💬';
    const channelLabel = CHANNEL_LABELS[s.channel] || s.channel;

    return `
      <div class="bg-gray-50 rounded-lg border-l-4 ${borderColor} p-3 border border-gray-100">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-base">${icon}</span>
            <span class="text-xs text-gray-800 font-semibold">${channelLabel}</span>
            <span class="w-2 h-2 rounded-full ${sentimentDot}"></span>
            <span class="text-xs ${sentimentCls} capitalize font-medium">${s.sentiment}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-400">${s.date}</span>
          </div>
        </div>
        ${s.rating ? `<div class="mb-1">${Array.from({length:5},(_,i)=>`<span style="color:${i<s.rating?'#F37B20':'#d1d5db'};font-size:13px">★</span>`).join('')}</div>` : ''}
        <div class="text-sm text-prime-gray leading-relaxed">${s.text}</div>
        <div class="mt-2 flex items-center gap-2 flex-wrap">
          <span class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">${(s.topic || '').replace(/_/g, ' ')}</span>
          ${clinic ? `<span class="text-xs text-gray-400">🏢 ${clinic}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Submit Signal ─────────────────────────────────────────────────────────────
// ── Response Templates per topic ──────────────────────────────────────────────
const RESPONSE_TEMPLATES = {
  reception: [
    { label: 'Apology',        text: 'Dear {name}, we sincerely apologise for the experience you had at our reception. We have shared your feedback with our front desk supervisor and will follow up with you shortly.' },
    { label: 'Appreciation',   text: 'Dear {name}, thank you for your kind words about our reception team. We are delighted you felt welcomed and look forward to your next visit.' },
  ],
  appointment: [
    { label: 'Apology',        text: 'Dear {name}, we apologise that your appointment was not managed to your expectation. We are reviewing our scheduling process to prevent this from recurring.' },
    { label: 'Rebook',         text: 'Dear {name}, we are sorry for the inconvenience. We would like to rebook you at your earliest convenience — please reply and we will arrange this immediately.' },
  ],
  wait_time: [
    { label: 'Apology',        text: 'Dear {name}, we apologise for the long wait time during your recent visit. We have shared your feedback with the clinic management team to improve our scheduling.' },
    { label: 'Priority Visit',  text: 'Dear {name}, thank you for your patience. We would like to offer you a priority appointment at your convenience. Please reply to schedule at a time that suits you.' },
  ],
  doctor_consultation: [
    { label: 'Appreciation',   text: 'Dear {name}, thank you for your kind feedback about your consultation. We will pass on your appreciation to the clinical team. We look forward to seeing you again.' },
    { label: 'Follow-up',      text: 'Dear {name}, thank you for visiting us. We hope your consultation met your expectations. Please do not hesitate to reach out if you need any follow-up care.' },
  ],
  nursing_staff: [
    { label: 'Apology',        text: 'Dear {name}, we are very sorry to hear about your experience with our nursing team. This does not reflect our standards. We have escalated this internally and will follow up shortly.' },
    { label: 'Appreciation',   text: 'Dear {name}, thank you so much for recognising our nursing staff. We will make sure to pass on your appreciation — it truly motivates our team.' },
  ],
  pharmacy: [
    { label: 'Apology',        text: 'Dear {name}, we apologise for the inconvenience at our pharmacy. We have flagged your feedback to the pharmacy manager who will contact you within 24 hours.' },
  ],
  billing: [
    { label: 'Apology + Fix',   text: 'Dear {name}, we sincerely apologise for the billing issue you experienced. Our billing team will contact you within 24 hours to resolve the insurance co-pay concern. Thank you for your patience.' },
    { label: 'Callback Offer',  text: 'Dear {name}, we have noted your billing concern. A member of our team will call you today to clarify the charges and ensure this is resolved to your satisfaction.' },
  ],
  facility: [
    { label: 'Apology',        text: 'Dear {name}, we apologise that our facilities did not meet your expectations. We have alerted our housekeeping and facilities team to address this immediately.' },
  ],
  care_coordination: [
    { label: 'Follow-up',      text: 'Dear {name}, thank you for your feedback regarding your care journey. Our care coordination team will review your case and reach out to ensure continuity of care.' },
    { label: 'Appreciation',   text: 'Dear {name}, thank you for your kind feedback about our care coordination team. We are committed to ensuring seamless care for all our patients.' },
  ],
  general: [
    { label: 'Thank you',      text: 'Dear {name}, thank you for sharing your feedback with us. Your experience matters and we will use this to improve our service for all patients.' },
    { label: 'Follow-up',      text: 'Dear {name}, thank you for reaching out. A member of our patient relations team will be in touch with you shortly to assist further.' },
  ],
};

function renderResponsePanel(patient) {
  // Header patient name
  const nameEl = document.getElementById('response-patient-name');
  if (nameEl) nameEl.textContent = `Responding to: ${patient.name}`;

  // Show form sections
  ['response-divider', 'response-form'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  });

  // Build quick template buttons based on patient's topics
  const topics   = [...new Set((patient.signals || []).map(s => s.topic).filter(Boolean))];
  const btnArea  = document.getElementById('template-buttons');
  if (!btnArea) return;
  btnArea.innerHTML = '';

  const usedTopics = topics.length > 0 ? topics : ['general'];
  usedTopics.forEach(topic => {
    const templates = RESPONSE_TEMPLATES[topic] || RESPONSE_TEMPLATES.general;
    templates.forEach(tpl => {
      const btn = document.createElement('button');
      btn.className = 'tpl-btn';
      btn.textContent = tpl.label;
      btn.onclick = () => {
        document.getElementById('response-text').value =
          tpl.text.replace('{name}', patient.name.split(' ')[0]);
      };
      btnArea.appendChild(btn);
    });
  });

  // Hide confirmation if switching patients
  const confirm = document.getElementById('response-confirm');
  if (confirm) confirm.classList.add('hidden');
}

// ── Send Response (simulated — logs to patient history) ───────────────────────
async function sendResponse() {
  if (!selectedPatientId) return;

  const text    = document.getElementById('response-text').value.trim();
  const channel = document.getElementById('response-channel').value;
  const btn     = document.getElementById('send-response-btn');

  if (!text) {
    document.getElementById('response-text').classList.add('border-red-500');
    setTimeout(() => document.getElementById('response-text').classList.remove('border-red-500'), 1500);
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Sending...';

  try {
    // Log the staff response as a signal in patient history
    await fetch(`/api/patients/${selectedPatientId}/signal`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body:    JSON.stringify({
        channel,
        text:         `[Staff Response] ${text}`,
        submitted_by: 'Staff Response',
      }),
    });

    // Refresh profile
    const patientRes = await fetch(`/api/patients/${selectedPatientId}`, { headers: FETCH_HEADERS });
    const patient    = await patientRes.json();
    renderProfileWidget(patient);
    renderSignalHistory(patient);
    renderSuggestedActions(patient);
    renderResponsePanel(patient);
    await loadPatients();

    document.getElementById('response-text').value = '';
    const confirm = document.getElementById('response-confirm');
    if (confirm) {
      confirm.textContent = `Response sent via ${CHANNEL_LABELS[channel] || channel}`;
      confirm.classList.remove('hidden');
      setTimeout(() => confirm.classList.add('hidden'), 3000);
    }

  } catch (err) {
    console.error('Send response error:', err);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Send Response to Patient';
  }
}

// ── Render AI Result ──────────────────────────────────────────────────────────
function renderAIResult(result) {
  const panel = document.getElementById('ai-result');
  panel.classList.remove('hidden');

  const sentCfg = SENTIMENT_CONFIG[result.sentiment] || SENTIMENT_CONFIG.neutral;
  document.getElementById('ai-sentiment').className   = `font-bold text-sm px-3 py-1 rounded-full ${sentCfg.cls}`;
  document.getElementById('ai-sentiment').textContent = sentCfg.label;
  document.getElementById('ai-language').textContent  = result.language_detected || 'English';
  document.getElementById('ai-topic').textContent     = result.topic_label || result.topic || '—';

  const urgEl = document.getElementById('ai-urgency');
  urgEl.className   = `text-sm ${URGENCY_CONFIG[result.urgency] || ''}`;
  urgEl.textContent = (result.urgency || 'low').toUpperCase();

  document.getElementById('ai-summary').textContent = result.summary || '—';

  const delta   = result.score_delta || 0;
  const deltaEl = document.getElementById('ai-score-delta');
  deltaEl.textContent = `${result.old_score?.toFixed(1)} → ${result.new_score?.toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})`;
  deltaEl.className   = `font-bold text-lg ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'}`;

  if (result.sentiment === 'negative') {
    panel.classList.add('flash-negative');
    setTimeout(() => panel.classList.remove('flash-negative'), 2000);
  }
}

// ── Alert Banner ──────────────────────────────────────────────────────────────
function showAlertBanner(result) {
  const banner = document.getElementById('alert-banner');
  document.getElementById('alert-title').textContent =
    `🚨 ALERT: ${result.patient_name} — Negative signal detected`;
  document.getElementById('alert-body').textContent =
    `Topic: ${result.topic_label || result.topic} | Urgency: ${(result.urgency || '').toUpperCase()} | Score dropped to ${result.new_score?.toFixed(1)} (${result.new_colour_band?.toUpperCase()}) | Action required`;
  banner.classList.remove('hidden');
  banner.classList.add('alert-slide');
}

function dismissAlert() {
  const banner = document.getElementById('alert-banner');
  banner.classList.add('hidden');
  banner.classList.remove('alert-slide');
}

// ── Error Display ─────────────────────────────────────────────────────────────
function showError(message) {
  const panel = document.getElementById('ai-result');
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="flex items-center gap-2 text-red-400 font-semibold text-sm mb-2">
      <span>❌</span> Error
    </div>
    <div class="text-red-700 text-xs leading-relaxed bg-red-50 rounded p-3 border border-red-200">
      ${message}
    </div>
    <div class="text-gray-400 text-xs mt-2">Check the terminal where uvicorn is running for full error details.</div>
  `;
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const pid    = params.get('patient');
  if (pid) {
    // Auto-select patient from URL e.g. /?patient=PH-119832
    loadPatients().then(() => selectPatient(pid.toUpperCase()));
  } else {
    loadPatients();
  }
});
