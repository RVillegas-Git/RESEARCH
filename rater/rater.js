document.addEventListener('DOMContentLoaded', () => {

  // Fetch activities for table
  fetch('/api/activities')
    .then(res => res.json())
    .then(data => {
      renderActivityTable(data.map(act => ({
        ...act,
        studentName: act.studentName || '(Unknown)'
      })));
    })
    .catch(err => {
      console.error('Failed to load submissions:', err);
      const tbody = document.querySelector('#activities-table tbody');
      tbody.innerHTML = `<tr><td colspan="5">Error: ${err.message}</td></tr>`;
    });

  // Top bar notification/chatbot logic
  const notifBtn = document.getElementById('notif-btn');
  const notifBox = document.getElementById('notification-list');
  const chatbotBtn = document.getElementById('chatbot-btn');

  if (notifBtn && notifBox) {
    notifBtn.style.cursor = 'pointer';
    notifBtn.title = 'Notifications';
    notifBtn.addEventListener('click', () => {
      notifBox.style.display = notifBox.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (chatbotBtn) {
    chatbotBtn.style.cursor = 'pointer';
    chatbotBtn.title = 'Open Chatbot';
    chatbotBtn.addEventListener('click', () => {
      window.open('http://localhost/chatbot/', '_blank');
    });
  }

  // Fetch and render notifications for current user
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const currentUserId = currentUser?._id;
  if (currentUserId && /^[a-f\d]{24}$/i.test(currentUserId)) {
    fetch(`/api/notifications/${currentUserId}`)
      .then(res => res.json())
      .then(notifications => {
        const container = document.getElementById('notification-list');
        container.innerHTML = '';
        if (!notifications.length) {
          container.innerHTML = '<p>No notifications</p>';
          return;
        }
        notifications.forEach(n => {
          const div = document.createElement('div');
          div.className = 'notification';
          const notifContent = document.createElement('div');
          notifContent.className = 'notif-content';
          notifContent.innerHTML = `
            <div class="notif-type">${n.type || ''}</div>
            <div class="notif-message">${n.message}</div>
            <div class="notif-date">${new Date(n.createdAt).toLocaleString()}</div>
            <div class="notif-action">
              ${n.activityId ? `<button class="inline-activity-btn" data-activity-id="${n.activityId}">📄 View</button>` : ''}
              <button class="delete-notif-btn" data-notif-id="${n._id}">🗑️ Delete</button>
            </div>
          `;
          div.appendChild(notifContent);
          container.appendChild(div);
        });
      })
      .catch(err => console.error('❌ Failed to load notifications:', err));
  }
});



function renderActivityTable(activities) {
  const tbody = document.querySelector('#activities-table tbody');
  tbody.innerHTML = '';

  if (!Array.isArray(activities) || activities.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No student submissions found.</td></tr>`;
    return;
  }

  activities.forEach(act => {
    const { _id, studentName, category, createdAt, points } = act;

    const row = document.createElement('tr');
    row.setAttribute('data-id', _id); // Add row ID for future actions
    if (act.studentId) {
      row.setAttribute('data-student-id', act.studentId);
    } else {
      console.warn('[WARNING] Missing studentId for row:', act);
    }

    row.innerHTML = `
      <td>${studentName}</td>
      <td>${category}</td>
      <td>${new Date(createdAt).toLocaleDateString()}</td>
      <td class="points-cell">${points}</td>
      <td class="action-cell">
        <button class="action-btn btn-view" title="View"><i class="fas fa-file"></i></button>
        <button class="action-btn btn-edit" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="action-btn btn-request" title="Request More"><i class="fas fa-sync-alt"></i></button>
        <button class="action-btn btn-submit" title="Submit"><i class="fas fa-share-square"></i></button>
      </td>
    `;

    tbody.appendChild(row);
    row._studentName = studentName;  // Save the name on the row itself
  });

  // ⬇️ Add event listeners after rendering
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('tr');
      const id = row.getAttribute('data-id');
      const currentPoints = row.querySelector('.points-cell').textContent;

      const newPoints = prompt('Enter new points:', currentPoints);
      if (newPoints === null) return;

      const parsedPoints = parseInt(newPoints, 10);
      if (isNaN(parsedPoints)) {
        alert('Invalid number');
        return;
      }

      try {
        // ✅ Step 1: Fetch the full existing activity
        const fetchRes = await fetch(`/api/activities/byid/${id}`);
        const fetchJson = await fetchRes.json();

        if (!fetchJson.success || !fetchJson.activity) {
          alert('Failed to fetch activity for update.');
          return;
        }

        // ✅ Step 2: Build the updated activity with new points
        const updatedActivity = {
          ...fetchJson.activity,
          points: parsedPoints,
          updatedAt: new Date().toISOString()
        };

        // Remove _id field if present (MongoDB won't accept it on update)
        delete updatedActivity._id;

        // ✅ Step 3: Send full updated activity back to the server
        const res = await fetch(`/api/activities/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedActivity)
        });

        const result = await res.json();
        if (result.success) {
          row.querySelector('.points-cell').textContent = parsedPoints;
          alert('Points updated successfully!');
        } else {
          alert('Failed to update: ' + (result.message || 'Unknown error'));
        }

      } catch (err) {
        console.error('Error updating points:', err);
        alert('Server error while updating points.');
      }
    });
  });

}

