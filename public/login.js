$(document).ready(function () {
  // Tab switching logic
  $('#tab-login').click(function () {
    $(this).addClass('active');
    $('#tab-signup').removeClass('active');
    $('#login-form').show();
    $('#signup-form').hide();
  });

  $('#tab-signup').click(function () {
    $(this).addClass('active');
    $('#tab-login').removeClass('active');
    $('#signup-form').show();
    $('#login-form').hide();
  }); 

  // Automatically trigger login tab on page load
  $('#tab-login').trigger('click');

  // Debug log
  console.log('Login script loaded and login tab activated on load');

  // Helper: Sanitize input (basic HTML entity escaping)
  function sanitizeInput(str) {
    return $('<div>').text(str).html();
  }

  // Helper: Validate password strength
  function isStrongPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  }

  // Login form submission
  $('#login-form').submit(function (event) {
    event.preventDefault();
    console.log('Login form submitted');

    let username = $('#login-username').val().trim();
    let password = $('#password').val();

    // Sanitize
    username = sanitizeInput(username);

    // Basic security validation
    if (!username || !password) {
      alert('Please enter both username and password');
      return;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    console.log('Sending login request');

    $.ajax({
      url: '/api/login',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ username, password }),
      success: function (response) {
        console.log('Login success:', response);
        if (response.success) {
          localStorage.setItem('currentUser', JSON.stringify(response.user));
          localStorage.setItem("studentName", response.user.name);
          localStorage.setItem("studentSchool", response.user.school);
          localStorage.setItem("studentCourse", response.user.course);
          localStorage.setItem("studentYear", response.user.schoolYear);

          // Redirect based on username (rater goes to rater page)
          if (
            response.user.username === 'rater' ||
            response.user.username === 'rater1' ||
            response.user.username === 'rater2' ||
            response.user.username === 'rater3' ||
            response.user.username === 'rater4' ||
            response.user.username === 'rater5'
          ) {
            window.location.href = 'rater/rater.html';
          } else if (
            response.user.username === 'validator' ||
            response.user.username === 'validator1' ||
            response.user.username === 'validator2' ||
            response.user.username === 'validator3' ||
            response.user.username === 'validator4' ||
            response.user.username === 'validator5'
          ) {
            window.location.href = 'validator/validator.html';
          } else if (
            response.user.username === 'admin' ||
            response.user.username === 'admin1' ||
            response.user.username === 'admin2' ||
            response.user.username === 'admin3' ||
            response.user.username === 'admin4' ||
            response.user.username === 'admin5'
          ) {
            window.location.href = 'admin/admin.html';
          } else {
            window.location.href = 'dashboard/STUDASHBOARD.html';
          }
        }
      },
      error: function (xhr, status, error) {
        console.error('Login error:', error);
        const errorMessage = xhr.responseJSON ? xhr.responseJSON.message : 'Login failed. Please try again.';
        alert(errorMessage);
      }
    });
  });

  // Signup form submission
  $('#signup-form').submit(function (event) {
    event.preventDefault();
    console.log('Signup form submitted');

    let name = $('#name').val().trim();
    let school = $('#school').find(":selected").text();
    let course = $('#course').find(":selected").text();
    let schoolYear = $('#school-year').val();
    let username = $('#signup-username').val().trim();
    let password = $('#signup-password').val();

    // Sanitize
    name = sanitizeInput(name);
    username = sanitizeInput(username);

    if (!name || !school || !course || !schoolYear || !username || !password) {
      alert('Please fill out all required fields');
      return;
    }

    // NEW: Check for restricted usernames
    const restrictedUsernames = [
      'rater', 'rater1', 'rater2', 'rater3', 'rater4', 'rater5',
      'validator', 'validator1', 'validator2', 'validator3', 'validator4', 'validator5',
      'admin', 'admin1', 'admin2', 'admin3', 'admin4', 'admin5'
    ];

    if (restrictedUsernames.includes(username.toLowerCase())) {
      alert('This username is reserved for system accounts. Please choose a different username.');
      return;
    }

    if (!isStrongPassword(password)) {
      alert('Password must be at least 8 characters long, with uppercase, lowercase, and a number.');
      return;
    }

    const userData = {
      name,
      school,
      course,
      schoolYear,
      username,
      password,
      active: true    // ← new flag
    };

    console.log('Sending signup request');

    $.ajax({
      url: '/api/signup',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(userData),
      success: function (response) {
        console.log('Signup success:', response);
        if (response.success) {
          // FIX 1: Store in localStorage instead of sessionStorage
          // FIX 2: Use 'currentUser' key instead of 'studentData'
          // FIX 3: Store the full user object from response
          localStorage.setItem('currentUser', JSON.stringify(response.user));

          // FIX 4: Also store student info separately if needed
          localStorage.setItem("studentName", name);
          localStorage.setItem("studentSchool", school);
          localStorage.setItem("studentCourse", course);
          localStorage.setItem("studentYear", schoolYear);

          alert('Registration successful! Redirecting to dashboard...');
          window.location.href = 'dashboard/STUDASHBOARD.html';
        } else {
          alert(response.message || 'Registration failed');
        }
      },
      error: function (xhr, status, error) {
        console.error('Signup error:', error);  
        const errorMessage = xhr.responseJSON ? xhr.responseJSON.message : 'Registration failed. Please try again.';
        alert(errorMessage);
      }
    });
  });

  // Create and insert canvas
  const canvas = document.createElement('canvas');
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '-1'; // behind text
  canvas.style.display = 'block';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // Set canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Resize on window change
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  // Star settings
  const stars = [];
  const numStars = 100;

  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      radius: Math.random() * 2 + 1
    });
  }

  // Draw and animate stars
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < numStars; i++) {
      const star = stars[i];
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();

      star.x += star.vx;
      star.y += star.vy;

      if (star.x < 0 || star.x > canvas.width) star.vx *= -1;
      if (star.y < 0 || star.y > canvas.height) star.vy *= -1;

      for (let j = i + 1; j < numStars; j++) {
        const other = stars[j];
        const dx = star.x - other.x;
        const dy = star.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 120) {
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${1 - distance / 120})`;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();

  // Create and style text container
  const textContainer = document.createElement('div');
  textContainer.id = "typing-text";
  textContainer.style.position = 'absolute';
  textContainer.style.top = '50%';
  textContainer.style.left = '50%';
  textContainer.style.transform = 'translate(-50%, -50%)';
  textContainer.style.fontSize = '24px';
  textContainer.style.color = 'white';
  textContainer.style.fontFamily = 'Arial, sans-serif';
  textContainer.style.textAlign = 'center';
  textContainer.style.zIndex = '1';
  document.body.appendChild(textContainer);

  // Dynamically load schools and programs from the database
  $.get('/api/programs', function (programs) {
    const schoolsSet = new Set();
    const schoolToPrograms = {};

    programs.forEach(({ school, program, years }) => {
      schoolsSet.add(school);

      if (!schoolToPrograms[school]) {
        schoolToPrograms[school] = [];
      }
      schoolToPrograms[school].push({ program, years });
    });

    // Populate school select dropdown
    const $schoolSelect = $('#school');
    $schoolSelect.append(`<option value="" disabled selected>Select a School</option>`);
    schoolsSet.forEach((school) => {
      $schoolSelect.append(`<option value="${school}">${school}</option>`);
    });

    // When a school is selected, populate courses with corresponding programs and years
    $('#school').on('change', function () {
      const selectedSchool = $(this).val();
      const $courseSelect = $('#course');
      $courseSelect.empty(); // clear old options
      $courseSelect.append(`<option value="" disabled selected>Select a Program & Year</option>`);

      const programs = schoolToPrograms[selectedSchool] || [];
      programs.forEach(({ program, years }) => {
        for (let year = 1; year <= years; year++) {
          const yearLabel = `${year}${getOrdinalSuffix(year)} Year`;
          const displayText = `${program} - ${yearLabel}`;
          const value = `${program} - ${yearLabel}`;
          $courseSelect.append(`<option value="${value}">${displayText}</option>`);
        }
      });
    });

    // Helper: Ordinal suffix
    function getOrdinalSuffix(n) {
      if (n > 3 && n < 21) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    }
  });
});