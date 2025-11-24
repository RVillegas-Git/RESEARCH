let submissions = {};
let currentSubmissionId = null;

function handleApproveClick(button) {
  const id = button.dataset.id;
  const submission = JSON.parse(button.dataset.submission.replace(/&apos;/g, "'"));
  approveSubmission(id, submission);
}


function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

async function loadSubmission(id) {
  currentSubmissionId = id;
  const data = submissions[id];

  // Set header to show user name
  document.getElementById("formTypeHeader").textContent = data.studentName || "";

  document.getElementById("name").value = data.studentName || "";
  document.getElementById("department").value = data.school || "";
  document.getElementById("course").value = data.course || "";
  document.getElementById("year").value = data.schoolYear || "";

  const activityList = document.getElementById("activityList");
  activityList.innerHTML = "";

  // Group activities by category
  const activitiesByCategory = {};
  data.activities.forEach(act => {
    const cat = act.category || "Uncategorized";
    if (!activitiesByCategory[cat]) activitiesByCategory[cat] = [];
    activitiesByCategory[cat].push(act);
  });

  let totalPoints = 0;

  for (const [category, acts] of Object.entries(activitiesByCategory)) {
    // Fetch dynamic form fields for this category
    let formFields = [];
    try {
      const res = await fetch(`/api/forms/${category.toLowerCase()}`);
      const json = await res.json();
      if (json.success && json.form?.fields) {
        formFields = json.form.fields;
      }
    } catch (err) {
      console.warn(`Failed to fetch form for ${category}`, err);
    }

    // Add category title
    const categoryHeader = document.createElement("h3");
    categoryHeader.textContent = category;
    categoryHeader.style.marginTop = "20px";
    activityList.appendChild(categoryHeader);

    // Create header row
    const headerRow = document.createElement("div");
    headerRow.className = "activity-row header";

    const selectHeader = document.createElement("div");
    selectHeader.textContent = "Select";
    headerRow.appendChild(selectHeader);

    formFields.forEach(f => {
      const th = document.createElement("div");
      th.textContent = f.label || f.name;
      headerRow.appendChild(th);
    });

    const pointsHeader = document.createElement("div");
    pointsHeader.textContent = "Points";
    headerRow.appendChild(pointsHeader);

    const evidenceHeader = document.createElement("div");
    evidenceHeader.textContent = "Evidence";
    headerRow.appendChild(evidenceHeader);

    activityList.appendChild(headerRow);

    // Render each activity row
    acts.forEach(act => {
      const row = document.createElement("div");
      row.className = "activity-row";

      // ➕ Add checkbox for clarification selection
      const checkboxCell = document.createElement("div");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "clarify-checkbox";
      checkbox.dataset.activityId = act._id;
      checkboxCell.appendChild(checkbox);
      row.appendChild(checkboxCell); // first column in row

      formFields.forEach(f => {
        const cell = document.createElement("div");
        let value = act[f.name];
        if (value === undefined) value = getValueByPath(act, f.name);

        if (Array.isArray(value)) {
          cell.textContent = value.join(", ");
        } else if (value instanceof Date) {
          cell.textContent = new Date(value).toLocaleDateString();
        } else {
          cell.textContent = value !== undefined && value !== null && value !== "" ? value : "-";
        }

        row.appendChild(cell);
      });

      const pointsCell = document.createElement("div");
      pointsCell.textContent = act.points ?? "-";
      row.appendChild(pointsCell);

      const evidenceLinks = (act.evidence || [])
        .map(filename => `<a href="/api/evidence/${filename}" target="_blank">${filename}</a>`)
        .join(", ");
      const evidenceCell = document.createElement("div");
      evidenceCell.innerHTML = evidenceLinks || "No file";
      row.appendChild(evidenceCell);

      activityList.appendChild(row);
      totalPoints += Number(act.points) || 0;
    });
  }

  // Total points
  document.getElementById("score").textContent = totalPoints;

  highlightSelectedSidebar();

  // Action buttons
  const topButtons = document.querySelector(".top-buttons");
  topButtons.innerHTML = `
    <button 
      data-id="${id}" 
      data-submission='${JSON.stringify(submissions[id]).replace(/'/g, "&apos;")}' 
      onclick="handleApproveClick(this)">
      Approve
    </button>
    <button onclick="clarifySubmission()">Clarify</button>
  `;
}

function updateSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = "";

  for (const id in submissions) {
    const s = submissions[id];
    const div = document.createElement("div");
    div.className = "sidebar-item";
    div.dataset.id = id;
    div.setAttribute("onclick", `loadSubmission('${id}')`);
    div.innerHTML = `
      <strong>${s.studentName}</strong><br/>
      <em>${s.activities.length} activit${s.activities.length === 1 ? 'y' : 'ies'}</em><br/>
      <small>${s.date || "N/A"}</small>
    `;
    sidebar.appendChild(div);
  }

  highlightSelectedSidebar();
}

function highlightSelectedSidebar() {
  const items = document.querySelectorAll(".sidebar-item");
  items.forEach(item => {
    item.classList.toggle("selected", item.dataset.id === currentSubmissionId);
  });
}



async function approveSubmission(id, submission) {
  if (submission.points < n) {
    alert("This submission is Not Eligible and cannot be approved because it has fewer than 1000 points.");
    return; // 🚫 Stop here, do not proceed
  }

  // Automatically determine medal
  let medal = "Not Eligible";
  if (submission.points >= 5000) {
    medal = "Gold";
  } else if (submission.points >= 3000) {
    medal = "Silver";
  } else if (submission.points >= 1000) {
    medal = "Bronze";
  } 

  try {
    const response = await fetch('/approve-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission, medal })
    });

    const result = await response.json();
    if (!result.success) {
      alert("Error approving submission.");
      return;
    }

    alert(`Submission approved with ${medal} award.`);
    // Optionally refresh:
    // await loadSubmissions();
  } catch (error) {
    console.error("Error during approval:", error);
    alert("An error occurred.");
  }
}


function clarifySubmission() {
  document.getElementById("clarifyModal").style.display = "flex";
}

function closeClarifyModal() {
  document.getElementById("clarifyModal").style.display = "none";
  document.getElementById("clarifyMessage").value = "";
}

