document.addEventListener('DOMContentLoaded', async function () {
  let currentUser = null;
  let currentFormDefinition = null;  
  let currentEditingId = null;
  console.log('Initial currentUser from localStorage:', localStorage.getItem('currentUser'));
  // ====================== Rater/Validator Confirmation ======================
  const categoryFilter = document.getElementById("categoryFilter");
  const confirmationList = document.getElementById("confirmationList");

  // Fetch and render the confirmation entries
  async function loadConfirmationSection() {
    if (!currentUser || !currentUser._id) return;

    try {
      const response = await fetch(`/api/activities/${currentUser._id}`);
      const activities = await response.json();

      // Sort by submission date (oldest to newest)
      activities.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      renderConfirmationList(activities);
    } catch (err) {
      console.error("Failed to load confirmation data:", err);
    }
  }

  // Render confirmation cards based on filtered category
  function renderConfirmationList(activities) {
    const selectedCategory = categoryFilter.value;
    confirmationList.innerHTML = ''; // Clear existing

    const filtered = selectedCategory === 'all'
      ? activities
      : activities.filter(act => act.category === selectedCategory);

    if (filtered.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="3">No submissions found for this category.</td>`;
      confirmationList.appendChild(row);
      return;
    }

    filtered.forEach((activity, index) => {
      const row = document.createElement('tr');

      const categoryDisplay = capitalize(activity.category || '—');
      const submittedDate = activity.createdAt
        ? new Date(activity.createdAt).toLocaleDateString()
        : '—';

      row.innerHTML = `
        <td>${categoryDisplay}</td>
        <td>${submittedDate}</td>
        <td><button class="view-btn" data-index="${index}">View</button></td>
      `;

      confirmationList.appendChild(row);

      row.querySelector('.view-btn').addEventListener('click', () => {
        openConfirmationPopup(activity);
      });
    });
  }

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function () {
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');

      const sectionId = this.getAttribute('data-section') + '-section';
      document.querySelectorAll('.main-section').forEach(s => s.style.display = 'none');
      document.getElementById(sectionId).style.display = 'block';

    });
  });

  async function loadPerformanceRating() {
    console.log("▶️ loadPerformanceRating called");

    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (!currentUser || !currentUser._id) {
      console.error("❌ studentId not found in localStorage.");
      return;
    }

    const studentId = currentUser._id;
    try {
      const res = await fetch(`/api/activities/byStudent?studentId=${studentId}`);
      const data = await res.json();

      if (!Array.isArray(data)) {
        console.error("❌ Expected an array of activities.");
        return;
      }

      // Group activities by category
      const grouped = data.reduce((acc, activity) => {
        const category = activity.category || 'Uncategorized';
        if (!acc[category]) acc[category] = [];
        acc[category].push(activity);
        return acc;
      }, {});

      // Clear the container
      const container = document.getElementById("rating-section");
      container.innerHTML = "<h2>My Performance Submissions</h2>";

      // Render each category section
      Object.entries(grouped).forEach(([category, activities]) => {
        const sectionTitle = document.createElement("h3");
        sectionTitle.textContent = category;
        container.appendChild(sectionTitle);

        const table = document.createElement("table");
        table.classList.add("styled-table");

        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");

        if (activities.length > 0) {
          // Extract dynamic keys from first object
          const excludedKeys = ['_id', 'studentId', '__v', 'status', 'createdAt', 'studentName'];
          const activityKeys = Object.keys(activities[0]).filter(key => !excludedKeys.includes(key));

          // Header row
          const headerRow = document.createElement("tr");
          headerRow.innerHTML = `<th>No.</th>` + activityKeys.map(key => `<th>${formatHeader(key)}</th>`).join('');
          thead.appendChild(headerRow);

          // Data rows
          activities.forEach((activity, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>${index + 1}</td>
              ${activityKeys.map(key => `<td>${formatCell(activity[key])}</td>`).join('')}
            `;
            tbody.appendChild(row);
          });

          table.appendChild(thead);
          table.appendChild(tbody);
          container.appendChild(table);
        }
      });

    } catch (err) {
      console.error("❌ Error fetching performance rating:", err);
    }
  }

  // 🔤 Helper to prettify headers
  function formatHeader(key) {
    return key
      .replace(/([A-Z])/g, " $1")      // camelCase to space
      .replace(/_/g, " ")               // snake_case to space
      .replace(/\b\w/g, c => c.toUpperCase()); // capitalize
  }

  // 🧱 Helper to safely format values
  function formatCell(value) {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? '✔️' : '❌';
    if (!value) return '-';
    return value;
  }


  // View details in popup
  function openConfirmationPopup(activity) {
    const table = document.createElement('table');
    let rows = '';

    // Fields to exclude from display
    const excludedKeys = ['_id', 'studentId', 'createdAt', 'updatedAt', 'recipientId', 'validatorId', 'points', 'evidence', '__v', 'status'];

    for (const [key, value] of Object.entries(activity)) {
      if (excludedKeys.includes(key)) continue;

      // Skip if value is null/undefined or an object (like ObjectId or nested)
      if (value && typeof value !== 'object') {
        // Convert camelCase or snake_case to readable label
        const label = key
          .replace(/_/g, ' ')                    // snake_case to space
          .replace(/([A-Z])/g, ' $1')           // camelCase spacing
          .replace(/^./, str => str.toUpperCase()); // Capitalize first letter

        rows += `<tr><td><strong>${label}:</strong></td><td>${value}</td></tr>`;
      }
    }

    // Handle evidence
    const evidenceHTML = Array.isArray(activity.evidence) && activity.evidence.length > 0
      ? activity.evidence.map((fileName) =>
          `<a href="/api/evidence/${encodeURIComponent(fileName)}" target="_blank" download>${fileName}</a>`
        ).join('<br>')
      : 'No evidence';

    rows += `<tr><td><strong>Evidence:</strong></td><td>${evidenceHTML}</td></tr>`;
    rows += `<tr><td><strong>Status:</strong></td><td>${activity.status || '—'}</td></tr>`;

    table.innerHTML = rows;

    // Inject into modal
    const container = document.getElementById('confirmationDetails');
    container.innerHTML = '';
    container.appendChild(table);
    document.getElementById('confirmationPopup').style.display = 'flex';
  }


  // Listen to dropdown change
  categoryFilter.addEventListener('change', loadConfirmationSection);

  // Load when tab is activated
  document.querySelector('[data-section="confirmation"]').addEventListener('click', loadConfirmationSection);

  // ====================== SESSION MANAGEMENT ======================
  async function initDashboard() {
    try {
      const userData = localStorage.getItem('currentUser');
      
      if (!userData) {
        throw new Error('No user session found');
      }

      currentUser = JSON.parse(userData);

      if (!currentUser || typeof currentUser !== 'object' || !currentUser._id) {
        console.error('Invalid user data:', currentUser);
        throw new Error('User data is invalid');
      }

      document.getElementById('name').value = currentUser.name || '';
      await loadActivities();
      
      console.log('Dashboard initialized for:', currentUser._id);
      return true;
    } catch (error) {
      console.error('Dashboard initialization failed:', error);
      alert(`Session error: ${error.message}. Redirecting to login.`);
      
      localStorage.removeItem('currentUser');
      window.location.href = '/login.html';
      return false;
    }
  }


  
  async function loadActivities() {
    try {
      if (!currentUser || !currentUser._id) {
        throw new Error('Cannot load activities: no user session');
      }

      const response = await fetch(`/api/activities/${currentUser._id}`);
      
      if (response.status === 401) {
        throw new Error('session_expired');
      }
      
      if (!response.ok) {
        throw new Error('Failed to load activities');
      }
      
      const activities = await response.json();
      renderActivities(activities);
    } catch (error) {
      if (error.message === 'session_expired') {
        localStorage.removeItem('currentUser');
        alert('Session expired. Please login again.');
        window.location.href = '/login.html';
      } else {
        console.error('Error loading activities:', error);
        alert('Failed to load activities');
      }
    }
  }

  async function loadAwards() {
    try {
      const res = await fetch(`/api/student/awards/${currentUser._id}`);
      const awards = await res.json();

      // Clear the existing summary rows
      const tbody = document.querySelector('#awards-table tbody');
      tbody.innerHTML = '';

      if (!Array.isArray(awards) || awards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No awards found</td></tr>';
        return;
      }

      // Use your existing renderAwardTable helper
      renderAwardTable(awards);

    } catch (error) {
      console.error('Error loading awards:', error);
    }
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return isNaN(date) ? 'N/A' : date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  function renderAwardTable(awards) {
    const tbody = document.querySelector('#awards-table tbody');
    tbody.innerHTML = '';

    if (!awards || awards.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No awards found</td></tr>';
      return;
    }

    awards.forEach((award, awardIndex) => {
      // ➤ Main award summary row
      const summaryRow = document.createElement('tr');
      summaryRow.classList.add('award-summary');
      summaryRow.innerHTML = `
        <td><strong>${formatDate(award.date)}</strong></td>
        <td>${award.activities?.length || 0}</td>
        <td>${award.points || 0}</td>
        <td class="medal ${award.medal?.toLowerCase()}">${award.medal || 'N/A'}</td>
        <td><button class="toggle-btn" data-index="${awardIndex}">Show Activities</button></td>
      `;
      tbody.appendChild(summaryRow);

      // ➤ Activity details row (initially hidden)
      const activityRow = document.createElement('tr');
      activityRow.classList.add('activity-details');
      activityRow.style.display = 'none';

      const activityCell = document.createElement('td');
      activityCell.colSpan = 5;

      // Group activities by their category
      const grouped = (award.activities || []).reduce((acc, act) => {
        const cat = act.category || 'Uncategorized';
        (acc[cat] = acc[cat] || []).push(act);
        return acc;
      }, {});

      // For each category, build a mini‑table
      for (const [cat, acts] of Object.entries(grouped)) {
        // Category heading
        const catHeading = document.createElement('div');
        catHeading.style.margin = '10px 0 4px';
        catHeading.innerHTML = `<strong>${capitalize(cat)}</strong>`;
        activityCell.appendChild(catHeading);

        // Determine columns from the first item in this category
        const excluded = ['_id','studentId','studentName','school','course','schoolYear','status','createdAt','updatedAt','recipientId','validatorId','__v'];
        const cols = Object.keys(acts[0] || {})
          .filter(k => !excluded.includes(k) && typeof acts[0][k] !== 'object');

        // Build the table
        const mini = document.createElement('table');
        mini.classList.add('nested-table');
        // head
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.innerHTML = `<th>#</th>` +
          cols.map(c => `<th>${formatHeader(c)}</th>`).join('');
        thead.appendChild(headRow);
        mini.appendChild(thead);

        // body
        const tbodyMini = document.createElement('tbody');
        acts.forEach((act, idx) => {
          const r = document.createElement('tr');
          r.innerHTML = `<td>${idx+1}</td>` +
            cols.map(c => `<td>${formatCell(act[c])}</td>`).join('');
          tbodyMini.appendChild(r);
        });
        mini.appendChild(tbodyMini);

        activityCell.appendChild(mini);
      }

      activityRow.appendChild(activityCell);
      tbody.appendChild(activityRow);
    });

    // ➤ Toggle logic
    document.querySelectorAll('.toggle-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const rows = document.querySelectorAll('.activity-details');
        const row = rows[idx];
        const isVisible = row.style.display === 'table-row';
        row.style.display = isVisible ? 'none' : 'table-row';
        btn.textContent = isVisible ? 'Show Activities' : 'Hide Activities';
      });
    });
  }


  function formatCategoryName(category) {
    if (!category) return 'Uncategorized';
    return category
      .replace(/([A-Z])/g, ' $1')         // camelCase to space
      .replace(/_/g, ' ')                 // snake_case to space
      .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letters
  } 

  async function loadTotalPoints() {
    if (!currentUser || !currentUser._id) return;

    try {
      const res = await fetch(`/api/total-points/${currentUser._id}`);
      const data = await res.json();
      
      if (data.success) {
        const totals = data.totals;

        // Update each section's total
        for (const category in totals) {
          const total = totals[category];
          const container = document.querySelector(`#${category} .points-earned`);
          if (container) container.textContent = `${total} Points`;
        }

        // Detect currently visible .activities-section
        const visibleSection = document.querySelector('.activities-section:not([style*="display: none"])');
        if (visibleSection) {
          const categoryId = visibleSection.id;
          const categoryTotal = totals[categoryId] || 0;

          // Update the bottom total to reflect current section
          const grandTotalSpan = document.querySelector('.points span');
          if (grandTotalSpan) grandTotalSpan.textContent = `${categoryTotal} Points`;
        }
      }
    } catch (err) {
      console.error("Failed to load total points:", err);
    }
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
  }
  // dash.js - Update renderActivities function
  function renderActivities(activities) {
    const tbody = document.querySelector('#main-table tbody');
    const thead = document.querySelector('#main-table thead');
    tbody.innerHTML = '';

    if (!currentFormDefinition) {
      thead.innerHTML = `<tr><th>#</th><th>Error</th><th>No form definition available.</th></tr>`;
      return;
    }

    // Build dynamic headers
    let headerHTML = `<tr><th></th><th>#</th>`;
    currentFormDefinition.fields.forEach(field => {
      if (field.name !== 'status') {
        headerHTML += `<th>${capitalize(field.label || field.name)}</th>`;
      }
    });
    headerHTML += `<th>View Evidence</th></tr>`;
    thead.innerHTML = headerHTML;

    // Filter activities by category
    const filtered = currentCategoryKey
      ? activities.filter(act => act.category === currentCategoryKey)
      : activities;

    filtered.forEach((activity, index) => {
      const row = document.createElement('tr');
      let rowHTML = `
        <td><input type="checkbox" class="row-checkbox"></td>
        <td>${index + 1}</td>
      `;

      currentFormDefinition.fields.forEach(field => {
        if (field.name !== 'status') {
          let value = activity[field.name];
          if (field.name === 'date' && value) {
            value = new Date(value).toLocaleDateString();
          }
          rowHTML += `<td>${value || '—'}</td>`;
        }
      });

      rowHTML += `
        <td>
          ${Array.isArray(activity.evidence) && activity.evidence.length > 0 ? 
            activity.evidence.map((fileId, i) => 
              `<a href="/api/evidence/${encodeURIComponent(fileId)}" target="_blank" download>
                <i class="fas fa-download"></i> File ${i + 1}
              </a>`
            ).join('<br>') : 'No evidence'}
        </td>
      `;

      row.innerHTML = rowHTML;
      row.dataset.id = activity._id;
      row.dataset.evidence = activity.evidence || '';
      tbody.appendChild(row);
    });
  }

  // ====================== FILE UPLOAD HANDLER ======================
  async function uploadActivity(activityData) {
    try {
      const formData = new FormData();
      
      formData.append('activity', activityData.activity);
      formData.append('venue', activityData.venue);
      formData.append('date', activityData.date);
      formData.append('nature', activityData.nature);
      formData.append('role', activityData.role);
      formData.append('points', activityData.points);
      formData.append('status', activityData.status);
      formData.append('raterId', null);
      formData.append('validatorId', null);
      const fileInput = document.querySelector('input[name="evidence"]');
      if (fileInput && fileInput.files.length > 0) {
        for (const file of fileInput.files) {
          formData.append('evidence', file);
        }
      }
      
      formData.append('studentId', currentUser._id);
      formData.append('category', selectedCategoryKey);
      //formData.append('points', Math.floor(Math.random() * 46) + 5);
      formData.append('status', 'Not Submitted');

      const response = await fetch('/api/activities', {
        method: 'POST',
        body: formData
      });
      
      return await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, message: 'Network error' };
    }
  }

  // Initialize dashboard
  const dashboardInitialized = await initDashboard();
  if (!dashboardInitialized) return;

  console.log('Current user after init:', currentUser);

  // ====================== UI COMPONENTS ======================
  // Menu item selection
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.main-section');

  menuItems.forEach(item => {
    item.addEventListener('click', async () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const sectionId = item.getAttribute('data-section') + '-section';

      if (sectionId === "rating-section") {
        loadPerformanceRating(); // loads data into the table
      }
      if (sectionId === "award-section") {
        loadAwards();
      }
      sections.forEach(sec => sec.style.display = 'none');
      const target = document.getElementById(sectionId);
      if (target) target.style.display = 'block';

      if (sectionId === 'confirmation-section') {
        await loadConfirmationSection();
      }
    });
  });

  // Tab selection
  const tabs = document.querySelectorAll('.tab');

  function saveActiveTab() {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
      localStorage.setItem('activeTab', activeTab.textContent.trim());
    }
  }

  function loadActiveTab() {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
      tabs.forEach(tab => {
        if (tab.textContent.trim() === savedTab) {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
        }
      });
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      saveActiveTab();
    });
  });

  loadActiveTab();

  // Hamburger menu
  const hamburger = document.querySelector('.hamburger');
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      sidebar.style.display = (sidebar.style.display === 'none' || sidebar.style.display === '') ? 'block' : 'none';
    } else {
      const isHidden = sidebar.style.display === 'none';
      sidebar.style.display = isHidden ? 'block' : 'none';
      content.style.marginLeft = isHidden ? '230px' : '0';
    }
  }

  hamburger.addEventListener('click', toggleSidebar);

  // Window resize handler
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
      sidebar.style.display = 'block';
      content.style.marginLeft = '230px';
    } else {
      sidebar.style.display = 'none';
      content.style.marginLeft = '0';
    }
  });

  // Edit buttons
  document.querySelectorAll('.edit-row').forEach(button => {
    button.addEventListener('click', function() {
      const row = this.closest('tr');
      alert('Editing row: ' + (Array.from(row.parentNode.children).indexOf(row) + 1));
    });
  });

  // Checkbox row highlighting
  document.querySelectorAll('table input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const row = this.closest('tr');
      row.style.backgroundColor = this.checked ? '#f0f0f0' : '';
    });
  });

  // Logout
  const logoutButton = document.querySelector('.logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      const confirmLogout = confirm('Are you sure you want to log out?');
      if (confirmLogout) {
        localStorage.removeItem('currentUser');
        alert('You have been logged out successfully!');
        window.location.href = '/login.html';
      }
    });
  }

  // User dropdown menu
  const userProfile = document.querySelector('.user-profile');
  if (userProfile) {
    userProfile.addEventListener('click', function() {
      const dropdown = document.querySelector('.dropdown-menu');
      if (dropdown) dropdown.classList.toggle('show');
    });

    document.addEventListener('click', function(event) {
      const dropdown = document.querySelector('.dropdown-menu');
      if (dropdown && !userProfile.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('show');
      }
    });
  }

  // Get saved values
  const name = localStorage.getItem("studentName");
  const school = localStorage.getItem("studentSchool");
  const course = localStorage.getItem("studentCourse");
  const year = localStorage.getItem("studentYear");

  // Populate fields
  if (name) document.getElementById("name").value = name;
  if (school) document.getElementById("dept").innerHTML = `<option selected>${school}</option>`;
  if (course) document.getElementById("course").innerHTML = `<option selected>${course}</option>`;
  if (year) document.getElementById("year").innerHTML = `<option selected>2nd Semester SY ${year}</option>`;


  // Save on Enter
  document.querySelector('.student-info').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const updatedName = document.getElementById("name").value;
      const updatedSchool = document.getElementById("dept").value;
      const updatedCourse = document.getElementById("course").value;
      const updatedYear = document.getElementById("year").value;

      localStorage.setItem("studentName", updatedName);
      localStorage.setItem("studentSchool", updatedSchool);
      localStorage.setItem("studentCourse", updatedCourse);
      localStorage.setItem("studentYear", updatedYear);

      document.getElementById("name").disabled = true;
      document.getElementById("dept").disabled = true;
      document.getElementById("course").disabled = true;
      document.getElementById("year").disabled = true;
      alert("Student information saved successfully!");
    }
  });

  // Utility functions
  window.addItem = () => alert("Add action triggered");
  window.editItem = () => alert("Edit action triggered");
  window.viewItem = () => alert("View action triggered");
  window.deleteItem = () => alert("Delete action triggered");

  // 🔽 Add this below your utility block
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
  }

  // ====================== MAIN FORM HANDLING ======================
  async function handleFormToTable() {
    const form = document.querySelector('#form-container form');
    const fileInput = form.querySelector('input[type="file"]');
    const evidence = fileInput?.files[0]?.name;

    const formData = collectFormData(); // new function below

    if (!activity || !venue || !date || !nature || !role || !evidence) {
      alert("Please complete all required fields.");
      return;
    }

    try {
      const uploadResult = await uploadActivity({
        ...formData,
        points: Math.floor(Math.random() * 46) + 5,
        status: "Not Submitted"
      });

      if (!uploadResult.success) {
        throw new Error(uploadResult.message || 'Failed to upload activity');
      }

      // Reload activities after successful upload
      await loadActivities();
      
      document.querySelector('form').reset();
      document.querySelector('.file-name').textContent = "";
      
      alert('Activity added successfully!');
    } catch (error) {
      console.error('Activity submission failed:', error);
      alert(`Error: ${error.message}`);
    }
  } 

  // ADD button
  document.querySelector('.btn-blue').addEventListener('click', handleFormToTable);

  function getSelectedRows() {
    return Array.from(document.querySelectorAll('table tbody tr')).filter(row => {
      const checkbox = row.querySelector('td input[type="checkbox"]');
      return checkbox && checkbox.checked;
    });
  }

  // Delete selected rows and remove from database
  document.querySelector('.btn-red').addEventListener('click', async () => {
    const selectedRows = getSelectedRows();
    if (selectedRows.length === 0) return alert('Please select a row to delete.');

    const confirmed = confirm("Are you sure you want to delete the selected row(s)?");
    if (!confirmed) return;

    for (const row of selectedRows) {
      const activityId = row.dataset.id;

      try {
        const res = await fetch(`/api/activities/${activityId}`, {
          method: 'DELETE'
        });

        if (!res.ok) {
          const text = await res.text(); // to read HTML error messages
          throw new Error(`Server returned ${res.status}: ${text}`);
        }
        const result = await res.json();
        if (result.success) {
          row.remove(); // remove from UI only if backend confirms deletion
          console.log(`✅ Deleted activity with ID: ${activityId}`);
        } else {
          console.warn(`⚠️ Failed to delete activity with ID: ${activityId}`);
        }
      } catch (err) {
        console.error(`❌ Error deleting activity with ID: ${activityId}`, err);
      }
    }
  });



  // Close modal when ❌ is clicked
  document.querySelector('#evidenceModal .close-btn').addEventListener('click', function () {
    document.getElementById('evidenceModal').style.display = 'none';
  });

  // Close modal when clicking outside
  window.addEventListener('click', function (e) {
    const modal = document.getElementById('evidenceModal');
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  function hasData(row) {
    const cells = row.querySelectorAll('td');
    const activity = cells[2]?.innerText.trim();
    const venue = cells[3]?.innerText.trim();
    const date = cells[4]?.innerText.trim();
    return activity || venue || date;
  }

  function enableEditing(row) {
    const cells = row.querySelectorAll('td');
    for (let i = 2; i <= 4; i++) {
      cells[i].contentEditable = 'true';
      cells[i].style.backgroundColor = '#ffffcc';

      cells[i].addEventListener('keydown', function handleEnter(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          for (let j = 2; j <= 4; j++) {
            cells[j].contentEditable = 'false';
            cells[j].style.backgroundColor = '';
          }
        }
      }, { once: true });
    }
  }

  function collectFormData() {
    const form = document.querySelector('#form-container form');
    const inputs = form.querySelectorAll('input, select, textarea');
    const data = {};

    inputs.forEach(input => {
      if (input.type === 'file') return; // handle separately in FormData
      data[input.name] = input.value.trim();
    });

    return data;
  }

  function populatePopupForm(activity) {
    const popupForm = document.getElementById('popupForm');
    const popupContent = document.getElementById('popupContent');

    // Clear previous form
    popupContent.innerHTML = '';

    const form = document.createElement('form');
    form.innerHTML = currentFormDefinition.fields.map(field => {
      const label = field.label || field.name;
      const value = activity[field.name] || '';
      if (field.type === 'select') {
        return `
          <label>${label}:</label>
          <select name="${field.name}">
            ${field.options.map(opt => `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        `;
      }
      return `<label>${label}:</label><input type="text" name="${field.name}" value="${value}" />`;
    }).join('');

    form.innerHTML += `<button type="submit">Save Changes</button>`;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {};
      const inputs = form.querySelectorAll('input, select');
      inputs.forEach(input => {
        formData[input.name] = input.value;
      });

      try {
        const res = await fetch(`/api/activities/${activity._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const result = await res.json();
        if (result.success) {
          alert('Activity updated successfully.');
          popupForm.style.display = 'none';
          await loadActivities();
        } else {
          throw new Error(result.message || 'Failed to update activity');
        }
      } catch (err) {
        console.error('Update failed:', err);
        alert('Failed to update activity: ' + err.message);
      }
    });

    popupContent.appendChild(form);
    popupForm.style.display = 'block';
  }


  // Row-level Edit Buttons
  document.querySelectorAll('table tbody .btn-green').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (hasData(row)) {
        enableEditing(row);
      } else {
        alert('Cannot edit empty row.');
      }
    });
  });

  let selectedCategoryKey = null;
  let currentCategoryKey = null;
  const categoryMapping = {
    'Co-curricular and Extracurricular': 'co-curricular',
    'Community Outreach and Socio Civic': 'community',
    'Creative/Original Efforts in Arts, Science & Tech': 'creative',
    'Combined Curricular/ Co/Extra-Curricular': 'combined',
    'Marshals/ Peer Facilitator /Peer Tutors': 'marshals',
    'Officers': 'officers',
    'University Student Councils': 'councils',
    'Athletes': 'athletes'
  };

  function updateTableHeaders(category) {
    const thead = document.querySelector('#main-table thead');
    let headerHTML = `
      <tr>
        <th></th>
        <th>#</th>
    `;

    switch (category) {
      case 'co-curricular':
      case 'community':
        headerHTML += `
          <th>Activity/Theme</th>
          <th>Venue</th>
          <th>Date</th>
        `;
        break;
      case 'creative':
        headerHTML += `
          <th>Nature of Activity</th>
          <th></th>
          <th>Date</th>
        `;
        break;
      case 'combined':
        headerHTML += `
          <th>Organization & Nature</th>
          <th>Venue</th>
          <th>Date</th>
        `;
        break;
      case 'marshals':
        headerHTML += `
          <th>Role/Designation</th>
          <th></th>
          <th></th>
        `;
        break;
      case 'officers':
        headerHTML += `
          <th>Position (Scope)</th>
          <th>Org Level</th>
          <th></th>
        `;
        break;
      case 'councils':
        headerHTML += `
          <th>Position</th>
          <th></th>
          <th></th>
        `;
        break;
      case 'athletes':
        headerHTML += `
          <th>Role - Nature</th>
          <th>Venue</th>
          <th>Date</th>
        `;
        break;
      default:
        headerHTML += `
          <th>Activity</th>
          <th>Venue</th>
          <th>Date</th>
        `;
    }

    headerHTML += `
      <th>Evidence</th>
      <th>Actions</th>
    </tr>`;

    thead.innerHTML = headerHTML;
  }


  // Category selection
  document.querySelectorAll('.category').forEach(category => {
    category.addEventListener('click', async function () {
      document.querySelectorAll('.category').forEach(cat => cat.classList.remove('active'));
      this.classList.add('active');

      selectedCategoryKey = this.getAttribute('data-key');
      localStorage.setItem('selectedCategoryKey', selectedCategoryKey);
      currentCategoryKey = selectedCategoryKey;

      if (selectedCategoryKey === 'awards') {
        document.querySelectorAll('.activities-section').forEach(section => section.style.display = 'none');
        document.getElementById('awards').style.display = 'block';
        await loadAwards();
        return;
      }

      document.querySelectorAll('.activities-section').forEach(section => {
        section.style.display = 'none';
      });
      document.getElementById(selectedCategoryKey).style.display = 'block';

      try {
        const res = await fetch(`/api/forms/${selectedCategoryKey}`);
        const contentType = res.headers.get('content-type');

        if (!res.ok) {
          const errorMessage = contentType && contentType.includes('application/json')
            ? (await res.json()).message
            : `Unexpected error: ${await res.text()}`;
          throw new Error(errorMessage);
        }

        const result = await res.json();
        currentFormDefinition = result.form;
        if (res.ok && result.success) {
          currentFormDefinition = result.form;
        } else {
          throw new Error(result.message || 'Form load error');
        }
      } catch (err) {
        alert(`Failed to fetch form definition: ${err.message}`);
        currentFormDefinition = null;
      }

      await loadActivities();
      await loadTotalPoints();
    });
  });

  // Popup form
  const formTemplateContainer = document.getElementById('popupContent');
  const popup = document.getElementById('popupForm');
  const addButton = document.getElementById("add-btn");

  addButton.addEventListener("click", async () => {
    if (!selectedCategoryKey) {
      alert("Please select a category before proceeding.");
      return;
    }

    popup.style.display = "flex";

    try {
      console.log('Fetching form template for categoryKey:', selectedCategoryKey);
      const res = await fetch(`/api/forms/${selectedCategoryKey}`);
      if (!res.ok) {
        const text = await res.text(); // to read HTML error messages
        throw new Error(`Server returned ${res.status}: ${text}`);
      }

      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      // ✅ Use this instead of result.template
      renderFormFromDefinition(result.form);

    } catch (error) {
      alert(`Failed to load form template: ${error.message}`);
      popup.style.display = "none";
    }
  });

  function renderFormFromDefinition(formDef, prefillData = {}) {
    const form = document.createElement('form');

    formDef.fields.forEach(field => {
      const fieldWrapper = document.createElement('div');
      fieldWrapper.style.marginBottom = '15px'; // space between fields
      fieldWrapper.style.display = 'flex';
      fieldWrapper.style.flexDirection = 'column'; // stack label and input vertically

      const label = document.createElement('label');
      label.textContent = field.label;
      label.style.marginBottom = '5px'; // space between label and input

      let input;

      if (field.type === 'select') {
        input = document.createElement('select');
        input.name = field.name;
        if (field.type !== 'file') {
          input.value = prefillData[field.name] || '';
        }
        if (field.required) input.required = true;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an option';
        input.appendChild(defaultOption);

        field.options.forEach(option => {
          const opt = document.createElement('option');
          opt.value = option;
          opt.textContent = option;
          input.appendChild(opt);
        });

      } else {
        input = document.createElement('input');
        input.name = field.name;
        input.type = field.type;
        if (field.type !== 'file') {
          input.value = prefillData[field.name] || '';
        }

        // ✅ Allow multiple file uploads for evidence field
        if (field.name === 'evidence') {
          input.multiple = true;
        }

        if (field.accept) input.accept = field.accept;
        if (field.required) input.required = true;
      }

      fieldWrapper.appendChild(label);
      fieldWrapper.appendChild(input);
      form.appendChild(fieldWrapper);
    });

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'submit-btn';
    submitBtn.textContent = 'Submit';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'close-btn';
    closeBtn.textContent = 'Cancel';

    form.appendChild(submitBtn);
    form.appendChild(closeBtn);

    const container = document.getElementById('popupContent');
    container.innerHTML = `
      <div class="popup-form-content">
        <h2>${formDef.title}</h2>
      </div>
    `;
    container.querySelector('.popup-form-content').appendChild(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitForm();
    });
    closeBtn.addEventListener('click', closePopup);
  }

  function closePopup() {
    popup.style.display = "none";
    formTemplateContainer.innerHTML = '';
  }

  // Submit form to backend
  async function submitForm() {
    console.log('✏️ currentEditingId:', currentEditingId);
    const form = document.querySelector('#popupContent form');
    if (!form) return;
    
    // Get submit button
    const submitBtn = form.querySelector('.submit-btn');
    const originalBtnText = submitBtn.innerHTML;
    
    try {
      // Disable button and show loading state
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      
    // Check if evidence file is provided
    const evidenceInput = form.querySelector('input[name="evidence"]');
    if (!evidenceInput || evidenceInput.files.length === 0) {
      alert('Please upload at least one evidence file.');
      return;
    }

    const formData = new FormData(form);
    formData.append('studentId', currentUser._id);
    formData.append('category', selectedCategoryKey);
    formData.append('points', 0);
    formData.append('status', 'Not Submitted');
    formData.append('raterId', null);
    formData.append('validatorId', null);
    // ✅ Add this here
    const method = currentEditingId ? 'PUT' : 'POST';
    const url = currentEditingId ? `/api/activities/${currentEditingId}` : '/api/activities';

    console.log("FormData being submitted:", [...formData.entries()]);
    console.log("Submit URL:", url);
    console.log("Method:", method);

      const response = await fetch(url, {
        method,
        body: formData
      });
      
      const result = await response.json();

      // 🔍 Add these lines directly below
      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response body:', result);
      
      if (response.ok && result.success) {
        alert('Activity submitted successfully!');
        closePopup();
        currentEditingId = null;
        await loadActivities();
      } else {
        throw new Error(result.message || 'Submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      // Re-enable button if it still exists
      if (submitBtn && document.body.contains(submitBtn)) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  }

  // ====================== PRINT FUNCTIONALITY ======================
  document.querySelector('.btn-white').addEventListener('click', function() {
    const selectedRows = getSelectedRows();
    if (selectedRows.length === 0) {
      alert('Please select at least one row to print');
      return;
    }
    
    printSelectedRows(selectedRows);
  });
  // Edit Activity
  document.getElementById('edit-activity-btn').addEventListener('click', async () => {
    const selectedRows = getSelectedRows();
    if (selectedRows.length !== 1) {
      alert('Please select exactly one activity to edit.');
      return;
    }

    const row = selectedRows[0];
    const activityId = row.dataset.id;

    try {
      console.log("Editing activityId:", activityId);
      const res = await fetch(`/api/activities/byid/${activityId}`);
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch activity data');
      }

      const activityData = result.activity;

      const formRes = await fetch(`/api/forms/${activityData.category}`);
      const formDefResult = await formRes.json();

      if (!formRes.ok || !formDefResult.success) {
        throw new Error('Failed to load form definition');
      }

      currentFormDefinition = formDefResult.form;
      currentEditingId = activityId;

      popup.style.display = "flex";
      renderFormFromDefinition(currentFormDefinition, activityData);

    } catch (err) {
      alert(`Error loading activity for editing: ${err.message}`);
    }
  });

  function printSelectedRows(rows) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Student Activities Report</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
            .footer { margin-top: 30px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Student Activities Report</h2>
            <p>Student: ${currentUser.name}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Activity/Theme</th>
                <th>Venue</th>
                <th>Date</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
    `);

    rows.forEach(row => {
      const cells = row.cells;
      const evidenceCell = cells[5]?.innerText.trim();
      const evidenceText = evidenceCell || 'No evidence';
      
      printWindow.document.write(`
        <tr>
          <td>${cells[1].textContent}</td>
          <td>${cells[2].textContent}</td>
          <td>${cells[3].textContent}</td>
          <td>${cells[4].textContent}</td>
          <td>${evidenceText}</td>
        </tr>
      `);
    });

    printWindow.document.write(`
            </tbody>
          </table>
          <div class="footer">
            <p>Signature: ________________________</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 1000);
            }
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  }

  // Star animation
  const canvas = document.createElement('canvas');
  sidebar.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = sidebar.clientWidth;
    canvas.height = sidebar.clientHeight;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const stars = [];
  const numStars = 60;

  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 0.5
    });
  }

  function animateStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();

      star.x += star.vx;
      star.y += star.vy;

      if (star.x < 0 || star.x > canvas.width) star.vx *= -1;
      if (star.y < 0 || star.y > canvas.height) star.vy *= -1;

      for (let j = i + 1; j < stars.length; j++) {
        const other = stars[j];
        const dx = star.x - other.x;
        const dy = star.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${1 - dist / 100})`;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animateStars);
  }
  
  animateStars();

  // Re-select saved category on load
  const savedCategory = localStorage.getItem('selectedCategoryKey');

  if (savedCategory) {
    const savedElement = document.querySelector(`.category[data-key="${savedCategory}"]`);
    if (savedElement) {
      savedElement.click();
    }
  } else {
    // 👇 Default to loading the Awards tab
    const defaultTab = document.querySelector(`.category[data-key="awards"]`);
    if (defaultTab) {
      defaultTab.classList.add('active');
      defaultTab.click(); // This triggers loadAwards()
    }
  }
  if (savedCategory) {
    const savedElement = document.querySelector(`.category[data-key="${savedCategory}"]`);
    if (savedElement) savedElement.click();
  }


  // Icon button functionality in the top bar
  const topIcons = document.querySelectorAll('.top-bar .icon');

  if (topIcons.length >= 2) {
    const [notificationIcon, robotIcon] = topIcons;

    // Set cursor and title
    notificationIcon.style.cursor = 'pointer';
    notificationIcon.title = 'Notifications';
    robotIcon.style.cursor = 'pointer';
    robotIcon.title = 'Open Chatbot';

    // Add click actions
    notificationIcon.addEventListener('click', () => {
      console.log('🔔 Notification button clicked. Panel logic can go here.');
      // Optionally show a toast, dropdown, or highlight the panel
    });

    robotIcon.addEventListener('click', () => {
      window.open('http://localhost/chatbot/', '_blank');
    });
  }



  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("view-activity-btn")) {
      const activityId = e.target.dataset.activityId;

      try {
        const res = await fetch(`/api/activities/byid/${activityId}`);
        const result = await res.json();

        if (result.success) {
          showActivityDetails(result.activity); // Your modal/table display
        } else {
          alert("Activity not found.");
        }
      } catch (err) {
        console.error("Fetch error:", err);
        alert("Failed to fetch activity.");
      }
    }
  });
    
  // Fetch current user
  currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const currentUserId = currentUser?._id;

  if (!currentUserId || !/^[a-f\d]{24}$/i.test(currentUserId)) {
    console.error("❌ Invalid or missing currentUserId:", currentUserId);
    return;
  }

  // Fetch and render notifications
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

        // Main notification table
        const notifContent = document.createElement('div');
        notifContent.className = 'notif-content';
        notifContent.innerHTML = `
          <div class="notif-type">${n.type}</div>
          <div class="notif-message">${n.message}</div>
          <div class="notif-date">${new Date(n.createdAt).toLocaleString()}</div>
          ${n.activityId ? `
            <div class="notif-action">
              <button class="inline-activity-btn" data-activity-id="${n.activityId}">
                📄 View Activity
              </button>
              <button class="inline-delete-btn" data-id="${n._id}">🗑 Delete</button>
            </div>` : ''}
        `;

        // Container for inline activity details
        const activityContainer = document.createElement('div');
        activityContainer.className = 'inline-activity-container';
        activityContainer.style.display = 'none';

          div.appendChild(notifContent);
          div.appendChild(activityContainer);
          container.appendChild(div);

          // grab the delete button we just injected
          const deleteBtn = div.querySelector('.inline-delete-btn');
          if (deleteBtn) {
            deleteBtn.addEventListener('click', async e => {
              const notifId = e.currentTarget.getAttribute('data-id');
              if (!confirm('Are you sure you want to delete this notification?')) return;

              try {
                const res = await fetch(`/api/notifications/${notifId}`, { method: 'DELETE' });
                const result = await res.json();
                if (result.success) {
                  div.remove();  // remove the whole notification card
                } else {
                  alert('Failed to delete: ' + result.message);
                }
              } catch (err) {
                console.error('Error deleting notification:', err);
                alert('Error deleting notification. Please try again.');
              }
            });
          }          
      });
    })
    .catch(err => console.error('❌ Failed to load notifications:', err));

  // Toggle notification box visibility
  const notifBtn = document.getElementById('notif-btn');
  const notifBox = document.getElementById('notification-list');

  if (notifBtn && notifBox) {
    notifBtn.addEventListener('click', () => {
      notifBox.style.display = notifBox.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Handle "View Activity" button clicks
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.inline-activity-btn');
    if (!btn) return;

    const activityId = btn.dataset.activityId;
    const container = btn.closest('.notification')?.querySelector('.inline-activity-container');
    if (!activityId || !container) return;

    // Toggle visibility if already loaded
    if (container.innerHTML && container.style.display === 'block') {
      container.style.display = 'none';
      return;
    }

    // Fetch activity data
    try {
      const res = await fetch(`/api/activities/byid/${activityId}`);
      const result = await res.json();

      if (result.success) {
        const activity = result.activity;
        const excluded = ['_id', 'studentId', 'recipientId', 'validatorId', '__v', 'updatedAt'];
        let rows = '';

        for (const key in activity) {
          if (excluded.includes(key)) continue;

          let value = activity[key];

          if (key === 'createdAt' || key === 'date') {
            value = new Date(value).toLocaleString();
          } else if (Array.isArray(value)) {
            value = value.map(file => `<a href="/uploads/${file}" target="_blank">${file}</a>`).join('<br>');
          } else if (typeof value === 'object' && value !== null) {
            continue;
          }

          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          rows += `<tr><th>${label}</th><td>${value || '—'}</td></tr>`;
        }

        container.innerHTML = `
          <div class="activity-inline-wrapper">
            <table class="styled-table">${rows}</table>
          </div>
        `;
        container.style.display = 'block';
      } else {
        container.innerHTML = `<p>⚠️ Activity not found.</p>`;
        container.style.display = 'block';
      }
    } catch (err) {
      console.error("❌ Error loading activity:", err);
      container.innerHTML = `<p>❌ Failed to load activity.</p>`;
      container.style.display = 'block';
    }
  });


  function getStoredUserId() {
    try {
      const keys = ['user', 'currentUser', 'loggedInUser'];
      for (const k of keys) {
        const val = localStorage.getItem(k);
        if (!val) continue;
        try {
          const obj = JSON.parse(val);
          if (obj && obj._id) return obj._id;
        } catch (e) {
          if (val && val.length >= 12) return val;
        }
      }
      return localStorage.getItem('userId') || localStorage.getItem('currentUserId') || null;
    } catch (err) {
      return null;
    }
  }

  const editBtn = document.getElementById('edit-account-btn');
  const modal = document.getElementById('editAccountModal');
  const form = document.getElementById('editAccountForm');
  const usernameInput = document.getElementById('edit-username');
  const passwordInput = document.getElementById('edit-password');
  const passwordConfirmInput = document.getElementById('edit-password-confirm');
  const cancelBtn = document.getElementById('edit-cancel');

  function openModal() {
    const id = getStoredUserId();
    if (!id) {
      alert('Cannot determine current user. Re-login or provide user id in localStorage.');
      return;
    }

    fetch('/api/current-user', {
      headers: { 'x-user-id': id }
    })
      .then(r => r.json())
      .then(user => {
        if (user && user.username) usernameInput.value = user.username;
        // use flex so CSS centering applies
        modal.style.display = 'flex';
        // small entrance animation
        const card = modal.querySelector('.modal-content');
        if (card) {
          card.style.transform = 'translateY(6px)';
          card.style.opacity = '0';
          requestAnimationFrame(() => {
            card.style.transform = 'translateY(0)';
            card.style.opacity = '1';
          });
        }
      })
      .catch(err => {
        console.error('Failed to get current user', err);
        alert('Failed to load user data');
      });
  }

  function closeModal() {
    // animate out then hide
    const card = modal.querySelector('.modal-content');
    if (card) {
      card.style.transform = 'translateY(8px)';
      card.style.opacity = '0';
      setTimeout(() => { modal.style.display = 'none'; }, 140);
    } else {
      modal.style.display = 'none';
    }
    passwordInput.value = '';
    passwordConfirmInput.value = '';
  }

  editBtn && editBtn.addEventListener('click', openModal);
  cancelBtn && cancelBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = getStoredUserId();
    if (!id) return alert('User id not found');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const confirm = passwordConfirmInput.value;

    if (password && password !== confirm) return alert('Passwords do not match');

    const body = { username };
    if (password) body.password = password;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': id },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      alert('Account updated');
      // update localStorage copies if present
      try {
        const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
        if (raw) {
          const p = JSON.parse(raw);
          p.username = data.user.username;
          localStorage.setItem('user', JSON.stringify(p));
          localStorage.setItem('currentUser', JSON.stringify(p));
        }
      } catch (e) {}
      closeModal();
    } catch (err) {
      alert('Failed to update account: ' + (err.message || err));
    }
  });

});
