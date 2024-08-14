document.addEventListener('DOMContentLoaded', function() {
    // Define your variables here after the DOM is loaded
    const userProfile = document.getElementById('user-profile');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn'); // Add signup button

    // Check if the elements exist
    if (!userProfile || !loginBtn || !signupBtn) {
        console.error('Error: One or more elements not found.');
        return;
    }

    // Fetch session status from the server
    fetch('/session-status')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (result.loggedIn) {
                console.log('Logged In');
                userProfile.style.display = 'block';  // Show the user profile button
                loginBtn.style.display = 'none';     // Hide the login button
                signupBtn.style.display = 'none';    // Hide the signup button
            } else {
                console.log('Not Logged In');
                userProfile.style.display = 'none';  // Hide the user profile button
                loginBtn.style.display = 'inline';   // Show the login button
                signupBtn.style.display = 'inline';  // Show the signup button
            }
        })
        .catch(error => {
            console.error('Error checking session status:', error);
        });

    const userIcon = document.getElementById('user-icon');
    const userDropdown = document.getElementById('user-dropdown');

    userIcon.addEventListener('click', function() {
        userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
    });

    const logoutBtn = document.getElementById('logout');
    logoutBtn.addEventListener('click', async function() {
        try {
            await fetch('/logout', { method: 'POST' });
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Logout failed:", error);
        }
    });
});