document.addEventListener('click', async (e) => {
  if (e.target.closest('.btn-submit')) {
    const row = e.target.closest('tr');
    const id = row.getAttribute('data-id');

    if (!id) return;

    const confirmSubmit = confirm('Are you sure you want to mark this activity as Submitted?');
    if (!confirmSubmit) return;

    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      if (!currentUser || !currentUser._id) {
        return alert("Rater not found. Please log in again.");
      }

      const res = await fetch(`/api/activities/${id}/submit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raterId: currentUser._id
        })
      });

      const result = await res.json();
      if (result.success) {
        alert('Activity submitted successfully!');
        row.remove(); // Remove row from table after successful update
      } else {
        alert('Failed to submit activity: ' + result.message);
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Something went wrong while submitting.');
    }
  }
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('.btn-delete')) {
    const row = e.target.closest('tr');
    const id = row.getAttribute('data-id');

    if (confirm('Mark this activity as Not Submitted?')) {
      try {
        const res = await fetch(`/api/activities/${id}/mark-not-submitted`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const result = await res.json();
        if (result.success) {
          row.remove(); // remove row from table
        } else {
          alert('Failed to mark as Not Submitted');
        }
      } catch (err) {
        console.error(err);
        alert('An error occurred');
      }
    }
  }
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('.btn-view')) {
    const row = e.target.closest('tr');
    const id = row.getAttribute('data-id');

    try {
      console.debug('[DEBUG] Fetching activity by ID:', id);
      const res = await fetch(`/api/activities/byid/${id}`);
      const { success, activity } = await res.json();

      if (!success || !activity) {
        alert('Failed to fetch activity');
        return;
      }

      // Fetch form fields dynamically based on category
      const formRes = await fetch(`/api/forms/${activity.category?.toLowerCase()}`);
      const formJson = await formRes.json();
      const fields = formJson.success ? formJson.form.fields : [];

      // Populate modal content
      const detailsContainer = document.getElementById('activityDetails');
      let html = '';

      // Optionally show student and category
      if (row._studentName) html += `<p><strong>Student:</strong> ${row._studentName}</p>`;
      if (activity.category) html += `<p><strong>Category:</strong> ${activity.category}</p>`;

      // Dynamically display fields
      fields.forEach(field => {
        const value = getValueByPath(activity, field.name);
        const display = Array.isArray(value) ? value.join(', ') :
                        value !== undefined && value !== null ? value : '-';
        html += `<p><strong>${field.label || field.name}:</strong> ${display}</p>`;
      });

      // Add system-level info
      html += `
        <p><strong>Status:</strong> ${activity.status || '-'}</p>
        <p><strong>Points:</strong> ${activity.points ?? '-'}</p>
        <p><strong>Created At:</strong> ${activity.createdAt ? new Date(activity.createdAt).toLocaleString() : '-'}</p>
      `;

      detailsContainer.innerHTML = html;

      // Evidence handling
      const evidenceList = document.getElementById('evidenceList');
      evidenceList.innerHTML = '';
      if (Array.isArray(activity.evidence) && activity.evidence.length > 0) {
        activity.evidence.forEach(file => {
          const li = document.createElement('li');
          li.innerHTML = `<a href="/api/evidence/${file}" target="_blank">${file}</a>`;
          evidenceList.appendChild(li);
        });
      } else {
        evidenceList.innerHTML = '<li>No evidence uploaded.</li>';
      }

      // Show modal
      document.getElementById('viewModal').style.display = 'flex';

    } catch (err) {
      console.error('[ERROR] Failed to fetch or render activity:', err);
      alert('Failed to fetch activity details');
    }
  }
});
function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}


// Close modal when X is clicked
document.getElementById('closeViewModal').addEventListener('click', () => {
  document.getElementById('viewModal').style.display = 'none';
});

// Close modal when clicking outside of modal content
window.addEventListener('click', (e) => {
  const modal = document.getElementById('viewModal');
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

let currentRequestTarget = null; // To hold the row/activity for the request

document.addEventListener('click', async (e) => {
  const requestBtn = e.target.closest('.btn-request');
  if (requestBtn) {
    const row = requestBtn.closest('tr');
    currentRequestTarget = row;
    console.log('[DEBUG] Preparing to send request for studentId:', row.getAttribute('data-student-id'));
    
    // Show modal
    document.getElementById('requestMessage').value = '';
    document.getElementById('requestModal').style.display = 'flex';
  }
});

// Modal controls
document.getElementById('closeRequestModal').addEventListener('click', () => {
  document.getElementById('requestModal').style.display = 'none';
});

document.getElementById('cancelRequestBtn').addEventListener('click', () => {
  document.getElementById('requestModal').style.display = 'none';
});

// Send request to server
document.getElementById('sendRequestBtn').addEventListener('click', async () => {
  const message = document.getElementById('requestMessage').value.trim();
  if (!message) return alert('Please enter a message');

  const row = currentRequestTarget;
  const id = row.getAttribute('data-id');
  const studentId = row.getAttribute('data-student-id');

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser._id) {
    return alert("User not found. Please log in again.");
  }

  const isValidObjectId = (oid) => /^[a-f\d]{24}$/i.test(oid);
  if (!isValidObjectId(studentId)) {
    return alert('Invalid student ID format');
  }

  try {
    console.log('[DEBUG] Sending notification:', {
      studentId,
      activityId: id,
      message,
      recipientId: studentId,      // 👈 student receives the notification
      senderId: currentUser._id    // 👈 rater is the sender
    });

    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,          // who owns the activity
        activityId: id,     // the activity being requested
        message,
        recipientId: studentId,
        senderId: currentUser._id,
        role: 'rater'  // ✅ ADD THIS
      })
    });

    const result = await res.json();
    if (result.success) {
      alert('Request sent successfully!');
    } else {
      alert('Failed to send request');
    }
  } catch (err) {
    console.error('Request failed:', err);
    alert('Error sending request');
  }

  document.getElementById('requestModal').style.display = 'none';
});



function showActivityModal(activity) {
  const modal = document.getElementById('viewModal');
  const detailsDiv = document.getElementById('activityDetails');
  const evidenceList = document.getElementById('evidenceList');

  if (!modal || !detailsDiv || !evidenceList) return;

  let html = '';

  // Always show these if available
  if (activity.studentName) html += `<p><strong>Student:</strong> ${activity.studentName}</p>`;
  if (activity.category) html += `<p><strong>Category:</strong> ${activity.category}</p>`;
  if (activity.status) html += `<p><strong>Status:</strong> ${activity.status}</p>`;
  if (typeof activity.points !== 'undefined') html += `<p><strong>Points:</strong> ${activity.points}</p>`;

  // Dynamically render any form fields
  let formFields = activity.formData || activity.fields || activity.dynamicFields;

  if (!formFields) {
    // Fallback: extract any keys that aren't system-related
    const exclude = ['_id', 'studentId', 'recipientId', 'validatorId', 'createdAt', 'updatedAt', 'status', 'points', 'category', 'evidence', 'studentName'];
    formFields = {};

    for (const [key, value] of Object.entries(activity)) {
      if (!exclude.includes(key)) {
        formFields[key] = value;
      }
    }
  }

  if (typeof formFields === 'object' && Object.keys(formFields).length > 0) {
    for (const [key, value] of Object.entries(formFields)) {
      const prettyKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      html += `<p><strong>${prettyKey}:</strong> ${value || '-'}</p>`;
    }
  } else {
    html += '<p><em>No additional form details.</em></p>';
  }

  detailsDiv.innerHTML = html;

  // Evidence section
  evidenceList.innerHTML = '';
  if (Array.isArray(activity.evidence) && activity.evidence.length > 0) {
    activity.evidence.forEach(file => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="/api/evidence/${file}" target="_blank">${file}</a>`;
      evidenceList.appendChild(li);
    });
  } else {
    evidenceList.innerHTML = '<li>No evidence uploaded.</li>';
  }

  modal.style.display = 'flex';
}

