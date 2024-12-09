export function initNavbar() {
  const navbar = document.getElementById('navbar');

  navbar.innerHTML = `
    <div class="navbar">
      <div class="container navbar-container">

        <a href="/" class="logo-container">
          <img src="../assets/images/logo.png" class="logo" alt="Social Connect Pro">
          <img src="../assets/images/social-connect-pro.png" alt="Social Connect Pro">
        </a>
        
        <ul class="nav-links">
          <li><a href="#about" class="nav-link">ABOUT</a></li>
          <li><a href="#services" class="nav-link">SERVICES</a></li>
          <li><a href="#technologies" class="nav-link">TECHNOLOGIES</a></li>
          <li><a href="#how-to" class="nav-link">HOW TO</a></li>
        </ul>
        
        <div class="nav-buttons">
          <button class="btn btn-outline">CONTACT US</button>
          <button class="btn btn-primary">JOIN US</button>
        </div>
      </div>
    </div>
  `;
}