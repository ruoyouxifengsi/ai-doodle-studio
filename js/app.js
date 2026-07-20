import { SCENES } from './scenes.js';
import { initCanvas } from './canvas.js';

const sections = {
  sceneSelect: document.getElementById('sceneSelect'),
  canvasPage: document.getElementById('canvasPage'),
  resultPage: document.getElementById('resultPage'),
};

let currentCanvas = null;

function showScreen(name) {
  Object.values(sections).forEach(el => el.classList.remove('active'));
  sections[name].classList.add('active');
}

function renderSceneCards() {
  const grid = document.querySelector('.scene-grid');
  grid.innerHTML = '';

  SCENES.forEach(scene => {
    const card = document.createElement('div');
    card.className = `scene-card scene-card--${scene.id}`;
    card.innerHTML = `
      <img src="${scene.silhouette}" alt="${scene.name}" loading="lazy">
      <span class="scene-name">${scene.name}</span>
    `;
    card.addEventListener('click', () => {
      document.querySelector('.canvas-scene-name').textContent = scene.name;
      showScreen('canvasPage');
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      document.querySelector('.color-dot--black').classList.add('active');
      currentCanvas = initCanvas(document.querySelector('.canvas-wrapper'), scene.id);
    });
    grid.appendChild(card);
  });
}

document.querySelector('.btn-back').addEventListener('click', () => {
  if (currentCanvas) {
    currentCanvas.dispose();
    currentCanvas = null;
  }
  showScreen('sceneSelect');
});

document.querySelector('.canvas-toolbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || !currentCanvas) return;

  if (btn.classList.contains('color-dot')) {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    btn.classList.add('active');
    currentCanvas.setColor(btn.dataset.color);
  }

  if (btn.classList.contains('btn-undo')) {
    currentCanvas.undo();
  }

  if (btn.classList.contains('btn-clear')) {
    currentCanvas.clearDrawing();
  }

  if (btn.classList.contains('btn-generate')) {
    // Day 3 接入
  }
});

renderSceneCards();