// Close the view modal when "×" is clicked
document.getElementById('closeViewModal')?.addEventListener('click', () => {
  document.getElementById('viewModal').style.display = 'none';
});

// Replace your current inline-activity-btn code with this:
document.addEventListener('click', async (e) => {
  // 📄 Handle View Activity from notification
  const viewBtn = e.target.classList.contains('inline-activity-btn') ? e.target : e.target.closest('.inline-activity-btn');
  if (viewBtn) {
    const activityId = viewBtn.dataset.activityId;
    if (!activityId) return;

    try {
      const res = await fetch(`/api/activities/byid/${activityId}`);
      const response = await res.json();
      if (!response.success || !response.activity) {
        alert('Failed to load activity details.');
        return;
      }
      showActivityModal(response.activity);
    } catch (err) {
      console.error('Error loading activity from notification:', err);
      alert('Failed to load activity details.');
    }
    return;
  }

  // 🗑️ Handle Delete Notification
  const deleteBtn = e.target.closest('.delete-notif-btn');
  if (deleteBtn) {
    const notifId = deleteBtn.dataset.notifId;
    if (!notifId || !/^[a-f\d]{24}$/i.test(notifId)) {
      alert('Invalid notification ID');
      return;
    }

    const confirmDelete = confirm('Are you sure you want to delete this notification?');
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/notifications/${notifId}`, {
        method: 'DELETE'
      });
      const result = await res.json();

      if (result.success) {
        const notifDiv = deleteBtn.closest('.notification');
        notifDiv?.remove();
      } else {
        alert('Failed to delete notification.');
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      alert('An error occurred while deleting.');
    }
  }
});