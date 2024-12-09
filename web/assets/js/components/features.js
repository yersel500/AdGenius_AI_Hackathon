export function initFeatures() {
  const features = document.getElementById('features');

  const featuresData = [
    {
      title: "STORY BOARD",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>`,
      description: "Craft compelling campaign narratives by integrating data from multiple systems into cohesive stories that drive meaningful results."
    },
    {
      title: "DISTRIBUTE",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      description: "Effortlessly connect with the right audience at the perfect moment. Scale your reach while ensuring impactful marketing where every interaction counts."
    },
    {
      title: "OPTIMIZE",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
      description: "Leverage real-time audience and market insights to stay ahead. Make smarter decisions with AI-powered analytics, adapting strategies to meet evolving needs."
    },
    {
      title: "COLLABORATE",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>`,
      description: "Seamlessly move from idea to launch with collaborative precision. Transform prospects into partners with personalized experiences that resonate at every touchpoint."
    }
  ];

  features.innerHTML = `
    <div class="container">
      <div class="features-grid">
        ${featuresData.map(feature => `
          <div class="feature-card">
            <div class="feature-icon">
              ${feature.icon}
            </div>
            <h3 class="feature-title">${feature.title}</h3>
            <p class="feature-description">${feature.description}</p>
            <button class="try-button">KNOW MORE</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}