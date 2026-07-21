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

  fabricCanvas._undoStack = [];
  fabricCanvas.on('path:created', (e) => {
    fabricCanvas._undoStack.push(e.path);
  });

  fabricCanvas.setColor = (hex) => {
    fabricCanvas.freeDrawingBrush.color = hex;
  };

  fabricCanvas.undo = () => {
    const path = fabricCanvas._undoStack.pop();
    if (path) {
      fabricCanvas.remove(path);
      fabricCanvas.renderAll();
    }
  };

  fabricCanvas.clearDrawing = () => {
    const paths = fabricCanvas._undoStack.splice(0);
    paths.forEach(p => fabricCanvas.remove(p));
    fabricCanvas.renderAll();
  };

  fabric.Image.fromURL(`scenes/${sceneId}.svg`, (img) => {
    img.set({
      selectable: false,
      evented: false,
      left: 0,
      top: 0,
    });
    const scaleX = CANVAS_WIDTH / img.width;
    const scaleY = CANVAS_HEIGHT / img.height;
    const scale = Math.min(scaleX, scaleY);
    img.scaleX = scale;
    img.scaleY = scale;
    img.left = (CANVAS_WIDTH - img.width * scale) / 2;
    img.top = (CANVAS_HEIGHT - img.height * scale) / 2;
    fabricCanvas.add(img);
    fabricCanvas.sendToBack(img);
    fabricCanvas._silhouette = img;
    fabricCanvas.renderAll();
  });

  const fitCanvas = () => {
    const maxW = containerEl.clientWidth - 16;
    const maxH = containerEl.clientHeight - 16;
    if (maxW <= 0 || maxH <= 0) return;
    const scale = Math.min(maxW / CANVAS_WIDTH, maxH / CANVAS_HEIGHT);
    fabricCanvas.setZoom(scale);
    fabricCanvas.setWidth(CANVAS_WIDTH * scale);
    fabricCanvas.setHeight(CANVAS_HEIGHT * scale);
    fabricCanvas.renderAll();
  };

  requestAnimationFrame(() => {
    fitCanvas();
  });
  window.addEventListener('resize', fitCanvas);
  fabricCanvas._fitCanvas = fitCanvas;

  fabricCanvas.cleanup = () => {
    window.removeEventListener('resize', fabricCanvas._fitCanvas);
    fabricCanvas.dispose();
  };

  return fabricCanvas;
}
