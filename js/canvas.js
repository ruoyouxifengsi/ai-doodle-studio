const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;
const DEFAULT_BRUSH_COLOR = '#000000';
const DEFAULT_BRUSH_WIDTH = 5;

export function initCanvas(containerEl, sceneId) {
  containerEl.innerHTML = '';

  const canvasEl = document.createElement('canvas');
  canvasEl.id = 'fabricCanvas';
  containerEl.appendChild(canvasEl);

  const fabricCanvas = new fabric.Canvas('fabricCanvas', {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    isDrawingMode: true,
    backgroundColor: '#ffffff',
  });

  fabricCanvas.freeDrawingBrush.color = DEFAULT_BRUSH_COLOR;
  fabricCanvas.freeDrawingBrush.width = DEFAULT_BRUSH_WIDTH;

  const fitCanvas = () => {
    const maxW = containerEl.clientWidth - 16;
    const maxH = containerEl.clientHeight - 16;
    const scale = Math.min(maxW / CANVAS_WIDTH, maxH / CANVAS_HEIGHT);
    fabricCanvas.setZoom(scale);
    fabricCanvas.setWidth(CANVAS_WIDTH * scale);
    fabricCanvas.setHeight(CANVAS_HEIGHT * scale);
  };

  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  return fabricCanvas;
}
