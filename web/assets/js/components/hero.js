export function initHero() {
  const hero = document.getElementById('hero');

  hero.innerHTML = `
    <div class="container hero-container">
      <div class="hero-content">
        <h1 class="hero-title">Your AI Agent for personal, on brand story telling</h1>
        <p class="hero-subtitle">How can we help you create your story?</p>
        <div class="hero-buttons">
          <a class="btn btn-primary" href="chat.html">
            GET STARTED →
          </a>
          <!-- <button class="btn btn-outline">Create Impact →</button> -->
        </div>
      </div>
      <div class="hero-image">
        <img src="../assets/images/digital-story-telling.png" alt="Digital Storytelling">
      </div>
    </div>
  `;
}