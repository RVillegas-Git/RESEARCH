document.addEventListener('DOMContentLoaded', function () {
  // DOM Elements
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.section');
  const logoutBtn = document.querySelector('.logout-btn');
  const chatbotMenuItem = document.querySelector('.menu-item[data-section="chatbot"]');

  let allUsers = [];

  // Initialize the page
  initPage();

  // Event Listeners
  menuItems.forEach(item => {
    item.addEventListener('click', handleMenuItemClick);
  });

  logoutBtn.addEventListener('click', logout);
  chatbotMenuItem.addEventListener('click', redirectToChatbotAdmin);

  // Functions
  function initPage() {
    loadUsers();
    loadPrograms();
    setupProgramForm();
    setupProgramFilter();
    loadAwards();

    // Add this line if you have a refresh button:
    document.getElementById('refresh-awards')?.addEventListener('click', loadAwards);
    initFormManagement();
  }
  // Form Management System
  function initFormManagement() {
    const formCategorySelect = document.getElementById('form-category');
    const loadFormBtn = document.getElementById('load-form-btn');
    const addFieldBtn = document.getElementById('add-field-btn');
    const saveFormBtn = document.getElementById('save-form-btn');
    const formPreview = document.getElementById('form-preview');
    const formBuilder = document.getElementById('form-builder');
    const formTitle = document.getElementById('current-form-title');
    
    let currentForm = null;
    let allForms = [];
    
    // Load all form templates
    async function loadFormTemplates() {
      try {
        const response = await fetch('/api/forms');
        allForms = await response.json();
        
        // Populate category dropdown
        formCategorySelect.innerHTML = '<option value="">-- Select a Category --</option>';
        allForms.forEach(form => {
          const option = document.createElement('option');
          option.value = form.categoryKey;
          option.textContent = form.title;
          formCategorySelect.appendChild(option);
        });
      } catch (error) {
        console.error('Error loading forms:', error);
        alert('Failed to load form templates', 'error');
      }
    }
    
    // Load selected form
    loadFormBtn.addEventListener('click', () => {
      const categoryKey = formCategorySelect.value;
      if (!categoryKey) return;
      
      currentForm = allForms.find(f => f.categoryKey === categoryKey);
      if (!currentForm) return;
      
      formTitle.textContent = currentForm.title;
      renderFormPreview();
      renderFormBuilder();
    });
    
    // Render form preview
    function renderFormPreview() {
      formPreview.innerHTML = '';
      
      if (!currentForm?.fields?.length) {
        formPreview.innerHTML = '<p>No fields in this form</p>';
        return;
      }
      
      const form = document.createElement('form');
      currentForm.fields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'form-field-preview';
        
        const label = document.createElement('label');
        label.textContent = field.label;
        label.htmlFor = `preview-${field.name}`;
        
        let input;
        if (field.type === 'select' && field.options) {
          input = document.createElement('select');
          field.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            input.appendChild(option);
          });
        } else if (field.type === 'file') {
          input = document.createElement('input');
          input.type = 'file';
          if (field.accept) input.accept = field.accept;
        } else {
          input = document.createElement('input');
          input.type = field.type || 'text';
        }
        
        input.id = `preview-${field.name}`;
        input.name = field.name;
        input.required = field.required || false;
        
        div.appendChild(label);
        div.appendChild(input);
        form.appendChild(div);
      });
      
      formPreview.appendChild(form);
    }
    
    // Render form builder
    function renderFormBuilder() {
      formBuilder.innerHTML = '';
      
      if (!currentForm?.fields?.length) {
        formBuilder.innerHTML = '<p>No fields in this form</p>';
        return;
      }
      
      currentForm.fields.forEach((field, index) => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'form-field';
        fieldDiv.dataset.index = index;
        
        // Field controls
        const controls = document.createElement('div');
        controls.className = 'field-controls';
        
        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.onclick = () => moveField(index, 'up');
        
        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.onclick = () => moveField(index, 'down');
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteField(index);
        
        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        controls.appendChild(deleteBtn);
        
        // Field editor
        const editor = document.createElement('div');
        editor.className = 'field-editor';
        
        const labelInput = createFieldInput('Label', 'text', field.label, 'label');
        const nameInput = createFieldInput('Name', 'text', field.name, 'name');
        const typeInput = createFieldInput('Type', 'text', field.type, 'type');
        const requiredInput = createFieldInput('Required', 'checkbox', field.required, 'required');
        
        editor.appendChild(labelInput);
        editor.appendChild(nameInput);
        editor.appendChild(typeInput);
        editor.appendChild(requiredInput);
        
        // Options for select fields
        if (field.type === 'select' && field.options) {
          const optionsDiv = document.createElement('div');
          optionsDiv.className = 'field-options';
          optionsDiv.innerHTML = '<strong>Options:</strong>';
          
          const optionsList = document.createElement('div');
          field.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.textContent = option;
            optionsList.appendChild(optionDiv);
          });
          
          const addOptionInput = document.createElement('input');
          addOptionInput.type = 'text';
          addOptionInput.placeholder = 'Add new option';
          
          const addOptionBtn = document.createElement('button');
          addOptionBtn.textContent = 'Add Option';
          addOptionBtn.onclick = () => {
            if (addOptionInput.value) {
              if (!field.options) field.options = [];
              field.options.push(addOptionInput.value);
              addOptionInput.value = '';
              renderFormBuilder();
            }
          };
          
          optionsDiv.appendChild(optionsList);
          optionsDiv.appendChild(addOptionInput);
          optionsDiv.appendChild(addOptionBtn);
          editor.appendChild(optionsDiv);
        }
        
        fieldDiv.appendChild(controls);
        fieldDiv.appendChild(editor);
        formBuilder.appendChild(fieldDiv);
      });
    }
    
    // Helper to create field inputs
    function createFieldInput(label, type, value, property) {
      const div = document.createElement('div');
      const labelEl = document.createElement('label');
      labelEl.textContent = label;
      div.appendChild(labelEl);

      let input;
      if (property === 'type') {
        // a real <select> for type choices
        input = document.createElement('select');
        ['text','date','file','select'].forEach(optType => {
          const opt = document.createElement('option');
          opt.value = optType;
          opt.textContent = optType;
          if (optType === value) opt.selected = true;
          input.appendChild(opt);
        });
      } else {
        // your existing logic
        input = document.createElement('input');
        input.type = type;
        if (type === 'checkbox') {
          input.checked = value;
        } else {
          input.value = value;
        }
      }

      input.addEventListener('change', (e) => {
        const idx = +e.target.closest('.form-field').dataset.index;
        const newType = e.target.value;
        currentForm.fields[idx][property] = newType;

        // **If you just turned this into a select, ensure there's an array to hold options**
        if (property === 'type' && newType === 'select' && !Array.isArray(currentForm.fields[idx].options)) {
          currentForm.fields[idx].options = [];
        }

        // Re‑render builder & preview so the options UI appears/disappears
        renderFormBuilder();
        renderFormPreview();
      });

      div.appendChild(input);
      return div;
    }
    
    // Field manipulation functions
    function moveField(index, direction) {
      if (direction === 'up' && index > 0) {
        [currentForm.fields[index], currentForm.fields[index-1]] = 
          [currentForm.fields[index-1], currentForm.fields[index]];
      } else if (direction === 'down' && index < currentForm.fields.length - 1) {
        [currentForm.fields[index], currentForm.fields[index+1]] = 
          [currentForm.fields[index+1], currentForm.fields[index]];
      }
      renderFormBuilder();
      renderFormPreview();
    }
    
    function deleteField(index) {
      if (confirm('Are you sure you want to delete this field?')) {
        currentForm.fields.splice(index, 1);
        renderFormBuilder();
        renderFormPreview();
      }
    }
    
    // Add new field
    addFieldBtn.addEventListener('click', () => {
      if (!currentForm) return;
      
      currentForm.fields.push({
        label: 'New Field',
        name: 'field_' + Date.now(),
        type: 'text',
        required: false
      });
      
      renderFormBuilder();
      renderFormPreview();
    });
    
    // Save form changes
    saveFormBtn.addEventListener('click', async () => {
      if (!currentForm) return;

      try {
        // only send the fields array
        const payload = { fields: currentForm.fields };

        const response = await fetch(`/api/forms/${currentForm._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Server responded ${response.status}`);
        }

        alert('Form fields updated successfully', 'success');
        // reload templates so your dropdown stays in sync
        loadFormTemplates();
      } catch (error) {
        console.error('Error saving form fields:', error);
        alert('Failed to save form fields', 'error');
      }
    });
    
    // Initialize
    loadFormTemplates();
  }

  function handleMenuItemClick() {
    const target = this.getAttribute('data-section');

    // Update active menu item
    menuItems.forEach(i => i.classList.remove('active'));
    this.classList.add('active');

    // Show corresponding section
    sections.forEach(section => {
      section.classList.remove('active');
      if (section.id === target) section.classList.add('active');
    });
  }

  function loadUsers() {
    fetch('/api/users')
      .then(res => res.json())
      .then(users => {
        allUsers = users;
        renderUserTable(users);
        setupUserSearch();
      })
      .catch(err => {
        console.error(err);
        alert('Failed to load users', 'error');
      });
  }

  function renderUserTable(users) {
    const userTable = document.getElementById('user-table').querySelector('tbody');
    userTable.innerHTML = '';

    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.name || ''}</td>
        <td>${user.school || ''}</td>
        <td>${user.course || ''}</td>
        <td>${user.schoolYear || ''}</td>
        <td>${user.username || ''}</td>
        <td>${new Date(user.createdAt).toLocaleString() || ''}</td>
        <td class="status-cell" data-id="${user._id}">
          ${user.active ? 'Active' : 'Inactive'}
        </td>
        <td>
          <button class="action-btn" data-id="${user._id}" data-active="${user.active}">
            ${user.active ? 'Deactivate' : 'Activate'}
          </button>
          <button class="edit-btn" data-id="${user._id}">Edit</button>
        </td>
      `;
      userTable.appendChild(row);
    });

    setupActionButtons(); // Wire up click handlers on the buttons
    setupEditButtons();
  }
  function setupEditButtons() {
    document.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', handleEditUser)
    );
  }

  function setupActionButtons() {
    document.querySelectorAll('.action-btn').forEach(btn =>
      btn.addEventListener('click', handleActiveAction)
    );
  }
  function handleEditUser(e) {
    const userId = e.currentTarget.dataset.id;
    const user = allUsers.find(u => u._id === userId);
    if (!user) {
      alert('User not found', 'error');
      return;
    }

    // Create or show the edit modal
    let modal = document.getElementById('editUserModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'editUserModal';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100vw';
      modal.style.height = '100vh';
      modal.style.background = 'rgba(0,0,0,0.4)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.innerHTML = `
        <div style="background:#fff;padding:24px;border-radius:8px;min-width:320px;max-width:90vw;">
          <h2>Edit User</h2>
          <form id="editUserForm">
            <label>Name:<br><input type="text" id="editName" required></label><br>
            <label>School:<br><input type="text" id="editSchool" required></label><br>
            <label>Course:<br><input type="text" id="editCourse" required></label><br>
            <label>School Year:<br><input type="text" id="editSchoolYear" required></label><br>
            <div style="margin-top:12px;display:flex;gap:8px;">
              <button type="submit">Save</button>
              <button type="button" id="cancelEditUser">Cancel</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.style.display = 'flex';
    }

    // Fill form fields
    document.getElementById('editName').value = user.name || '';
    document.getElementById('editSchool').value = user.school || '';
    document.getElementById('editCourse').value = user.course || '';
    document.getElementById('editSchoolYear').value = user.schoolYear || '';

    // Cancel button
    document.getElementById('cancelEditUser').onclick = function() {
      modal.style.display = 'none';
    };

    // Submit handler
    document.getElementById('editUserForm').onsubmit = async function(ev) {
      ev.preventDefault();
      const name = document.getElementById('editName').value.trim();
      const school = document.getElementById('editSchool').value.trim();
      const course = document.getElementById('editCourse').value.trim();
      const schoolYear = document.getElementById('editSchoolYear').value.trim();
      if (!name || !school || !course || !schoolYear) {
        alert('All fields are required', 'error');
        return;
      }
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, school, course, schoolYear })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update user');
        alert('User updated successfully', 'success');
        modal.style.display = 'none';
        loadUsers();
      } catch (err) {
        alert('Error updating user: ' + err.message, 'error');
      }
    };
  }

  async function handleActiveAction(e) {
    const btn = e.currentTarget;
    const userId = btn.dataset.id;
    const currentActive = btn.dataset.active === 'true';
    const newActive = !currentActive;

    try {
      const res = await fetch(`/api/users/${userId}/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || res.statusText);

      // Update UI
      btn.dataset.active = newActive;
      btn.textContent = newActive ? 'Deactivate' : 'Activate';
      const statusCell = btn.closest('tr').querySelector('.status-cell');
      statusCell.textContent = newActive ? 'Active' : 'Inactive';

      // Update your local array
      const user = allUsers.find(u => u._id === userId);
      if (user) user.active = newActive;

      alert(`User ${newActive ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (err) {
      console.error(err);
      alert(`Failed to update user: ${err.message}`, 'error');
    }
  }



  function setupUserSearch() {
    document.getElementById('user-search').addEventListener('input', function () {
      const keyword = this.value.toLowerCase();
      const filtered = allUsers.filter(user =>
        (user.name && user.name.toLowerCase().includes(keyword)) ||
        (user.username && user.username.toLowerCase().includes(keyword)) ||
        (user.school && user.school.toLowerCase().includes(keyword)) ||
        (user.course && user.course.toLowerCase().includes(keyword)) ||
        (user.schoolYear && user.schoolYear.toLowerCase().includes(keyword))
      );
      renderUserTable(filtered);
    });
  }

function renderAwardsTable(data) {
  const tbody = document.querySelector("#awards-table tbody");
  tbody.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="no-data">No award data available</td>
      </tr>`;
    return;
  }

  data.forEach(item => {
    // ─── Summary row ───────────────────────────────────────
    const summaryRow = document.createElement("tr");
    summaryRow.innerHTML = `
      <td>${item.rank}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.program)}</td>
      <td>${escapeHtml(item.school)}</td>
      <td>${escapeHtml(item.schoolYear)}</td>
      <td>${item.approvedDate ? new Date(item.approvedDate).toLocaleDateString() : "N/A"}</td>
      <td>${item.points.toLocaleString()}</td>
      <td class="medal-${item.medal.toLowerCase()}">${item.medal}</td>
      <td><button class="toggle-activities-btn">Show Activities</button></td>
    `;
    tbody.appendChild(summaryRow);

    // ─── Details row ────────────────────────────────────────
    const detailsRow = document.createElement("tr");
    detailsRow.classList.add("activities-row");
    detailsRow.style.display = "none";

    const cell = document.createElement("td");
    cell.colSpan = 9;

    const activities = Array.isArray(item.activities) ? item.activities : [];
    if (activities.length === 0) {
      cell.textContent = "No activities found";
    } else {
      // 1) Group by activity.category
      const grouped = activities.reduce((acc, act) => {
        const cat = act.category || "Uncategorized";
        (acc[cat] = acc[cat] || []).push(act);
        return acc;
      }, {});

      // 2) For each category, render a mini‑table
      Object.entries(grouped).forEach(([cat, acts]) => {
        // Heading
        const h4 = document.createElement("h4");
        h4.textContent = capitalizeFirstLetter(cat);
        h4.style.margin = "10px 0 4px";
        cell.appendChild(h4);

        // Determine all keys for this category
        const excluded = ["_id", "__v", "studentId", "studentName", "approvedAt", "approvedBy", "recipientId", "updatedAt", "status", "createdAt"];
        const keys = Array.from(
          new Set(
            acts.flatMap(act =>
              Object.keys(act).filter(
                k => !excluded.includes(k) && typeof act[k] !== "object"
              )
            )
          )
        );

        // Build table
        const tbl = document.createElement("table");
        tbl.classList.add("activities-table");

        // Header
        const thead = document.createElement("thead");
        const headerCols = ["#", ...keys.map(formatHeader)];
        thead.innerHTML = `<tr>${headerCols
          .map(c => `<th>${c}</th>`)
          .join("")}</tr>`;
        tbl.appendChild(thead);

        // Body
        const tb = document.createElement("tbody");
        acts.forEach((act, idx) => {
          const tr = document.createElement("tr");
          const cells = [`<td>${idx + 1}</td>`].concat(
            keys.map(k => {
              let v = act[k];
              if (k === "date" && v) v = new Date(v).toLocaleDateString();
              return `<td>${escapeHtml(v ?? "")}</td>`;
            })
          );
          tr.innerHTML = cells.join("");
          tb.appendChild(tr);
        });
        tbl.appendChild(tb);

        cell.appendChild(tbl);
      });
    }

    detailsRow.appendChild(cell);
    tbody.appendChild(detailsRow);
  });

  // ─── Toggle logic ────────────────────────────────────────
  tbody.querySelectorAll(".toggle-activities-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      const details = row.nextElementSibling;
      const show = details.style.display === "none";
      details.style.display = show ? "table-row" : "none";
      btn.textContent = show ? "Hide Activities" : "Show Activities";
    });
  });
}
function formatHeader(str) {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')    // camelCase to spaced
    .replace(/_/g, ' ')                     // snake_case to spaced
    .replace(/\b\w/g, c => c.toUpperCase()); // capitalize first letters
}




  async function loadAwards() {
    try {
      const response = await fetch('/api/approved-submissions');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Raw API response:', data); // Debug log
      
      if (!data || data.length === 0) {
        renderAwardsTable([]);
        // showMessage('No awards data available', 'info');
        return;
      }
      
      const processedData = processApprovedSubmissions(data);
      renderAwardsTable(processedData);
      
    } catch (error) {
      console.error('Error loading awards:', error);
      showMessage('Failed to load awards. Please check console for details.', 'error');
    }
  }

  function loadPrograms() {
    fetch("/api/programs")
      .then(res => res.json())
      .then(programs => {
        populateSchoolFilters(programs);
        renderProgramTable(programs);
      });
  }

  function populateSchoolFilters(programs) {
    const schools = [...new Set(programs.map(p => p.school))];

    const schoolFilter = document.getElementById("school-filter");
    schoolFilter.innerHTML = `<option value="">All</option>`;
    schools.forEach(school => {
      const opt = document.createElement("option");
      opt.value = school;
      opt.textContent = school;
      schoolFilter.appendChild(opt);
    });

    const filterSchool = document.getElementById("filter-school");
    filterSchool.innerHTML = `<option value="">-- Select School --</option>`;
    schools.forEach(school => {
      const opt = document.createElement("option");
      opt.value = school;
      opt.textContent = school;
      filterSchool.appendChild(opt);
    });
  }

  function renderProgramTable(programs) {
    const programTableBody = document.querySelector("#program-table tbody");
    programTableBody.innerHTML = "";

    programs.forEach(({ _id, school, program, years }) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${school}</td>
        <td>${program}</td>
        <td>${years || "N/A"}</td>
        <td><button class="delete-program" data-id="${_id}">Delete</button></td>
      `;
      programTableBody.appendChild(row);
    });
  }

  function setupProgramForm() {
    const programForm = document.getElementById("program-form");
    const schoolInput = document.getElementById("school-name");
    const programInput = document.getElementById("program-name");
    const yearsInput = document.getElementById("program-years");

    programForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const school = schoolInput.value.trim();
      const program = programInput.value.trim();
      // inside the submit handler
      const years = parseInt(yearsInput.value.trim(), 10);

      if (!school || !program || !years) {
        return alert("All fields are required.");
      }

      await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, program, years }),
      });


      schoolInput.value = "";
      programInput.value = "";
      yearsInput.value = "";
      loadPrograms();
    });
  }

  function setupProgramFilter() {
    const filterSchool = document.getElementById("filter-school");
    const filterProgram = document.getElementById("filter-program");
    const filterButton = document.getElementById("filter-button");
    const clearFilter = document.getElementById("clear-filter");
    const filterResults = document.getElementById("filter-results");

    filterSchool.addEventListener("change", async () => {
      const school = filterSchool.value;
      filterProgram.disabled = !school;
      filterButton.disabled = !school;

      if (!school) {
        filterProgram.innerHTML = '<option value="">-- Select Program --</option>';
        return;
      }

      const res = await fetch("/api/programs");
      const progs = await res.json();
      const schoolPrograms = progs.filter(p => p.school === school).map(p => p.program);

      filterProgram.innerHTML = '<option value="">-- Select Program --</option>';
      schoolPrograms.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        filterProgram.appendChild(opt);
      });
    });

    filterButton.addEventListener("click", () => {
      const selectedProgram = filterProgram.value.trim().toLowerCase();
      if (!selectedProgram) return;

      document.getElementById("selected-program-name").textContent = selectedProgram;

      const filteredUsers = allUsers.filter(user =>
        user.course && user.course.toLowerCase().startsWith(selectedProgram)
      );

      renderFilteredUsers(filteredUsers);
      filterResults.style.display = 'block';
    });

    clearFilter.addEventListener('click', () => {
      filterSchool.value = '';
      filterProgram.innerHTML = '<option value="">-- Select Program --</option>';
      filterProgram.disabled = true;
      filterButton.disabled = true;
      filterResults.style.display = 'none';
    });

    document.getElementById("school-filter").addEventListener("change", async () => {
      const selected = document.getElementById("school-filter").value;
      const res = await fetch("/api/programs");
      const data = await res.json();
      const filtered = selected ? data.filter(p => p.school === selected) : data;
      renderProgramTable(filtered);
    });

    document.querySelector("#program-table tbody").addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-program")) {
        const id = e.target.dataset.id;
        if (confirm("Are you sure you want to delete this program?")) {
          await fetch(`/api/programs/${id}`, { method: "DELETE" });
          loadPrograms();
        }
      }
    });
  }

  function renderFilteredUsers(users) {
    const filteredUsersTable = document.querySelector("#filtered-users-table tbody");
    filteredUsersTable.innerHTML = '';

    if (users.length === 0) {
      filteredUsersTable.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center;">No users found in this program</td>
        </tr>`;
      return;
    }

    users.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.name || ''}</td>
        <td>${user.username || ''}</td>
        <td>${user.school || ''}</td>
        <td>${user.course || ''}</td>
        <td>${user.schoolYear || ''}</td>
        <td>${new Date(user.createdAt).toLocaleDateString() || ''}</td>
      `;
      filteredUsersTable.appendChild(tr);
    });
  }

  function logout() {
    if (confirm('Are you sure you want to log out?')) {
      window.location.href = '../login.html';
    }
  }

  function redirectToChatbotAdmin() {
    window.location.href = 'http://localhost/chatbot/admin/';
  }

  function processApprovedSubmissions(submissions) {
    if (!Array.isArray(submissions)) {
      console.error('Invalid submissions data:', submissions);
      return [];
    }

    return submissions.map((sub, index) => {
      const activities = sub.activities || [];

      const totalPoints = sub.points || activities.reduce((sum, act) => sum + (act.points || 0), 0);

      return {
        id: sub._id,
        studentId: sub.studentId,
        name: sub.studentName || 'Unknown Student',
        school: sub.school || 'Unknown School',
        program: sub.course || 'Unknown Program',
        schoolYear: sub.schoolYear || 'Unknown Year',
        points: totalPoints,
        category: sub.category || 'general',
        medal: sub.medal || 'No Medal',
        approvedDate: sub.approvedAt ? new Date(sub.approvedAt) : null,
        approvedBy: sub.approvedBy || 'System',
        activities: activities, // ✅ this is the fix
      };
    }).sort((a, b) => b.points - a.points)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }
  function setupAwardFilters(data) {
    const awardFilter = document.getElementById("award-filter");
    const categoryFilter = document.getElementById("category-filter");
    
    // Get unique categories
    const categories = [...new Set(data.map(item => item.category))].filter(Boolean);
    
    // Populate category dropdown
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categoryFilter.appendChild(option);
    });
    
    // Setup filter handlers
    awardFilter.addEventListener('change', () => applyAwardFilters(data));
    categoryFilter.addEventListener('change', () => applyAwardFilters(data));
  }

  function applyAwardFilters(fullData) {
    const awardValue = document.getElementById("award-filter").value.toLowerCase();
    const categoryValue = document.getElementById("category-filter").value.toLowerCase();
    
    const filteredData = fullData.filter(student => {
      const matchesAward = !awardValue || student.award.toLowerCase().includes(awardValue);
      const matchesCategory = !categoryValue || student.category.toLowerCase().includes(categoryValue);
      return matchesAward && matchesCategory;
    });
    
    // Recalculate ranks for filtered results
    const rankedData = filteredData.map((student, index) => ({
      ...student,
      rank: index + 1
    }));
    
    renderAwardsTable(rankedData);
  }
  // Utility functions
  function escapeHtml(str) {
    return str ? str.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;") : '';
  }

  function capitalizeFirstLetter(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  function showMessage(message, type = 'error') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    const content = document.querySelector('.content');
    content.prepend(messageDiv);
    
    setTimeout(() => messageDiv.remove(), 5000);
  }

  // inside initFormManagement(), after renderFormBuilder()
  saveFormBtn.addEventListener('click', async () => {
    if (!currentForm) return;

    try {
      const response = await fetch(`/api/forms/${currentForm._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentForm)
      });

      if (response.ok) {
        alert('Form updated successfully', 'success');
        // reload templates so the dropdown titles/options stay in sync
        loadFormTemplates();
      } else {
        throw new Error(`Server responded ${response.status}`);
      }
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Failed to save form changes', 'error');
    }
  });


});