async function sendClarification() {
  const message = document.getElementById("clarifyMessage").value.trim();
  if (!message) {
    alert("Please enter your clarification message.");
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser._id) {
    return alert("Validator not found. Please log in again.");
  }

  const submission = submissions[currentSubmissionId];
  if (!submission || !submission.activities || submission.activities.length === 0) {
    return alert("Invalid or missing submission data.");
  }

  // ✅ Get only selected activities
  const checkboxes = document.querySelectorAll(".clarify-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Please select at least one activity to clarify.");
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (const cb of checkboxes) {
    const activityId = cb.dataset.activityId;
    const activity = submission.activities.find(act => act._id === activityId);
    if (!activity || !activity.recipientId) {
      console.warn("Missing info for activity:", activityId);
      failureCount++;
      continue;
    }

    try {
      const notifRes = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: submission.studentId,
          activityId: activity._id,
          message,
          recipientId: activity.recipientId,
          senderId: currentUser._id,
          category: submission.category,
          role: 'validator'
        })
      });

      const notifResult = await notifRes.json();
      if (notifResult.success) {
        successCount++;

        // 👇 Revert status to "Not Submitted"
        await fetch(`/api/activities/${activity._id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: "Not Submitted" })
        });

      } else {
        console.error("Notification failed:", notifResult.message);
        failureCount++;
      }
    } catch (err) {
      console.error("Error clarifying activity:", err);
      failureCount++;
    }
  }

  alert(`Clarification sent to ${successCount} activity(ies). ${failureCount > 0 ? failureCount + " failed." : ""}`);
  closeClarifyModal();
  await loadSubmissions(); // Optional refresh
}

async function loadSubmissions() {
  try {
    // Fetch activities from your backend
    const res = await fetch('/api/activities/submitted-validator');
    const activities = await res.json();

    // Group by studentId only (ignore category)
    submissions = {};
    activities.forEach(act => {
      const groupKey = act.studentId;
      if (!submissions[groupKey]) {
        submissions[groupKey] = {
          studentId: act.studentId,
          studentName: act.studentName,
          school: act.school,
          course: act.course,
          schoolYear: act.schoolYear,
          activities: [],
          points: 0,
          date: act.date
        };
      }
      submissions[groupKey].activities.push(act);
      submissions[groupKey].points += Number(act.points) || 0;

      if (act.date && (!submissions[groupKey].date || new Date(act.date) < new Date(submissions[groupKey].date))) {
        submissions[groupKey].date = act.date;
      }
    });

    updateSidebar();

    // Load the first group if available
    const firstId = Object.keys(submissions)[0];
    if (firstId) {
      loadSubmission(firstId);
    }
  } catch (error) {
    console.error("Failed to load submissions:", error);
    alert("Could not load submissions.");
  }
}
window.onload = loadSubmissions;



// --- Fetch and render notifications (validator) ---
const notifyBtn = document.getElementById('notificationIcon');
const notifDropdown = document.getElementById('notification-list');
if (notifyBtn && notifDropdown) {
  notifyBtn.style.cursor = 'pointer';
  notifyBtn.addEventListener('click', async () => {
    if (notifDropdown.style.display === 'block') {
      notifDropdown.style.display = 'none';
      return;
    }
    try {
      const res = await fetch(`/api/notifications/${currentUser?._id || 'validator'}`);
      const notifications = await res.json();
      notifDropdown.innerHTML = '';
      if (!notifications.length) {
        notifDropdown.innerHTML = '<p>No notifications</p>';
      } else {
        notifications.forEach(n => {
          const div = document.createElement('div');
          div.className = 'notification';
          div.innerHTML = `
            <div class="notif-type">${n.type || ''}</div>
            <div class="notif-message">${n.message}</div>
            <div class="notif-date">${new Date(n.createdAt).toLocaleString()}</div>
            ${n.activityId ? `<div class="notif-action"><button class="inline-activity-btn" data-activity-id="${n.activityId}">📄 View Activity</button></div>` : ''}
          `;
          notifDropdown.appendChild(div);
        });
      }
      notifDropdown.style.display = 'block';
    } catch (err) {
      console.error('❌ Failed to load notifications:', err);
      notifDropdown.innerHTML = '<p>Error loading notifications</p>';
      notifDropdown.style.display = 'block';
    }
  });
}

// Handle click on notification “📄 View Activity”
document.addEventListener('click', async e => {
  const btn = e.target.closest('.inline-activity-btn');
  if (!btn) return;
  const activityId = btn.dataset.activityId;
  console.log('[DEBUG] Clicked View Activity for ID:', activityId);

  try {
    const res = await fetch(`/api/activities/byid/${activityId}`);
    const { success, activity } = await res.json();
    console.log('[DEBUG] Response:', { success, activity });
    if (!success || !activity) {
      alert('Activity not found.');
      return;
    }
    showActivityModal(activity);
  } catch (err) {
    console.error('❌ Error loading activity details:', err);
    alert('Failed to load activity details.');
  }
});

const chatbotBtn = document.getElementById('chatbotIcon');

if (chatbotBtn) {
  chatbotBtn.style.cursor = 'pointer';
  chatbotBtn.addEventListener('click', () => {
    window.open('http://localhost/chatbot/', '_blank');
  });
}

  function logout() {
    if (confirm('Are you sure you want to log out?')) {
      window.location.href = '../login.html';
    }
  }