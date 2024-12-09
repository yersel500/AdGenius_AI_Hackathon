import { initNavbar } from './components/navbar.js';
import { initHero } from './components/hero.js';
import { initFeatures } from './components/features.js';
import { initWhyBuild } from './components/whyBuild.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initHero();
  initWhyBuild();
  initFeatures();
});